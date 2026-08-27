const express = require('express');
const { upload, USE_S3, getFileUrl } = require('../middlewares/upload');
const { dbPromise } = require('../db');
const reservasModel = require('../models/reservasModel');
const profissionaisModel = require('../models/profissionaisModel');
const usuariosModel = require('../models/usuariosModel');
const vagasModel = require('../models/vagasModel');
const notificacoesPacienteModel = require('../models/notificacoesPacienteModel');
const { emailNovaConsulta, emailConsultaConfirmada, emailConsultaRemarcada, emailConsultaNegada, emailNovaUrgencia, emailUrgenciaAceita, emailUrgenciaRemarcada, emailBloqueioPaciente } = require('../email');
const { authenticate } = require('../middlewares/auth');

const router = express.Router();

router.use(authenticate);

router.post('/reservas', upload.single('arquivo_urgencia'), async (req, res) => {
  const { nome, sobrenome, telefone, email, dia, horario, horarioFinal, qntd_pessoa, usuario_id, nomeProfissional, profissional_id, status, is_urgente, descricao_urgencia, modalidade_urgencia, turno_urgencia, modalidade, valor } = req.body;

  const [[solicitante]] = await dbPromise.query('SELECT tipoUsuario FROM usuario WHERE id = ? LIMIT 1', [req.userId]);
  if (!solicitante) return res.status(401).json({ error: 'Usuário não encontrado.' });

  // Profissional pode criar reserva em nome de um paciente (busca por CPF), mas sempre como ele mesmo.
  // Paciente só pode criar reserva para si mesmo.
  const usuarioIdFinal = solicitante.tipoUsuario === 'profissional' ? (usuario_id || null) : req.userId;

  if (usuarioIdFinal) {
    const bloqueio = await usuariosModel.getBloqueio(usuarioIdFinal);
    if (bloqueio) {
      const ateFmt = new Date(bloqueio.bloqueado_ate).toLocaleDateString('pt-BR');
      return res.status(403).json({
        error: `Este paciente está temporariamente impedido de agendar novas consultas até ${ateFmt} (${bloqueio.motivo_bloqueio || 'faltas em consultas confirmadas'}).`,
      });
    }
  }

  const arquivo_urgencia = req.file
    ? (USE_S3 ? req.file.key : `/uploads/${req.file.filename}`)
    : null;
  const isUrgenteBoolean = is_urgente === 'true' || is_urgente === true;
  let profissionalIdFinal = profissional_id || null;

  if (!profissionalIdFinal && nomeProfissional) {
    try {
      const partes = nomeProfissional.trim().split(' ');
      const nomeProf = partes[0] || '';
      const sobrenomeProf = partes.slice(1).join(' ') || '';
      const id = await profissionaisModel.findIdByNomeSobrenome(dbPromise, nomeProf, sobrenomeProf);
      if (id) profissionalIdFinal = id;
    } catch {
      profissionalIdFinal = profissionalIdFinal || null;
    }
  }

  if (!profissionalIdFinal && !nomeProfissional && solicitante.tipoUsuario === 'profissional') {
    profissionalIdFinal = req.userId;
  }

  const statusFinal = status || 'pendente';

  reservasModel.createReserva(
    {
      nome, sobrenome, telefone, email, dia, horario, horarioFinal,
      qntd_pessoa, usuario_id: usuarioIdFinal, profissional_id: profissionalIdFinal,
      status: statusFinal, is_urgente: isUrgenteBoolean, descricao_urgencia, arquivo_urgencia, modalidade_urgencia, turno_urgencia,
      modalidade, valor
    },
    (err, result) => {
      if (err) return res.status(500).json({ error: 'Erro ao processar a reserva.' });

      if (profissionalIdFinal) {
        dbPromise.query('SELECT nome, sobrenome, email, genero FROM usuario WHERE id = ? LIMIT 1', [profissionalIdFinal])
          .then(([[prof]]) => {
            if (!prof) return;
            if (isUrgenteBoolean) {
              emailNovaUrgencia({
                profissionalEmail: prof.email,
                profissionalNome: `${prof.nome} ${prof.sobrenome}`,
                profissionalGenero: prof.genero,
                pacienteNome: `${nome} ${sobrenome}`,
                pacienteTelefone: telefone || '',
                descricao: descricao_urgencia || '',
                dia: dia || '',
                horario: horario || '',
              }).catch(e => console.error('[nova urgencia email]', e.message));

              vagasModel.criarNotificacaoProfissional({
                profissional_id: profissionalIdFinal,
                reserva_id: result.insertId,
                mensagem: `⚡ Nova urgência de ${nome} ${sobrenome}. Acesse o painel de urgências para responder.`,
              }).catch(e => console.error('[nova urgencia notificacao]', e.message));
            } else {
              emailNovaConsulta({
                profissionalEmail: prof.email,
                profissionalNome: `${prof.nome} ${prof.sobrenome}`,
                profissionalGenero: prof.genero,
                pacienteNome: `${nome} ${sobrenome}`,
                pacienteTelefone: telefone || '',
                dia: dia || '',
                horario: horario || '',
              }).catch(e => console.error('[nova consulta email]', e.message));
            }
          })
          .catch(() => {});
      }

      res.json({ success: true, id: result.insertId });
    }
  );
});

