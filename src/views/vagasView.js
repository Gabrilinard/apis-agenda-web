const express = require('express');
const { dbPromise } = require('../db');
const vagasModel = require('../models/vagasModel');
const { emailLiberacaoSlot, emailNotificacaoVaga, emailConfirmacaoVaga } = require('../email');
const { authenticate } = require('../middlewares/auth');

const router = express.Router();

const JANELA_DESEMPATE_MS = 1200;
const janelasDesempate = new Map(); // chave -> { timer, attempts: [{ notificacaoId, token, resolve }] }

const construirDataHora = (diaStr, horarioStr) => {
  const [ano, mes, dia] = String(diaStr).split('T')[0].split('-').map(Number);
  const [hh, mm] = String(horarioStr || '0:0').split(':').map(Number);
  return new Date(ano, (mes || 1) - 1, dia || 1, hh || 0, mm || 0, 0, 0);
};

const processarJanelaDesempate = async (chave) => {
  const janela = janelasDesempate.get(chave);
  janelasDesempate.delete(chave);
  if (!janela) return;

  const candidatas = [];

  for (const tentativa of janela.attempts) {
    try {
      const notif = await vagasModel.getNotificacaoPorIdEToken(tentativa.notificacaoId, tentativa.token);
      if (!notif) {
        tentativa.resolve({ ok: false, motivo: 'Notificação não encontrada ou já processada.' });
        continue;
      }

      const [disponiveis, jaConsumidas] = await Promise.all([
        vagasModel.getReservasCandidatoDisponiveis(notif.usuario_notificado_id, notif.profissional_id),
        vagasModel.contarNotificacoesAceitas(notif.usuario_notificado_id, notif.profissional_id, notif.id),
      ]);
      const reservaParaMover = disponiveis[jaConsumidas];

      if (!reservaParaMover) {
        await vagasModel.recusarNotificacao(notif.id);
        tentativa.resolve({ ok: false, motivo: 'Você não tem mais consultas disponíveis para trocar por esta vaga.' });
        continue;
      }

      const liberadoDT = construirDataHora(notif.dia, notif.horario);
      const candidatoDT = construirDataHora(reservaParaMover.dia, reservaParaMover.horario);

      candidatas.push({
        notif, reservaParaMover, disponiveis, jaConsumidas, tentativa,
        isUrgente: Number(reservaParaMover.is_urgente) === 1,
        distanciaMs: Math.abs(candidatoDT.getTime() - liberadoDT.getTime()),
      });
    } catch (e) {
      console.error('[aceitar/janela]', e);
      tentativa.resolve({ ok: false, motivo: 'Erro ao processar aceite.' });
    }
  }

  if (candidatas.length === 0) return;

  // Prioridade: consulta emergencial primeiro; empatando (ou entre não-emergenciais),
  // quem estava com a consulta mais próxima (data/horário) da vaga liberada.
  candidatas.sort((a, b) => {
    if (a.isUrgente !== b.isUrgente) return a.isUrgente ? -1 : 1;
    return a.distanciaMs - b.distanciaMs;
  });

  const [vencedora, ...perdedoras] = candidatas;
  const { notif, reservaParaMover, disponiveis, jaConsumidas } = vencedora;

  try {
    await dbPromise.query(
      'UPDATE reservas SET dia = ?, horario = ?, horarioFinal = ?, status = "confirmado" WHERE id = ?',
      [notif.dia, notif.horario, notif.horarioFinal, reservaParaMover.id]
    );

    if (notif.reserva_liberada_id) {
      await dbPromise.query('UPDATE reservas SET status = "transferido" WHERE id = ?', [notif.reserva_liberada_id]);
    }

    await vagasModel.aceitarNotificacao(notif.id);
    await vagasModel.expirarOutras(notif.profissional_id, notif.dia, notif.horario, notif.id);

    if (disponiveis.length - jaConsumidas - 1 <= 0) {
      await vagasModel.expirarPendentesSemReserva(notif.usuario_notificado_id, notif.profissional_id, notif.id);
    }

    const [[candidato]] = await dbPromise.query('SELECT nome, sobrenome, email FROM usuario WHERE id = ? LIMIT 1', [notif.usuario_notificado_id]);
    const [[prof]] = await dbPromise.query('SELECT nome, sobrenome, email, genero FROM usuario WHERE id = ? LIMIT 1', [notif.profissional_id]);

    if (candidato && prof) {
      emailConfirmacaoVaga({
        pacienteEmail: candidato.email,
        pacienteNome: `${candidato.nome} ${candidato.sobrenome}`,
        profissionalEmail: prof.email,
        profissionalNome: `${prof.nome} ${prof.sobrenome}`,
        profissionalGenero: prof.genero,
        dia: notif.dia,
        horario: notif.horario,
      }).catch(e => console.error('[aceitar] email error:', e.message));
    }

    vencedora.tentativa.resolve({ ok: true });
  } catch (e) {
    console.error('[aceitar/vencedora]', e);
    vencedora.tentativa.resolve({ ok: false, motivo: 'Erro ao aceitar vaga.' });
  }

  // As demais notificações pendentes dessa vaga já foram expiradas por expirarOutras
  // acima (mesmo profissional_id + dia + horario) — só resta avisar quem perdeu.
  for (const perdedora of perdedoras) {
    perdedora.tentativa.resolve({ ok: false, motivo: 'Outro paciente confirmou essa vaga primeiro.' });
  }
};

