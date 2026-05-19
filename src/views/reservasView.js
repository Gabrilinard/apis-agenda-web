const express = require('express');
const { upload } = require('../middlewares/upload');
const { dbPromise } = require('../db');
const reservasModel = require('../models/reservasModel');
const profissionaisModel = require('../models/profissionaisModel');

const router = express.Router();

router.post('/reservas', upload.single('arquivo_urgencia'), async (req, res) => {
  const { nome, sobrenome, telefone, email, dia, horario, horarioFinal, qntd_pessoa, usuario_id, nomeProfissional, profissional_id, status, is_urgente, descricao_urgencia } = req.body;

  const arquivo_urgencia = req.file ? `/uploads/${req.file.filename}` : null;
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
      nome,
      sobrenome,
      telefone,
      email,
      dia,
      horario,
      horarioFinal,
      qntd_pessoa,
      usuario_id,
      profissional_id: profissionalIdFinal,
      status: statusFinal,
      is_urgente: isUrgenteBoolean,
      descricao_urgencia,
      arquivo_urgencia
    },
    (err, result) => {
      if (err) return res.status(500).json({ error: 'Erro ao processar a reserva.' });
      res.json({ success: true, id: result.insertId });
    }
  );
});

router.get('/reservas/:id', (req, res) => {
  reservasModel.getByUsuarioId(req.params.id, (err, results) => {
    if (err) return res.status(500).json(err);
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
  reservasModel.list(req.query, (err, results) => {
    if (err) return res.status(500).json(err);
    res.json(results);
  });
});

router.patch('/reservas/:id', (req, res) => {
  reservasModel.patchUpdate(req.params.id, req.body || {}, (err) => {
    if (err) return res.status(500).json({ error: 'Erro ao atualizar a reserva', details: err });
    res.status(200).json({ message: 'Reserva atualizada com sucesso' });
  });
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

router.patch('/reservas/negado/:id', (req, res) => {
  const { status, motivoNegacao } = req.body || {};
  reservasModel.setNegado(req.params.id, status, motivoNegacao, (err) => {
    if (err) return res.status(500).json({ error: 'Erro ao atualizar reserva' });
    res.json({ message: 'Reserva atualizada com sucesso!' });
  });
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

