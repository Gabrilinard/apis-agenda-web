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

router.get('/profissionais/:id', async (req, res) => {
  const { id } = req.params;
  
  // Verifica se é um ID numérico (não é uma categoria)
  if (!/^\d+$/.test(id)) {
    return res.status(400).json({ error: 'ID inválido' });
  }

  try {
    const query = `
      SELECT
        u.id,
        u.nome,
        u.sobrenome,
        CONCAT(u.nome, ' ', u.sobrenome) as nomeCompleto,
        u.tipoProfissional,
        u.especialidadeMedica,
        u.email,
        u.telefone,
        u.ufRegiao,
        u.cidade,
        u.modalidade,
        u.publicoAtendido,
        u.valorConsulta,
        u.valorPresencial,
        u.valorOnline,
        u.valorDomiciliar,
        u.horariosAtendimento,
        u.diasAtendimento,
        u.descricao,
        ROUND(AVG(a.nota), 1) AS mediaAvaliacao,
        COUNT(a.id) AS totalAvaliacoes
      FROM usuario u
      LEFT JOIN avaliacoes a ON a.profissional_id = u.id
      WHERE u.id = ? AND u.tipoUsuario = 'profissional'
      GROUP BY u.id
      LIMIT 1
    `;
    
    const [rows] = await dbPromise.query(query, [id]);
    if (!rows.length) {
      return res.status(404).json({ error: 'Profissional não encontrado' });
    }
    
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar profissional' });
  }
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

