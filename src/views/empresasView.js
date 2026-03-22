const express = require('express');
const empresasModel = require('../models/empresasModel');

const router = express.Router();

router.get('/empresas', (req, res) => {
  empresasModel.listEmpresas((err, results) => {
    if (err) {
      empresasModel.listEmpresasFallback((err2, results2) => {
        if (err2) return res.status(500).json({ error: 'Erro ao buscar empresas' });
        res.json(results2);
      });
      return;
    }
    res.json(results);
  });
});

module.exports = router;

