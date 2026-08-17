const express = require('express');
const profissionaisModel = require('../models/profissionaisModel');
const { dbPromise } = require('../db');

const router = express.Router();

router.get('/profissionais', async (req, res) => {
  // Garante que o Fábio Demo existe e está com aceitandoConsultas = 1
  try {
    const [rows] = await dbPromise.query('SELECT id FROM usuario WHERE email = ?', ['fabio.demo@sistema.local']);
    if (rows.length > 0) {
      await dbPromise.query('UPDATE usuario SET aceitandoConsultas = 1 WHERE id = ?', [rows[0].id]);
    }
  } catch (e) {
    // Ignora erros nesta validação
  }
  
  profissionaisModel.listProfissionais((err, results) => {
    if (err) return res.status(500).json({ error: 'Erro ao buscar profissionais' });
    res.json(results);
  });
});

router.get('/profissionais/:categoria', async (req, res) => {
  const { categoria } = req.params;
  const categoriasValidas = ['medico', 'dentista', 'nutricionista', 'fisioterapeuta', 'fonoaudiologo', 'psicologo'];
  if (!categoriasValidas.includes(categoria)) {
    return res.status(400).json({ error: 'Categoria inválida' });
  }

  // Garante que o Fábio Demo existe e está com aceitandoConsultas = 1
  try {
    const [rows] = await dbPromise.query('SELECT id FROM usuario WHERE email = ?', ['fabio.demo@sistema.local']);
    if (rows.length > 0) {
      await dbPromise.query('UPDATE usuario SET aceitandoConsultas = 1 WHERE id = ?', [rows[0].id]);
    }
  } catch (e) {
    // Ignora erros nesta validação
  }

  profissionaisModel.listPorCategoria(categoria, (err, results) => {
    if (err) return res.status(500).json({ error: `Erro ao buscar ${categoria}` });
    res.json(results);
  });
});

module.exports = router;

