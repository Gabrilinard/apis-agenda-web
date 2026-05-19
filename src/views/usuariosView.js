const express = require('express');
const usuariosModel = require('../models/usuariosModel');

const router = express.Router();

router.get('/usuarios/logados', (req, res) => {
  usuariosModel.listLoggedUsers((err, results) => {
    if (err) return res.status(500).send('Erro ao buscar usuários logados');
    res.json(results);
  });
});

router.get('/usuarios/solicitarDados/:id', (req, res) => {
  usuariosModel.getUserInfoById(req.params.id, (err, row) => {
    if (err) return res.status(500).send('Erro ao buscar dados do usuário logado');
    if (!row) return res.status(404).send('Usuário não encontrado ou não está logado');
    res.json(row);
  });
});

router.get('/usuarios/buscarPorCPF/:cpf', (req, res) => {
  const cpf = String(req.params.cpf || '').replace(/\D/g, '');
  if (cpf.length !== 11) {
    return res.status(400).json({ error: 'CPF deve conter 11 dígitos.' });
  }

  usuariosModel.findByCpf(cpf, (err, row) => {
    if (err) return res.status(500).json({ error: 'Erro ao buscar usuário por CPF' });
    if (!row) return res.status(404).json({ error: 'Usuário não encontrado com este CPF.' });
    res.json(row);
  });
});

router.patch('/usuarios/:id/localizacao', (req, res) => {
  usuariosModel.updateLocation(req.params.id, req.body || {}, (err, result) => {
    if (err) return res.status(500).json({ error: 'Erro ao atualizar localização.' });
    if (!result || result.affectedRows === 0) return res.status(404).json({ error: 'Usuário não encontrado.' });
    res.json({ message: 'Localização atualizada com sucesso.' });
  });
});

router.patch('/usuarios/:id/informacoes', (req, res) => {
  usuariosModel.updateInformacoes(req.params.id, req.body || {}, (err) => {
    if (err) return res.status(500).json({ error: 'Erro ao atualizar informações.' });
    res.json({ message: 'Informações atualizadas com sucesso.' });
  });
});

module.exports = router;

