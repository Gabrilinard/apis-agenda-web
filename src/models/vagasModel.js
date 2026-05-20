const { dbPromise } = require('../db');
const crypto = require('crypto');

// Returns up to 5 candidates: emergencies first, then next-day appointments
const getCandidatos = async (profissional_id, dia, excluir_usuario_id) => {
  const limit = 5;
  const excluir = parseInt(excluir_usuario_id, 10) || 0;
  const profId  = parseInt(profissional_id, 10) || 0;

  // 1. Emergency patients (is_urgente, still pending/confirmed)
  const [urgentes] = await dbPromise.query(`
    SELECT r.id AS reserva_id, u.id AS usuario_id, u.nome, u.sobrenome, u.email,
           r.dia, r.horario, 1 AS is_urgente, r.descricao_urgencia
    FROM reservas r
    JOIN usuario u ON r.usuario_id = u.id
    WHERE r.profissional_id = ?
      AND r.is_urgente = 1
      AND r.status IN ('pendente', 'confirmado')
      AND (? = 0 OR r.usuario_id != ?)
    ORDER BY r.id ASC
    LIMIT ?
  `, [profId, excluir, excluir, limit]);

  if (urgentes.length >= limit) return urgentes.slice(0, limit);

  // 2. Fill remaining slots — next upcoming unique patients after the freed slot date
  const remaining = limit - urgentes.length;
  const urgenteIds = urgentes.map(u => u.usuario_id);
  const [proximos] = await dbPromise.query(`
    SELECT MIN(r.id) AS reserva_id, u.id AS usuario_id, u.nome, u.sobrenome, u.email,
           MIN(r.dia) AS dia, MIN(r.horario) AS horario, 0 AS is_urgente, NULL AS descricao_urgencia
    FROM reservas r
    JOIN usuario u ON r.usuario_id = u.id
    WHERE r.profissional_id = ?
      AND r.dia > ?
      AND r.status IN ('confirmado', 'pendente')
      AND IFNULL(r.is_urgente, 0) = 0
      AND (? = 0 OR r.usuario_id != ?)
      ${urgenteIds.length ? `AND u.id NOT IN (${urgenteIds.map(() => '?').join(',')})` : ''}
    GROUP BY u.id, u.nome, u.sobrenome, u.email
    ORDER BY MIN(r.dia) ASC, MIN(r.horario) ASC
    LIMIT ?
  `, [profId, dia, excluir, excluir, ...urgenteIds, remaining]);

  return [...urgentes, ...proximos];
};

const criarNotificacao = async ({ profissional_id, reserva_liberada_id, dia, horario, horarioFinal, usuario_notificado_id, reserva_candidato_id }) => {
  const token = crypto.randomBytes(32).toString('hex');
  const [result] = await dbPromise.query(`
    INSERT INTO notificacoes_vaga
      (profissional_id, reserva_liberada_id, dia, horario, horarioFinal, usuario_notificado_id, reserva_candidato_id, token)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [profissional_id, reserva_liberada_id || null, dia, horario, horarioFinal || null, usuario_notificado_id, reserva_candidato_id || null, token]);

  return { id: result.insertId, token };
};

const getPendentesPorUsuario = async (usuario_id) => {
  const [rows] = await dbPromise.query(`
    SELECT n.*, u.nome AS prof_nome, u.sobrenome AS prof_sobrenome
    FROM notificacoes_vaga n
    JOIN usuario u ON n.profissional_id = u.id
    WHERE n.usuario_notificado_id = ?
      AND n.status = 'pendente'
    ORDER BY n.created_at DESC
  `, [usuario_id]);
  return rows;
};

const getNotificacaoPorIdEToken = async (id, token) => {
  const [rows] = await dbPromise.query(
    'SELECT * FROM notificacoes_vaga WHERE id = ? AND token = ? AND status = "pendente" LIMIT 1',
    [id, token]
  );
  return rows[0] || null;
};

const aceitarNotificacao = async (id) => {
  await dbPromise.query('UPDATE notificacoes_vaga SET status = "aceita" WHERE id = ?', [id]);
};

const recusarNotificacao = async (id) => {
  await dbPromise.query('UPDATE notificacoes_vaga SET status = "recusada" WHERE id = ?', [id]);
};

// Expire other pending notifications for the same slot (when one is accepted)
const expirarOutras = async (profissional_id, dia, horario, exceto_id) => {
  await dbPromise.query(
    'UPDATE notificacoes_vaga SET status = "expirada" WHERE profissional_id = ? AND dia = ? AND horario = ? AND id != ? AND status = "pendente"',
    [profissional_id, dia, horario, exceto_id]
  );
};

module.exports = { getCandidatos, criarNotificacao, getPendentesPorUsuario, getNotificacaoPorIdEToken, aceitarNotificacao, recusarNotificacao, expirarOutras };
