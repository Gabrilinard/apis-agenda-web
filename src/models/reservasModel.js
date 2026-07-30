const { dbPromise, pool } = require('../db');

const createReserva = (payload, cb) => {
  const {
    nome,
    sobrenome,
    telefone,
    email,
    dia,
    horario,
    horarioFinal,
    qntd_pessoa,
    usuario_id,
    profissional_id,
    status,
    is_urgente,
    descricao_urgencia,
    arquivo_urgencia,
    modalidade_urgencia,
    turno_urgencia,
    modalidade,
    valor
  } = payload;

  const sql =
    'INSERT INTO reservas (nome, sobrenome, telefone, email, dia, horario, horarioFinal, qntd_pessoa, usuario_id, profissional_id, status, is_urgente, descricao_urgencia, arquivo_urgencia, modalidade_urgencia, turno_urgencia, modalidade, valor) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
  pool.query(
    sql,
    [
      nome,
      sobrenome,
      telefone,
      email,
      dia,
      horario,
      horarioFinal,
      qntd_pessoa,
      usuario_id,
      profissional_id,
      status,
      is_urgente,
      descricao_urgencia,
      arquivo_urgencia,
      modalidade_urgencia || null,
      turno_urgencia || null,
      modalidade || null,
      valor || null
    ],
    cb
  );
};

const getByUsuarioId = (usuarioId, cb) => {
  pool.query('SELECT * FROM reservas WHERE usuario_id = ?', [usuarioId], cb);
};

const deleteByUsuarioHorarioDia = (usuario, horario, dia, cb) => {
  pool.query('DELETE FROM reservas WHERE usuario_id = ? AND horario = ? AND dia = ?', [usuario, horario, dia], cb);
};

const list = (filters, cb) => {
  const { profissional_id, usuario_id } = filters || {};
  let query = 'SELECT * FROM reservas';
  const queryParams = [];
  const whereConditions = [];

  if (usuario_id) {
    whereConditions.push('usuario_id = ?');
    queryParams.push(usuario_id);
  }

  if (profissional_id) {
    whereConditions.push('profissional_id = ?');
    queryParams.push(profissional_id);
  }

  if (whereConditions.length > 0) {
    query += ' WHERE ' + whereConditions.join(' AND ');
  }

  pool.query(query, queryParams, cb);
};

const patchUpdate = (id, payload, cb) => {
  const { status, dia, horario, horarioFinal, is_urgente } = payload;
  const updates = [];
  const values = [];

  if (status !== undefined) {
    updates.push('status = ?');
    values.push(status);
  }
  if (dia !== undefined) {
    updates.push('dia = ?');
    values.push(dia);
  }
  if (horario !== undefined) {
    updates.push('horario = ?');
    values.push(horario);
  }
  if (dia !== undefined || horario !== undefined) {
    updates.push('reagendado_em = NOW()');
  }
  if (horarioFinal !== undefined) {
    updates.push('horarioFinal = ?');
    values.push(horarioFinal);
  }
  if (is_urgente !== undefined) {
    updates.push('is_urgente = ?');
    values.push(is_urgente ? 1 : 0);
  }

  if (updates.length === 0) return cb(null, { affectedRows: 1 });

  values.push(id);
  pool.query(`UPDATE reservas SET ${updates.join(', ')} WHERE id = ?`, values, cb);
};

const updateReserva = async (id, payload) => {
  const { dia, horario, qntd_pessoa } = payload;
  const [exist] = await dbPromise.query('SELECT * FROM reservas WHERE id = ? LIMIT 1', [id]);
  if (!exist || exist.length === 0) return { found: false };
  const [result] = await dbPromise.query('UPDATE reservas SET dia = ?, horario = ?, qntd_pessoa = ? WHERE id = ?', [
    dia,
    horario,
    qntd_pessoa,
    id
  ]);
  return { found: result.affectedRows > 0 };
};

const deleteById = (id, cb) => {
  pool.query('DELETE FROM reservas WHERE id = ?', [id], cb);
};

const setAusente = (id, motivoFalta, cb) => {
  pool.query('UPDATE reservas SET status = ?, motivoFalta = ? WHERE id = ?', ['ausente', motivoFalta, id], cb);
};

const listExtra = (cb) => {
  const query = `
    SELECT 
      reservas.id, 
      reservas.dia, 
      reservas.horario, 
      usuario.nome, 
      usuario.sobrenome, 
      usuario.email 
    FROM reservas
    JOIN usuario ON reservas.usuario_id = usuario.id
  `;
  pool.query(query, cb);
};

const negarConflitantes = (id, profissional_id, dia, horario, cb) => {
  if (!profissional_id || !dia || !horario) return cb(null, { affectedRows: 0 });
  const sql = `
    UPDATE reservas
    SET status = 'negado', motivoNegacao = 'Horário preenchido por outro paciente'
    WHERE id != ? AND profissional_id = ? AND dia = ? AND horario = ? AND status != 'negado'
  `;
  pool.query(sql, [id, profissional_id, dia, horario], cb);
};

const getConflitantes = (id, profissional_id, dia, horario, cb) => {
  if (!profissional_id || !dia || !horario) return cb(null, []);
  const sql = `
    SELECT r.id, u.nome AS pac_nome, u.sobrenome AS pac_sobrenome, u.email AS pac_email
    FROM reservas r
    LEFT JOIN usuario u ON r.usuario_id = u.id
    WHERE r.id != ? AND r.profissional_id = ? AND r.dia = ? AND r.horario = ? AND r.status != 'negado'
  `;
  pool.query(sql, [id, profissional_id, dia, horario], cb);
};

