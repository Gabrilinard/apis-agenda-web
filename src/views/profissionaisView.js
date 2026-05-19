const express = require('express');
const profissionaisModel = require('../models/profissionaisModel');

const router = express.Router();

router.get('/profissionais', (req, res) => {
  profissionaisModel.listProfissionais((err, results) => {
    if (err) return res.status(500).json({ error: 'Erro ao buscar profissionais' });
    res.json(results);
  });
});

router.get('/profissionais/:categoria', (req, res) => {
  const { categoria } = req.params;
  const categoriasValidas = ['medico', 'dentista', 'nutricionista', 'fisioterapeuta', 'fonoaudiologo'];
  if (!categoriasValidas.includes(categoria)) {
    return res.status(400).json({ error: 'Categoria inválida' });
  }

  profissionaisModel.listPorCategoria(categoria, (err, results) => {
    if (err) return res.status(500).json({ error: `Erro ao buscar ${categoria}` });
    res.json(results);
  });
});

module.exports = router;

