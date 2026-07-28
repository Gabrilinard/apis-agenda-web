const { dbPromise } = require('../db');
const crypto = require('crypto');

const getCandidatos = async (profissional_id, dia, excluir_usuario_id, reserva_liberada_id) => {
  const NON_URGENT_LIMIT = 5;
  const excluir = parseInt(excluir_usuario_id, 10) || 0;
  const profId  = parseInt(profissional_id, 10) || 0;
  const liberadaId = parseInt(reserva_liberada_id, 10) || 0;

  const temSaldo = `(
    (SELECT COUNT(*) FROM reservas r3 WHERE r3.usuario_id = u.id AND r3.profissional_id = ? AND r3.status IN ('pendente', 'confirmado'))
    >
    (SELECT COUNT(*) FROM notificacoes_vaga nv3 WHERE nv3.usuario_notificado_id = u.id AND nv3.profissional_id = ? AND nv3.status = 'aceita')
  )`;

  const [urgentes] = await dbPromise.query(`
    SELECT r.id AS reserva_id, u.id AS usuario_id, u.nome, u.sobrenome, u.email,
           r.dia, r.horario, 1 AS is_urgente, r.descricao_urgencia,
           EXISTS(
             SELECT 1 FROM notificacoes_vaga nv
             WHERE nv.usuario_notificado_id = u.id AND nv.profissional_id = ?
               AND nv.reserva_liberada_id = ? AND nv.status = 'pendente'
           ) AS notificado
    FROM reservas r
    JOIN usuario u ON r.usuario_id = u.id
    WHERE r.profissional_id = ?
      AND r.is_urgente = 1
      AND r.status IN ('pendente', 'confirmado')
      AND r.dia > ?
      AND (? = 0 OR r.usuario_id != ?)
      AND ${temSaldo}
    ORDER BY r.id ASC
  `, [profId, liberadaId, profId, dia, excluir, excluir, profId, profId]);

  const urgenteIds = urgentes.map(u => u.usuario_id);
  const [proximos] = await dbPromise.query(`
    SELECT MIN(r.id) AS reserva_id, u.id AS usuario_id, u.nome, u.sobrenome, u.email,
           MIN(r.dia) AS dia, MIN(r.horario) AS horario, 0 AS is_urgente, NULL AS descricao_urgencia,
           EXISTS(
             SELECT 1 FROM notificacoes_vaga nv
             WHERE nv.usuario_notificado_id = u.id AND nv.profissional_id = ?
               AND nv.reserva_liberada_id = ? AND nv.status = 'pendente'
           ) AS notificado
    FROM reservas r
    JOIN usuario u ON r.usuario_id = u.id
    WHERE r.profissional_id = ?
      AND r.dia > ?
      AND r.status IN ('confirmado', 'pendente')
      AND IFNULL(r.is_urgente, 0) = 0
      AND (? = 0 OR r.usuario_id != ?)
      AND ${temSaldo}
      ${urgenteIds.length ? `AND u.id NOT IN (${urgenteIds.map(() => '?').join(',')})` : ''}
    GROUP BY u.id, u.nome, u.sobrenome, u.email
    ORDER BY MIN(r.dia) ASC, MIN(r.horario) ASC
    LIMIT ?
  `, [profId, liberadaId, profId, dia, excluir, excluir, profId, profId, ...urgenteIds, NON_URGENT_LIMIT]);

  return [...urgentes, ...proximos].map(c => ({ ...c, notificado: !!c.notificado }));
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
    SELECT n.*, u.nome AS prof_nome, u.sobrenome AS prof_sobrenome, u.genero AS prof_genero
    FROM notificacoes_vaga n
    JOIN usuario u ON n.profissional_id = u.id
    WHERE n.usuario_notificado_id = ?
      AND n.status = 'pendente'
    ORDER BY n.created_at DESC
  `, [usuario_id]);

  if (rows.length === 0) return rows;

  const profissionalIds = [...new Set(rows.map((r) => r.profissional_id))];
  const placeholders = profissionalIds.map(() => '?').join(',');

  const [totalPorProf] = await dbPromise.query(`
    SELECT profissional_id, COUNT(*) AS total
    FROM reservas
    WHERE usuario_id = ? AND profissional_id IN (${placeholders}) AND status IN ('pendente', 'confirmado')
    GROUP BY profissional_id
  `, [usuario_id, ...profissionalIds]);

  const [aceitasPorProf] = await dbPromise.query(`
    SELECT profissional_id, COUNT(*) AS total
    FROM notificacoes_vaga
    WHERE usuario_notificado_id = ? AND profissional_id IN (${placeholders}) AND status = 'aceita'
    GROUP BY profissional_id
  `, [usuario_id, ...profissionalIds]);

  const totalMap = Object.fromEntries(totalPorProf.map((d) => [d.profissional_id, d.total]));
  const aceitasMap = Object.fromEntries(aceitasPorProf.map((d) => [d.profissional_id, d.total]));

  const profissionaisComSaldo = new Set(
    profissionalIds.filter((id) => (totalMap[id] || 0) - (aceitasMap[id] || 0) > 0)
  );

  const validas = rows.filter((r) => profissionaisComSaldo.has(r.profissional_id));
  const invalidasIds = rows.filter((r) => !profissionaisComSaldo.has(r.profissional_id)).map((r) => r.id);

  if (invalidasIds.length > 0) {
    await dbPromise.query(
      `UPDATE notificacoes_vaga SET status = 'expirada' WHERE id IN (${invalidasIds.map(() => '?').join(',')})`,
      invalidasIds
    );
  }

  return validas;
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

const expirarOutras = async (profissional_id, dia, horario, exceto_id) => {
  await dbPromise.query(
    'UPDATE notificacoes_vaga SET status = "expirada" WHERE profissional_id = ? AND dia = ? AND horario = ? AND id != ? AND status = "pendente"',
    [profissional_id, dia, horario, exceto_id]
  );
};

const getReservasCandidatoDisponiveis = async (usuario_id, profissional_id) => {
  const [rows] = await dbPromise.query(`
    SELECT id, dia, horario, is_urgente
    FROM reservas
    WHERE usuario_id = ? AND profissional_id = ? AND status IN ('pendente', 'confirmado')
    ORDER BY created_at DESC, id DESC
  `, [usuario_id, profissional_id]);
  return rows;
};

const contarNotificacoesAceitas = async (usuario_notificado_id, profissional_id, exceto_id) => {
  const [[row]] = await dbPromise.query(`
    SELECT COUNT(*) AS total FROM notificacoes_vaga
    WHERE usuario_notificado_id = ? AND profissional_id = ? AND status = 'aceita' AND id != ?
  `, [usuario_notificado_id, profissional_id, exceto_id]);
  return row.total;
};

const expirarPendentesSemReserva = async (usuario_notificado_id, profissional_id, exceto_id) => {
  await dbPromise.query(
    'UPDATE notificacoes_vaga SET status = "expirada" WHERE usuario_notificado_id = ? AND profissional_id = ? AND id != ? AND status = "pendente"',
    [usuario_notificado_id, profissional_id, exceto_id]
  );
};

const criarNotificacaoProfissional = async ({ profissional_id, reserva_id, mensagem }) => {
  await dbPromise.query(
    'INSERT INTO notificacoes_profissional (profissional_id, reserva_id, mensagem) VALUES (?, ?, ?)',
    [profissional_id, reserva_id || null, mensagem]
  );
};

const listarNotificacoesProfissional = async (profissional_id) => {
  const [rows] = await dbPromise.query(
    'SELECT * FROM notificacoes_profissional WHERE profissional_id = ? ORDER BY created_at DESC LIMIT 20',
    [profissional_id]
  );
  return rows;
};

const marcarNotificacoesProfissionalLidas = async (profissional_id) => {
  await dbPromise.query(
    'UPDATE notificacoes_profissional SET lida = 1 WHERE profissional_id = ? AND lida = 0',
    [profissional_id]
  );
};

// Pacientes que estão com uma notificação de vaga pendente (ainda não aceitaram nem
// recusaram) com esse profissional — usado para mostrar o badge "Notificado" na lista
// de Solicitações, além da própria tela de Vagas.
const listarUsuariosNotificadosPendentes = async (profissional_id) => {
  const [rows] = await dbPromise.query(
    'SELECT DISTINCT usuario_notificado_id FROM notificacoes_vaga WHERE profissional_id = ? AND status = "pendente"',
    [profissional_id]
  );
  return rows.map((r) => r.usuario_notificado_id);
};

module.exports = {
  getCandidatos,
  criarNotificacao,
  getPendentesPorUsuario,
  getNotificacaoPorIdEToken,
  aceitarNotificacao,
  recusarNotificacao,
  expirarOutras,
  getReservasCandidatoDisponiveis,
  contarNotificacoesAceitas,
  expirarPendentesSemReserva,
  criarNotificacaoProfissional,
  listarNotificacoesProfissional,
  marcarNotificacoesProfissionalLidas,
  listarUsuariosNotificadosPendentes,
};