const setNegado = (id, status, motivoNegacao, cb) => {
  const sql = `UPDATE reservas SET status = ? ${status === 'negado' ? ', motivoNegacao = ?' : ', motivoNegacao = NULL'} WHERE id = ?`;
  const params = status === 'negado' ? [status, motivoNegacao, id] : [status, id];
  pool.query(sql, params, cb);
};

const editarReserva = async (id, payload) => {
  const { dia, horario, horarioFinal, qntd_pessoa } = payload;
  await dbPromise.query('UPDATE reservas SET dia = ?, horario = ?, horarioFinal = ?, qntd_pessoa = ?, status = ?, reagendado_em = NOW() WHERE id = ?', [
    dia,
    horario,
    horarioFinal,
    qntd_pessoa,
    'pendente',
    id
  ]);
};

const listUrgenciasSemRespostaHaUmaHora = async () => {
  const sql = `
    SELECT r.id, r.dia, r.horario, r.descricao_urgencia, r.created_at,
           pac.nome AS pac_nome, pac.sobrenome AS pac_sobrenome, pac.email AS pac_email, pac.telefone AS pac_telefone,
           prof.nome AS prof_nome, prof.sobrenome AS prof_sobrenome, prof.email AS prof_email, prof.genero AS prof_genero
    FROM reservas r
    LEFT JOIN usuario pac ON r.usuario_id = pac.id
    LEFT JOIN usuario prof ON r.profissional_id = prof.id
    WHERE r.is_urgente = 1
      AND r.status = 'pendente'
      AND r.created_at <= NOW() - INTERVAL 1 HOUR
      AND (r.lembrete_urgencia_enviado_em IS NULL OR r.lembrete_urgencia_enviado_em <= NOW() - INTERVAL 1 HOUR)
      AND prof.email IS NOT NULL
      AND pac.email IS NOT NULL
  `;
  const [rows] = await dbPromise.query(sql);
  return rows;
};

const marcarLembreteUrgenciaEnviado = async (id) => {
  await dbPromise.query('UPDATE reservas SET lembrete_urgencia_enviado_em = NOW() WHERE id = ?', [id]);
};

const listParaLembretePresenca = async () => {
  const sql = `
    SELECT r.id, r.dia, r.horario, r.usuario_id,
           pac.nome AS pac_nome, pac.sobrenome AS pac_sobrenome, pac.email AS pac_email,
           prof.nome AS prof_nome, prof.sobrenome AS prof_sobrenome, prof.genero AS prof_genero
    FROM reservas r
    LEFT JOIN usuario pac ON r.usuario_id = pac.id
    LEFT JOIN usuario prof ON r.profissional_id = prof.id
    WHERE r.status = 'confirmado'
      AND r.presenca_confirmada = 0
      AND r.confirmacao_presenca_enviada = 0
      AND TIMESTAMP(r.dia, r.horario) > NOW()
      AND TIMESTAMP(r.dia, r.horario) <= NOW() + INTERVAL 48 HOUR
      AND pac.email IS NOT NULL
  `;
  const [rows] = await dbPromise.query(sql);
  return rows;
};

const marcarConfirmacaoPresencaEnviada = async (id) => {
  await dbPromise.query('UPDATE reservas SET confirmacao_presenca_enviada = 1 WHERE id = ?', [id]);
};

const confirmarPresenca = async (id, usuario_id) => {
  const [result] = await dbPromise.query(
    'UPDATE reservas SET presenca_confirmada = 1 WHERE id = ? AND usuario_id = ?',
    [id, usuario_id]
  );
  return result.affectedRows > 0;
};

// Consultas confirmadas que entraram na janela final (15h antes) sem que o
// paciente tenha confirmado presença — liberadas automaticamente para outro paciente.
const listParaAutoLiberarPorFaltaConfirmacao = async () => {
  const sql = `
    SELECT r.id, r.dia, r.horario,
           pac.nome AS pac_nome, pac.sobrenome AS pac_sobrenome, pac.email AS pac_email,
           prof.id AS prof_id, prof.nome AS prof_nome, prof.sobrenome AS prof_sobrenome,
           prof.email AS prof_email, prof.genero AS prof_genero
    FROM reservas r
    LEFT JOIN usuario pac ON r.usuario_id = pac.id
    LEFT JOIN usuario prof ON r.profissional_id = prof.id
    WHERE r.status = 'confirmado'
      AND r.presenca_confirmada = 0
      AND r.confirmacao_presenca_enviada = 1
      AND TIMESTAMP(r.dia, r.horario) > NOW()
      AND TIMESTAMP(r.dia, r.horario) <= NOW() + INTERVAL 15 HOUR
  `;
  const [rows] = await dbPromise.query(sql);
  return rows;
};

const autoLiberarPorFaltaConfirmacao = async (id) => {
  await dbPromise.query("UPDATE reservas SET status = 'liberado' WHERE id = ?", [id]);
};

module.exports = {
  createReserva,
  listUrgenciasSemRespostaHaUmaHora,
  marcarLembreteUrgenciaEnviado,
  getByUsuarioId,
  deleteByUsuarioHorarioDia,
  list,
  patchUpdate,
  updateReserva,
  deleteById,
  setAusente,
  listExtra,
  setNegado,
  editarReserva,
  negarConflitantes,
  getConflitantes,
  listParaLembretePresenca,
  marcarConfirmacaoPresencaEnviada,
  confirmarPresenca,
  listParaAutoLiberarPorFaltaConfirmacao,
  autoLiberarPorFaltaConfirmacao,
};