router.post('/vagas/liberar/:reservaId', authenticate, async (req, res) => {
  const { reservaId } = req.params;
  try {
    const [[reserva]] = await dbPromise.query(
      'SELECT r.*, u.nome AS pac_nome, u.sobrenome AS pac_sobrenome, u.email AS pac_email FROM reservas r LEFT JOIN usuario u ON r.usuario_id = u.id WHERE r.id = ? LIMIT 1',
      [reservaId]
    );
    if (!reserva) return res.status(404).json({ error: 'Reserva não encontrada.' });
    if (reserva.usuario_id !== req.userId) {
      return res.status(403).json({ error: 'Você não tem permissão para liberar esta reserva.' });
    }

    await dbPromise.query('UPDATE reservas SET status = "liberado" WHERE id = ?', [reservaId]);

    const [[prof]] = await dbPromise.query(
      'SELECT nome, sobrenome, email, genero FROM usuario WHERE id = ? LIMIT 1',
      [reserva.profissional_id]
    );

    if (prof) {
      const dia = String(reserva.dia).split('T')[0];
      emailLiberacaoSlot({
        pacienteEmail: reserva.pac_email,
        pacienteNome: `${reserva.pac_nome} ${reserva.pac_sobrenome}`,
        profissionalEmail: prof.email,
        profissionalNome: `${prof.nome} ${prof.sobrenome}`,
        profissionalGenero: prof.genero,
        dia,
        horario: reserva.horario,
      }).catch(e => console.error('[liberar] email error:', e.message));
    }

    res.json({ success: true, message: 'Horário liberado com sucesso.' });
  } catch (e) {
    console.error('[liberar]', e);
    res.status(500).json({ error: 'Erro ao liberar horário.' });
  }
});

router.get('/vagas/candidatos', async (req, res) => {
  const { profissional_id, dia, excluir_usuario_id } = req.query;
  if (!profissional_id || !dia) return res.status(400).json({ error: 'profissional_id e dia são obrigatórios.' });
  try {
    const candidatos = await vagasModel.getCandidatos(profissional_id, dia, excluir_usuario_id || 0);
    res.json(candidatos);
  } catch (e) {
    console.error('[candidatos] SQL error:', e.message || e);
    res.status(500).json({ error: 'Erro ao buscar candidatos.', detail: e.message });
  }
});

router.post('/vagas/notificar', async (req, res) => {
  const { profissional_id, reserva_liberada_id, dia, horario, horarioFinal, usuario_notificado_id, reserva_candidato_id } = req.body;
  if (!profissional_id || !dia || !horario || !usuario_notificado_id) {
    return res.status(400).json({ error: 'Campos obrigatórios ausentes.' });
  }
  try {
    const { id: notificacaoId, token } = await vagasModel.criarNotificacao({
      profissional_id, reserva_liberada_id, dia, horario, horarioFinal, usuario_notificado_id, reserva_candidato_id,
    });

    const [[candidato]] = await dbPromise.query('SELECT nome, sobrenome, email FROM usuario WHERE id = ? LIMIT 1', [usuario_notificado_id]);
    const [[prof]] = await dbPromise.query('SELECT nome, sobrenome, email, genero FROM usuario WHERE id = ? LIMIT 1', [profissional_id]);

    if (candidato && prof) {
      emailNotificacaoVaga({
        candidatoEmail: candidato.email,
        candidatoNome: `${candidato.nome} ${candidato.sobrenome}`,
        profissionalNome: `${prof.nome} ${prof.sobrenome}`,
        profissionalGenero: prof.genero,
        dia,
        horario,
        notificacaoId,
        token,
      }).catch(e => console.error('[notificar] email error:', e.message));
    }

    res.json({ success: true, notificacaoId });
  } catch (e) {
    console.error('[notificar]', e);
    res.status(500).json({ error: 'Erro ao notificar candidato.' });
  }
});

router.get('/vagas/pendentes/:usuarioId', async (req, res) => {
  try {
    const notificacoes = await vagasModel.getPendentesPorUsuario(req.params.usuarioId);
    res.json(notificacoes);
  } catch (e) {
    res.status(500).json({ error: 'Erro ao buscar notificações.' });
  }
});

router.post('/vagas/aceitar/:notificacaoId', async (req, res) => {
  const { token } = req.body;
  const { notificacaoId } = req.params;
  if (!token) return res.status(400).json({ error: 'Token obrigatório.' });

  try {
    const notif = await vagasModel.getNotificacaoPorIdEToken(notificacaoId, token);
    if (!notif) return res.status(404).json({ error: 'Notificação não encontrada ou já processada.' });

    const chave = notif.reserva_liberada_id ? `liberada-${notif.reserva_liberada_id}` : `notif-${notif.id}`;

    const resultado = await new Promise((resolve) => {
      let janela = janelasDesempate.get(chave);
      if (!janela) {
        janela = { attempts: [] };
        janela.timer = setTimeout(() => processarJanelaDesempate(chave), JANELA_DESEMPATE_MS);
        janelasDesempate.set(chave, janela);
      }
      janela.attempts.push({ notificacaoId, token, resolve });
    });

    if (!resultado.ok) {
      return res.status(409).json({ error: resultado.motivo || 'Não foi possível aceitar esta vaga.' });
    }
    res.json({ success: true, message: 'Vaga aceita com sucesso!' });
  } catch (e) {
    console.error('[aceitar]', e);
    res.status(500).json({ error: 'Erro ao aceitar vaga.' });
  }
});

router.post('/vagas/recusar/:notificacaoId', async (req, res) => {
  try {
    await vagasModel.recusarNotificacao(req.params.notificacaoId);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Erro ao recusar vaga.' });
  }
});

module.exports = router;
