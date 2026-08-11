const express = require('express');
const formulariosModel = require('../models/formulariosModel');
const { serializeFormulario } = require('../serializers/formularioSerializer');
const { upload, USE_S3, getFileUrl } = require('../middlewares/upload');
const { authenticate } = require('../middlewares/auth');

const router = express.Router();

router.use(authenticate);

router.post('/formularios', upload.single('exame_anexo'), (req, res) => {
  let { reservaIds, tipoFormulario, tipoAtendimento, usuarioId, profissionalId, conteudo } = req.body || {};

  // O formulário de pré-consulta é sempre preenchido pelo próprio paciente — se um
  // usuarioId vier no corpo da requisição, ele precisa ser o mesmo usuário autenticado,
  // senão qualquer paciente logado poderia gravar respostas em nome de outro.
  if (usuarioId !== undefined && usuarioId !== null && usuarioId !== '' && Number(usuarioId) !== req.userId) {
    return res.status(403).json({ error: 'Você não pode enviar um formulário em nome de outro usuário.' });
  }

  if (typeof reservaIds === 'string') {
    try { reservaIds = JSON.parse(reservaIds); } catch { /* mantém string, falha na validação abaixo */ }
  }
  if (typeof conteudo === 'string') {
    try { conteudo = JSON.parse(conteudo); } catch { /* mantém string */ }
  }

  if (!Array.isArray(reservaIds) || reservaIds.length === 0) {
    return res.status(400).json({ error: 'reservaIds é obrigatório e deve ser um array não vazio.' });
  }

  if (!tipoFormulario || !String(tipoFormulario).trim()) {
    return res.status(400).json({ error: 'tipoFormulario é obrigatório.' });
  }

  if (req.file && conteudo && typeof conteudo === 'object') {
    conteudo.anexoExame = USE_S3 ? req.file.key : `/uploads/${req.file.filename}`;
  }

  let conteudoStr;
  try {
    conteudoStr = JSON.stringify(conteudo ?? req.body);
  } catch {
    return res.status(400).json({ error: 'conteudo inválido para JSON.' });
  }

  const rows = reservaIds
    .filter((id) => id !== null && id !== undefined && id !== '')
    .map((id) => [
      Number(id),
      String(tipoFormulario).trim(),
      tipoAtendimento ? String(tipoAtendimento).trim() : null,
      usuarioId ? Number(usuarioId) : null,
      profissionalId ? Number(profissionalId) : null,
      conteudoStr
    ])
    .filter((r) => Number.isFinite(r[0]));

  if (rows.length === 0) {
    return res.status(400).json({ error: 'Nenhum reservaId válido para salvar.' });
  }

  formulariosModel.upsertByReservaIds(rows, (err, result) => {
    if (err) return res.status(500).json({ error: 'Erro ao salvar formulário.' });
    res.json({ success: true, affectedRows: result.affectedRows, saved: rows.length });
  });
});

router.get('/formularios/reserva/:reservaId', (req, res) => {
  const reservaId = Number(req.params.reservaId);
  if (!Number.isFinite(reservaId)) {
    return res.status(400).json({ error: 'reservaId inválido.' });
  }

  formulariosModel.findByReservaId(reservaId, async (err, results) => {
    if (err) return res.status(500).json({ error: 'Erro ao buscar formulário.' });
    if (!results || results.length === 0) return res.status(404).json({ error: 'Formulário não encontrado.' });

    // O formulário contém dados clínicos sensíveis (sintomas, histórico de saúde,
    // medicamentos etc.) — só o paciente dono da consulta ou o profissional que vai
    // atendê-la podem lê-lo.
    const row = results[0];
    if (row.usuario_id !== req.userId && row.profissional_id !== req.userId) {
      return res.status(403).json({ error: 'Você não tem permissão para ver este formulário.' });
    }

    const formulario = serializeFormulario(row);
    const anexoExame = formulario.conteudo?.anexoExame;
    if (anexoExame) {
      formulario.conteudo.anexoExame = await getFileUrl(anexoExame);
    }
    res.json(formulario);
  });
});

module.exports = router;

