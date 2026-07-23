const express = require('express');
const { upload, USE_S3, getFileUrl } = require('../middlewares/upload');
const { dbPromise } = require('../db');
const reservasModel = require('../models/reservasModel');
const profissionaisModel = require('../models/profissionaisModel');
const { emailNovaConsulta, emailConsultaConfirmada, emailConsultaRemarcada, emailConsultaNegada, emailNovaUrgencia, emailUrgenciaAceita, emailUrgenciaRemarcada } = require('../email');
const { authenticate } = require('../middlewares/auth');

const router = express.Router();

router.use(authenticate);

router.post('/reservas', upload.single('arquivo_urgencia'), async (req, res) => {
  const { nome, sobrenome, telefone, email, dia, horario, horarioFinal, qntd_pessoa, usuario_id, nomeProfissional, profissional_id, status, is_urgente, descricao_urgencia, modalidade_urgencia, turno_urgencia } = req.body;

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

  const statusFinal = status || 'pendente';

  reservasModel.createReserva(
    {
      nome, sobrenome, telefone, email, dia, horario, horarioFinal,
      qntd_pessoa, usuario_id, profissional_id: profissionalIdFinal,
      status: statusFinal, is_urgente: isUrgenteBoolean, descricao_urgencia, arquivo_urgencia, modalidade_urgencia, turno_urgencia
    },
    (err, result) => {
      if (err) return res.status(500).json({ error: 'Erro ao processar a reserva.' });

      if (profissionalIdFinal) {
        dbPromise.query('SELECT nome, sobrenome, email FROM usuario WHERE id = ? LIMIT 1', [profissionalIdFinal])
          .then(([[prof]]) => {
            if (!prof) return;
            if (isUrgenteBoolean) {
              emailNovaUrgencia({
                profissionalEmail: prof.email,
                profissionalNome: `${prof.nome} ${prof.sobrenome}`,
                pacienteNome: `${nome} ${sobrenome}`,
                pacienteTelefone: telefone || '',
                descricao: descricao_urgencia || '',
                dia: dia || '',
                horario: horario || '',
              }).catch(e => console.error('[nova urgencia email]', e.message));
            } else {
              emailNovaConsulta({
                profissionalEmail: prof.email,
                profissionalNome: `${prof.nome} ${prof.sobrenome}`,
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
  reservasModel.getByUsuarioId(req.params.id, async (err, results) => {
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

router.get('/reservas', (req, res) => {
  reservasModel.list(req.query, async (err, results) => {
    if (err) return res.status(500).json(err);
    for (const r of results) {
      if (r.arquivo_urgencia) r.arquivo_urgencia = await getFileUrl(r.arquivo_urgencia);
    }
    res.json(results);
  });
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
                 p.nome AS prof_nome, p.sobrenome AS prof_sobrenome, p.email AS prof_email
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

          if (newStatus === 'confirmado') {
            const emailFn = isUrgente ? emailUrgenciaAceita : emailConsultaConfirmada;
            emailFn({
              pacienteEmail: reserva.pac_email,
              pacienteNome,
              profissionalEmail: reserva.prof_email,
              profissionalNome,
              dia, horario,
            }).catch(e => console.error('[confirmado email]', e.message));
          } else if (newStatus === 'aguardando_confirmacao_paciente') {
            const emailFn = isUrgente ? emailUrgenciaRemarcada : emailConsultaRemarcada;
            emailFn({
              pacienteEmail: reserva.pac_email,
              pacienteNome,
              profissionalEmail: reserva.prof_email,
              profissionalNome,
              novoDia: dia, novoHorario: horario,
            }).catch(e => console.error('[remarcada email]', e.message));
          } else if (newStatus === 'negado') {
            emailConsultaNegada({
              pacienteEmail: reserva.pac_email,
              pacienteNome,
              profissionalNome,
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

router.put('/reservas/:id', async (req, res) => {
  try {
    const result = await reservasModel.updateReserva(req.params.id, req.body || {});
    if (!result.found) return res.status(404).json({ error: 'Reserva não encontrada' });
    res.status(200).json({ message: 'Reserva atualizada com sucesso!' });
  } catch {
    res.status(500).json({ error: 'Erro ao atualizar a reserva' });
  }
});

router.delete('/reservas/:id', (req, res) => {
  reservasModel.deleteById(req.params.id, (err, result) => {
    if (err) return res.status(500).json({ error: 'Erro ao excluir reserva' });
    if (!result || result.affectedRows === 0) return res.status(404).json({ message: 'Reserva não encontrada ou não pertence a este usuário' });
    res.json({ message: 'Reserva removida com sucesso!' });
  });
});

router.put('/reservas/solicitar/:id', (req, res) => {
  reservasModel.setAusente(req.params.id, req.body?.motivoFalta, (err, result) => {
    if (err) return res.status(500).json({ success: false, message: 'Erro ao atualizar status' });
    if (result.affectedRows > 0) return res.json({ success: true, message: 'Status atualizado para ausente e motivo registrado' });
    return res.status(404).json({ success: false, message: 'Reserva não encontrada' });
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
             p.nome AS prof_nome, p.sobrenome AS prof_sobrenome
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
    await reservasModel.editarReserva(req.params.id, req.body || {});
    res.status(200).json({ message: 'Reserva editada e aguardando confirmação do professor!' });
  } catch {
    res.status(500).json({ error: 'Erro ao atualizar reserva' });
  }
});

module.exports = router;

