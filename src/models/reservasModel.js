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
    arquivo_urgencia
  } = payload;

  const sql =
    'INSERT INTO reservas (nome, sobrenome, telefone, email, dia, horario, horarioFinal, qntd_pessoa, usuario_id, profissional_id, status, is_urgente, descricao_urgencia, arquivo_urgencia) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
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
      arquivo_urgencia
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

const setNegado = (id, status, motivoNegacao, cb) => {
  const sql = `UPDATE reservas SET status = ? ${status === 'negado' ? ', motivoNegacao = ?' : ', motivoNegacao = NULL'} WHERE id = ?`;
  const params = status === 'negado' ? [status, motivoNegacao, id] : [status, id];
  pool.query(sql, params, cb);
};

const editarReserva = async (id, payload) => {
  const { dia, horario, horarioFinal, qntd_pessoa } = payload;
  await dbPromise.query('UPDATE reservas SET dia = ?, horario = ?, horarioFinal = ?, qntd_pessoa = ?, status = ? WHERE id = ?', [
    dia,
    horario,
    horarioFinal,
    qntd_pessoa,
    'pendente',
    id
  ]);
};

module.exports = {
  createReserva,
  getByUsuarioId,
  deleteByUsuarioHorarioDia,
  list,
  patchUpdate,
  updateReserva,
  deleteById,
  setAusente,
  listExtra,
  setNegado,
  editarReserva
};

