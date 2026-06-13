const express = require('express');
const { dbPromise } = require('../db');
const vagasModel = require('../models/vagasModel');
const { emailLiberacaoSlot, emailNotificacaoVaga, emailConfirmacaoVaga } = require('../email');

const router = express.Router();

router.post('/vagas/liberar/:reservaId', async (req, res) => {
  const { reservaId } = req.params;
  try {
    const [[reserva]] = await dbPromise.query(
      'SELECT r.*, u.nome AS pac_nome, u.sobrenome AS pac_sobrenome, u.email AS pac_email FROM reservas r LEFT JOIN usuario u ON r.usuario_id = u.id WHERE r.id = ? LIMIT 1',
      [reservaId]
    );
    if (!reserva) return res.status(404).json({ error: 'Reserva não encontrada.' });

    await dbPromise.query('UPDATE reservas SET status = "liberado" WHERE id = ?', [reservaId]);

    const [[prof]] = await dbPromise.query(
      'SELECT nome, sobrenome, email FROM usuario WHERE id = ? LIMIT 1',
      [reserva.profissional_id]
    );

    if (prof) {
      const dia = String(reserva.dia).split('T')[0];
      emailLiberacaoSlot({
        pacienteEmail: reserva.pac_email,
        pacienteNome: `${reserva.pac_nome} ${reserva.pac_sobrenome}`,
        profissionalEmail: prof.email,
        profissionalNome: `${prof.nome} ${prof.sobrenome}`,
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
    const [[prof]] = await dbPromise.query('SELECT nome, sobrenome, email FROM usuario WHERE id = ? LIMIT 1', [profissional_id]);

    if (candidato && prof) {
      emailNotificacaoVaga({
        candidatoEmail: candidato.email,
        candidatoNome: `${candidato.nome} ${candidato.sobrenome}`,
        profissionalNome: `${prof.nome} ${prof.sobrenome}`,
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

    if (notif.reserva_candidato_id) {
      await dbPromise.query(
        'UPDATE reservas SET dia = ?, horario = ?, horarioFinal = ?, status = "confirmado" WHERE id = ?',
        [notif.dia, notif.horario, notif.horarioFinal, notif.reserva_candidato_id]
      );
    }

    if (notif.reserva_liberada_id) {
      await dbPromise.query('UPDATE reservas SET status = "transferido" WHERE id = ?', [notif.reserva_liberada_id]);
    }

    await vagasModel.aceitarNotificacao(notificacaoId);
    await vagasModel.expirarOutras(notif.profissional_id, notif.dia, notif.horario, notificacaoId);

    const [[candidato]] = await dbPromise.query('SELECT nome, sobrenome, email FROM usuario WHERE id = ? LIMIT 1', [notif.usuario_notificado_id]);
    const [[prof]] = await dbPromise.query('SELECT nome, sobrenome, email FROM usuario WHERE id = ? LIMIT 1', [notif.profissional_id]);

    if (candidato && prof) {
      emailConfirmacaoVaga({
        pacienteEmail: candidato.email,
        pacienteNome: `${candidato.nome} ${candidato.sobrenome}`,
        profissionalEmail: prof.email,
        profissionalNome: `${prof.nome} ${prof.sobrenome}`,
        dia: notif.dia,
        horario: notif.horario,
      }).catch(e => console.error('[aceitar] email error:', e.message));
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