router.get('/reservas/:id', (req, res) => {
  reservasModel.getByUsuarioId(req.userId, async (err, results) => {
    if (err) return res.status(500).json(err);
    for (const r of results) {
      if (r.arquivo_urgencia) r.arquivo_urgencia = await getFileUrl(r.arquivo_urgencia);
    }
    res.json(results);
  });
});

router.delete('/reservas', (req, res) => {
  const { usuario, horario, dia } = req.body;
  if (!usuario || !horario || !dia) {
    return res.status(400).json({ error: 'Usuário, horário e dia são obrigatórios.' });
  }

  reservasModel.deleteByUsuarioHorarioDia(usuario, horario, dia, (err, result) => {
    if (err) return res.status(500).json({ error: 'Erro ao remover a reserva.' });
    if (!result || result.affectedRows === 0) {
      return res.status(404).json({ message: 'Nenhuma reserva encontrada para este usuário, horário e dia.' });
    }
    res.status(200).json({ message: 'Reserva removida com sucesso.' });
  });
});

router.get('/reservas', async (req, res) => {
  try {
    const [[usuario]] = await dbPromise.query('SELECT tipoUsuario FROM usuario WHERE id = ? LIMIT 1', [req.userId]);
    if (!usuario) return res.status(401).json({ error: 'Usuário não encontrado.' });

    const isProfissional = usuario.tipoUsuario === 'profissional';
    const explicitUsuarioId = req.query && req.query.usuario_id !== undefined ? Number(req.query.usuario_id) : null;
    const explicitProfissionalId = req.query && req.query.profissional_id !== undefined ? Number(req.query.profissional_id) : null;

    let filters;

    // Se há filtro explícito de usuário
    if (explicitUsuarioId !== null && Number.isFinite(explicitUsuarioId)) {
      // Só permite se for o próprio usuário
      if (explicitUsuarioId !== req.userId) {
        return res.status(403).json({ error: 'Você só pode consultar as suas próprias reservas.' });
      }
      filters = { usuario_id: req.userId };
    }
    // Se há filtro explícito de profissional
    else if (explicitProfissionalId !== null && Number.isFinite(explicitProfissionalId)) {
      // Se é profissional, verifica se é seu próprio id
      if (isProfissional) {
        if (explicitProfissionalId !== req.userId) {
          return res.status(403).json({ error: 'Você só pode consultar a sua própria agenda.' });
        }
        filters = { profissional_id: req.userId };
      } else {
        // Paciente tentando passar profissional_id? Ignora e usa seu próprio filtro
        filters = { usuario_id: req.userId };
      }
    }
    // Sem filtro explícito: usa o padrão baseado no tipo do usuário
    else {
      filters = isProfissional ? { profissional_id: req.userId } : { usuario_id: req.userId };
    }

    reservasModel.list(filters, async (err, results) => {
      if (err) return res.status(500).json(err);
      for (const r of results) {
        if (r.arquivo_urgencia) r.arquivo_urgencia = await getFileUrl(r.arquivo_urgencia);
      }
      res.json(results);
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar reservas' });
  }
});

router.patch('/reservas/:id', async (req, res) => {
  const id = req.params.id;
  const body = req.body || {};

  try {
    await new Promise((resolve, reject) => {
      reservasModel.patchUpdate(id, body, (err) => err ? reject(err) : resolve());
    });

    const newStatus = body.status;
    const NOTIFIABLE = new Set(['confirmado', 'aguardando_confirmacao_paciente', 'negado']);
    if (NOTIFIABLE.has(newStatus)) {
      try {
        const [[reserva]] = await dbPromise.query(`
          SELECT r.*, r.is_urgente,
                 u.nome AS pac_nome, u.sobrenome AS pac_sobrenome, u.email AS pac_email,
                 p.nome AS prof_nome, p.sobrenome AS prof_sobrenome, p.email AS prof_email, p.genero AS prof_genero
          FROM reservas r
          LEFT JOIN usuario u ON r.usuario_id = u.id
          LEFT JOIN usuario p ON r.profissional_id = p.id
          WHERE r.id = ? LIMIT 1
        `, [id]);

        if (reserva) {
          const dia = body.dia ? String(body.dia).split('T')[0] : String(reserva.dia || '').split('T')[0];
          const horario = body.horario || reserva.horario || '';
          const isUrgente = Number(reserva.is_urgente) === 1;
          const pacienteNome = `${reserva.pac_nome} ${reserva.pac_sobrenome}`;
          const profissionalNome = `${reserva.prof_nome} ${reserva.prof_sobrenome}`;
          const profissionalGenero = reserva.prof_genero;

          if (newStatus === 'confirmado') {
            const emailFn = isUrgente ? emailUrgenciaAceita : emailConsultaConfirmada;
            emailFn({
              pacienteEmail: reserva.pac_email,
              pacienteNome,
              profissionalEmail: reserva.prof_email,
              profissionalNome,
              profissionalGenero,
              dia, horario,
            }).catch(e => console.error('[confirmado email]', e.message));

            const [anoC, mesC, diaNumC] = dia.split('-');
            notificacoesPacienteModel.criar({
              usuario_id: reserva.usuario_id,
              reserva_id: reserva.id,
              mensagem: `${profissionalNome} confirmou sua consulta para ${diaNumC}/${mesC}/${anoC} às ${horario}.`,
            }).catch(e => console.error('[confirmado notificacao paciente]', e.message));

            if (reserva.reagendado_em) {
              const [ano, mes, diaNum] = dia.split('-');
              vagasModel.criarNotificacaoProfissional({
                profissional_id: reserva.profissional_id,
                reserva_id: reserva.id,
                mensagem: `Consulta reagendada de ${pacienteNome} confirmada para ${diaNum}/${mes}/${ano} às ${horario}. Confira sua agenda.`,
              }).catch(e => console.error('[confirmado notificacao profissional]', e.message));
            }

            const motivoSubstituicao = 'Horário preenchido por outro paciente';
            reservasModel.getConflitantes(id, reserva.profissional_id, dia, horario, (errConf, conflitantes) => {
              if (errConf || !conflitantes?.length) return;
              reservasModel.negarConflitantes(id, reserva.profissional_id, dia, horario, () => {});
              conflitantes.forEach(c => {
                emailConsultaNegada({
                  pacienteEmail: c.pac_email,
                  pacienteNome: `${c.pac_nome} ${c.pac_sobrenome}`,
                  profissionalNome,
                  profissionalGenero,
                  motivoNegacao: motivoSubstituicao,
                }).catch(e => console.error('[negado por substituicao email]', e.message));
              });
            });
          } else if (newStatus === 'aguardando_confirmacao_paciente') {
            const emailFn = isUrgente ? emailUrgenciaRemarcada : emailConsultaRemarcada;
            emailFn({
              pacienteEmail: reserva.pac_email,
              pacienteNome,
              profissionalEmail: reserva.prof_email,
              profissionalNome,
              profissionalGenero,
              novoDia: dia, novoHorario: horario,
            }).catch(e => console.error('[remarcada email]', e.message));
          } else if (newStatus === 'negado') {
            emailConsultaNegada({
              pacienteEmail: reserva.pac_email,
              pacienteNome,
              profissionalNome,
              profissionalGenero,
              motivoNegacao: body.motivoNegacao || '',
            }).catch(e => console.error('[negado email]', e.message));
          }
        }
      } catch (e) {
        console.error('[patch email lookup]', e.message);
      }
    }

    res.status(200).json({ message: 'Reserva atualizada com sucesso' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar a reserva', details: err });
  }
});

router.patch('/reservas/:id/confirmar-presenca', async (req, res) => {
  try {
    const ok = await reservasModel.confirmarPresenca(req.params.id, req.userId);
    if (!ok) return res.status(404).json({ error: 'Reserva não encontrada.' });
    res.json({ success: true, message: 'Presença confirmada!' });
  } catch (e) {
    res.status(500).json({ error: 'Erro ao confirmar presença.' });
  }
});

router.put('/reservas/:id', async (req, res) => {
  try {
    const result = await reservasModel.updateReserva(req.params.id, req.body || {});
    if (!result.found) return res.status(404).json({ error: 'Reserva não encontrada' });
    res.status(200).json({ message: 'Reserva atualizada com sucesso!' });
  } catch {
    res.status(500).json({ error: 'Erro ao atualizar a reserva' });
  }
});

router.delete('/reservas/:id', async (req, res) => {
  try {
    const [[reserva]] = await dbPromise.query(
      'SELECT usuario_id, profissional_id, dia, horario FROM reservas WHERE id = ? LIMIT 1',
      [req.params.id]
    );
    if (!reserva) return res.status(404).json({ message: 'Reserva não encontrada.' });
    if (reserva.usuario_id !== req.userId && reserva.profissional_id !== req.userId) {
      return res.status(403).json({ message: 'Você não tem permissão para excluir esta reserva.' });
    }

    if (reserva.usuario_id === req.userId) {
      const [ano, mes, diaNum] = String(reserva.dia).split('T')[0].split('-').map(Number);
      const [hh, mm] = String(reserva.horario).split(':').map(Number);
      const dataHora = new Date(ano, (mes || 1) - 1, diaNum || 1, hh || 0, mm || 0, 0, 0);
      if (dataHora.getTime() - Date.now() < 48 * 60 * 60 * 1000) {
        return res.status(403).json({
          error: 'Faltam menos de 48h para a consulta — não é mais possível cancelar. Libere o horário para outro paciente.',
        });
      }
    }

    reservasModel.deleteById(req.params.id, (err, result) => {
      if (err) return res.status(500).json({ error: 'Erro ao excluir reserva' });
      if (!result || result.affectedRows === 0) return res.status(404).json({ message: 'Reserva não encontrada.' });
      res.json({ message: 'Reserva removida com sucesso!' });
    });
  } catch (e) {
    res.status(500).json({ error: 'Erro ao excluir reserva' });
  }
});

router.put('/reservas/solicitar/:id', async (req, res) => {
  const [[reservaAntes]] = await dbPromise.query(
    'SELECT usuario_id, presenca_confirmada FROM reservas WHERE id = ? LIMIT 1',
    [req.params.id]
  );

  reservasModel.setAusente(req.params.id, req.body?.motivoFalta, async (err, result) => {
    if (err) return res.status(500).json({ success: false, message: 'Erro ao atualizar status' });
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Reserva não encontrada' });

    res.json({ success: true, message: 'Status atualizado para ausente e motivo registrado' });

    if (reservaAntes && Number(reservaAntes.presenca_confirmada) === 1) {
      try {
        const total = await usuariosModel.contarAusenciasPosConfirmacao(reservaAntes.usuario_id);
        if (total >= 2) {
          const motivo = 'Ausência em consultas já confirmadas por você (2ª ocorrência ou mais).';
          const ate = await usuariosModel.bloquearTemporariamente(reservaAntes.usuario_id, motivo);
          const ateFmt = new Date(ate).toLocaleDateString('pt-BR');
          notificacoesPacienteModel.criar({
            usuario_id: reservaAntes.usuario_id,
            mensagem: `Você foi bloqueado temporariamente para novos agendamentos por ter faltado a consultas que já havia confirmado presença. Você poderá agendar novamente a partir de ${ateFmt}.`,
          }).catch(e => console.error('[bloqueio notificacao paciente]', e.message));

          const [[paciente]] = await dbPromise.query('SELECT nome, sobrenome, email FROM usuario WHERE id = ? LIMIT 1', [reservaAntes.usuario_id]);
          if (paciente?.email) {
            emailBloqueioPaciente({
              pacienteEmail: paciente.email,
              pacienteNome: `${paciente.nome} ${paciente.sobrenome}`.trim(),
              motivo,
              bloqueadoAte: ateFmt,
            }).catch(e => console.error('[bloqueio email paciente]', e.message));
          }
        }
      } catch (e) {
        console.error('[bloqueio por ausencia]', e.message);
      }
    }
  });
});

router.put('/reservas/marcarAtendido/:id', (req, res) => {
  reservasModel.setAtendido(req.params.id, (err, result) => {
    if (err) return res.status(500).json({ success: false, message: 'Erro ao atualizar status' });
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Reserva não encontrada' });
    res.json({ success: true, message: 'Status atualizado para atendido' });
  });
});

router.get('/reservas/extra', (req, res) => {
  reservasModel.listExtra((err, results) => {
    if (err) return res.status(500).json({ error: 'Erro interno do servidor' });
    res.json(results);
  });
});

router.patch('/reservas/negado/:id', async (req, res) => {
  const { status, motivoNegacao } = req.body || {};
  try {
    await new Promise((resolve, reject) => {
      reservasModel.setNegado(req.params.id, status, motivoNegacao, (err) => err ? reject(err) : resolve());
    });

    dbPromise.query(`
      SELECT u.nome AS pac_nome, u.sobrenome AS pac_sobrenome, u.email AS pac_email,
             p.nome AS prof_nome, p.sobrenome AS prof_sobrenome, p.genero AS prof_genero
      FROM reservas r
      LEFT JOIN usuario u ON r.usuario_id = u.id
      LEFT JOIN usuario p ON r.profissional_id = p.id
      WHERE r.id = ? LIMIT 1
    `, [req.params.id])
      .then(([[reserva]]) => {
        if (reserva) {
          emailConsultaNegada({
            pacienteEmail: reserva.pac_email,
            pacienteNome: `${reserva.pac_nome} ${reserva.pac_sobrenome}`,
            profissionalNome: `${reserva.prof_nome} ${reserva.prof_sobrenome}`,
            profissionalGenero: reserva.prof_genero,
            motivoNegacao: motivoNegacao || '',
          }).catch(e => console.error('[negado email]', e.message));
        }
      })
      .catch(() => {});

    res.json({ message: 'Reserva atualizada com sucesso!' });
  } catch {
    res.status(500).json({ error: 'Erro ao atualizar reserva' });
  }
});

router.patch('/reservas/editar/:id', async (req, res) => {
  try {
    const { dia, horario } = req.body || {};
    const [[atual]] = await dbPromise.query('SELECT * FROM reservas WHERE id = ? LIMIT 1', [req.params.id]);

    if (atual && atual.status !== 'liberado' && (String(atual.dia).split('T')[0] !== String(dia).split('T')[0] || atual.horario !== horario)) {
      await new Promise((resolve) => {
        reservasModel.createReserva({
          nome: atual.nome, sobrenome: atual.sobrenome, telefone: atual.telefone, email: atual.email,
          dia: atual.dia, horario: atual.horario, horarioFinal: atual.horarioFinal,
          qntd_pessoa: atual.qntd_pessoa, usuario_id: atual.usuario_id, profissional_id: atual.profissional_id,
          status: 'liberado', is_urgente: atual.is_urgente, modalidade: atual.modalidade, valor: atual.valor,
        }, (err) => { if (err) console.error('[editar/vaga do horario antigo]', err.message); resolve(); });
      });
    }

    await reservasModel.editarReserva(req.params.id, req.body || {});
    res.status(200).json({ message: 'Reserva editada e aguardando confirmação do professor!' });
  } catch {
    res.status(500).json({ error: 'Erro ao atualizar reserva' });
  }
});

router.get('/notificacoes-paciente/:usuarioId', async (req, res) => {
  if (Number(req.params.usuarioId) !== req.userId) {
    return res.status(403).json({ error: 'Você não tem permissão para ver as notificações de outro usuário.' });
  }
  try {
    const notificacoes = await notificacoesPacienteModel.listarPorUsuario(req.params.usuarioId);
    res.json(notificacoes);
  } catch (e) {
    res.status(500).json({ error: 'Erro ao buscar notificações.' });
  }
});

router.post('/notificacoes-paciente/:usuarioId/lidas', async (req, res) => {
  if (Number(req.params.usuarioId) !== req.userId) {
    return res.status(403).json({ error: 'Você não tem permissão para alterar as notificações de outro usuário.' });
  }
  try {
    await notificacoesPacienteModel.marcarLidas(req.params.usuarioId);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Erro ao marcar notificações como lidas.' });
  }
});

module.exports = router;

