const express = require('express');
const { dbPromise } = require('../db');

const router = express.Router();

router.get('/avaliacoes', async (req, res) => {
  const { profissional_id } = req.query;
  if (!profissional_id) return res.status(400).json({ error: 'profissional_id obrigatório' });
  try {
    const [rows] = await dbPromise.query(`
      SELECT a.id, a.nota, a.comentario, a.created_at,
             u.nome AS paciente_nome, u.sobrenome AS paciente_sobrenome
      FROM avaliacoes a
      JOIN usuario u ON u.id = a.usuario_id
      WHERE a.profissional_id = ?
      ORDER BY a.created_at DESC
    `, [profissional_id]);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/avaliacoes/media/:profissional_id', async (req, res) => {
  try {
    const [[row]] = await dbPromise.query(`
      SELECT ROUND(AVG(nota), 1) AS media, COUNT(*) AS total
      FROM avaliacoes WHERE profissional_id = ?
    `, [req.params.profissional_id]);
    res.json({ media: row.media || 0, total: row.total || 0 });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/avaliacoes/reserva/:reserva_id', async (req, res) => {
  try {
    const [[row]] = await dbPromise.query(
      'SELECT id FROM avaliacoes WHERE reserva_id = ?',
      [req.params.reserva_id]
    );
    res.json({ avaliado: !!row });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/avaliacoes', async (req, res) => {
  const { reserva_id, usuario_id, profissional_id, nota, comentario } = req.body;
  if (!reserva_id || !usuario_id || !profissional_id || !nota) {
    return res.status(400).json({ error: 'Campos obrigatórios ausentes' });
  }
  if (nota < 1 || nota > 5) return res.status(400).json({ error: 'Nota deve ser entre 1 e 5' });
  try {
    await dbPromise.query(
      'INSERT INTO avaliacoes (reserva_id, usuario_id, profissional_id, nota, comentario) VALUES (?, ?, ?, ?, ?)',
      [reserva_id, usuario_id, profissional_id, nota, comentario || null]
    );
    res.status(201).json({ ok: true });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Consulta já avaliada' });
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
