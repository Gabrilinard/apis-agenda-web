const { dbPromise, pool } = require('../db');

const findByEmail = async (email) => {
  const [rows] = await dbPromise.query('SELECT * FROM usuario WHERE email = ? LIMIT 1', [email]);
  return rows && rows[0] ? rows[0] : null;
};

const findBasicById = (id, cb) => {
  pool.query('SELECT id, nome, email, tipoUsuario FROM usuario WHERE id = ? LIMIT 1', [id], (err, rows) => {
    if (err) return cb(err);
    cb(null, rows && rows[0] ? rows[0] : null);
  });
};

const findIdByEmail = (email, cb) => {
  pool.query('SELECT id FROM usuario WHERE email = ? LIMIT 1', [email], (err, rows) => {
    if (err) return cb(err);
    cb(null, rows && rows[0] ? rows[0] : null);
  });
};

const findByCpf = (cpfLimpo, cb) => {
  pool.query('SELECT id, nome, sobrenome, email, telefone, cpf FROM usuario WHERE cpf = ? LIMIT 1', [cpfLimpo], (err, rows) => {
    if (err) return cb(err);
    cb(null, rows && rows[0] ? rows[0] : null);
  });
};

const findFullByCpf = async (cpfLimpo) => {
  const [rows] = await dbPromise.query('SELECT * FROM usuario WHERE cpf = ? LIMIT 1', [cpfLimpo]);
  return rows && rows[0] ? rows[0] : null;
};

const cpfExists = async (cpfLimpo) => {
  const [rows] = await dbPromise.query('SELECT id FROM usuario WHERE cpf = ? LIMIT 1', [cpfLimpo]);
  return Array.isArray(rows) && rows.length > 0;
};

const emailExists = async (email) => {
  const [rows] = await dbPromise.query('SELECT id FROM usuario WHERE email = ? LIMIT 1', [email]);
  return Array.isArray(rows) && rows.length > 0;
};

const numeroConselhoExists = async (numero) => {
  const [rows] = await dbPromise.query('SELECT id FROM usuario WHERE numeroConselho = ? LIMIT 1', [numero]);
  return Array.isArray(rows) && rows.length > 0;
};

const insertUser = (query, values, cb) => {
  pool.query(query, values, cb);
};

const updatePassword = (id, hashedPassword, cb) => {
  pool.query('UPDATE usuario SET senha = ? WHERE id = ?', [hashedPassword, id], cb);
};

const createResetToken = async (userId, token) => {
  await dbPromise.query('DELETE FROM reset_tokens WHERE user_id = ?', [userId]);
  await dbPromise.query('INSERT INTO reset_tokens (user_id, token) VALUES (?, ?)', [userId, token]);
};

const findResetToken = async (token) => {
  const [rows] = await dbPromise.query(
    'SELECT rt.user_id, u.email, u.nome FROM reset_tokens rt JOIN usuario u ON u.id = rt.user_id WHERE rt.token = ? AND rt.created_at > NOW() - INTERVAL 1 HOUR LIMIT 1',
    [token]
  );
  return rows && rows[0] ? rows[0] : null;
};

const deleteResetToken = async (token) => {
  await dbPromise.query('DELETE FROM reset_tokens WHERE token = ?', [token]);
};

const updatePasswordAsync = async (id, hashedPassword) => {
  await dbPromise.query('UPDATE usuario SET senha = ? WHERE id = ?', [hashedPassword, id]);
};

const listLoggedUsers = (cb) => {
  const query = `
    SELECT DISTINCT 
      u.id, 
      u.nome, 
      u.sobrenome, 
      u.telefone, 
      u.email 
    FROM usuario u
    INNER JOIN reservas r ON u.id = r.usuario_id
    ORDER BY u.nome ASC;
  `;
  pool.query(query, cb);
};

const getUserInfoById = (id, cb) => {
  const query =
    'SELECT id, nome, sobrenome, email, telefone, tipoProfissional, especialidadeMedica, profissaoCustomizada, numeroConselho, latitude, longitude, cidade, ufRegiao, descricao, publicoAtendido, modalidade, valorConsulta, diasAtendimento, horariosAtendimento FROM usuario WHERE id = ?';
  pool.query(query, [id], (err, rows) => {
    if (err) return cb(err);
    cb(null, rows && rows[0] ? rows[0] : null);
  });
};

const updateLocation = (id, payload, cb) => {
  const { latitude, longitude, cidade, ufRegiao } = payload;
  pool.query(
    'UPDATE usuario SET latitude = ?, longitude = ?, cidade = ?, ufRegiao = ? WHERE id = ?',
    [latitude, longitude, cidade, ufRegiao, id],
    cb
  );
};

const updatePerfil = (id, payload, cb) => {
  const updates = [];
  const values = [];

  if (payload.nome !== undefined) {
    updates.push('nome = ?');
    values.push(payload.nome);
  }
  if (payload.sobrenome !== undefined) {
    updates.push('sobrenome = ?');
    values.push(payload.sobrenome);
  }
  if (payload.telefone !== undefined) {
    updates.push('telefone = ?');
    values.push(payload.telefone);
  }

  if (updates.length === 0) return cb(null, { affectedRows: 0 });

  values.push(id);
  pool.query(`UPDATE usuario SET ${updates.join(', ')} WHERE id = ?`, values, cb);
};

const updateInformacoes = (id, payload, cb) => {
  const updates = [];
  const values = [];

  if (payload.tipoProfissional !== undefined) {
    updates.push('tipoProfissional = ?');
    values.push(payload.tipoProfissional);
  }
  if (payload.descricao !== undefined) {
    updates.push('descricao = ?');
    values.push(payload.descricao);
  }
  if (payload.publicoAtendido !== undefined) {
    updates.push('publicoAtendido = ?');
    values.push(payload.publicoAtendido);
  }
  if (payload.modalidade !== undefined) {
    updates.push('modalidade = ?');
    values.push(payload.modalidade);
  }
  if (payload.valorConsulta !== undefined) {
    updates.push('valorConsulta = ?');
    values.push(payload.valorConsulta);
  }
  if (payload.diasAtendimento !== undefined) {
    updates.push('diasAtendimento = ?');
    values.push(typeof payload.diasAtendimento === 'object' ? JSON.stringify(payload.diasAtendimento) : payload.diasAtendimento);
  }
  if (payload.horariosAtendimento !== undefined) {
    updates.push('horariosAtendimento = ?');
    values.push(
      typeof payload.horariosAtendimento === 'object' ? JSON.stringify(payload.horariosAtendimento) : payload.horariosAtendimento
    );
  }

  if (updates.length === 0) return cb(null, { affectedRows: 0 });

  values.push(id);
  pool.query(`UPDATE usuario SET ${updates.join(', ')} WHERE id = ?`, values, cb);
};

module.exports = {
  findByEmail,
  findBasicById,
  findIdByEmail,
  findByCpf,
  findFullByCpf,
  cpfExists,
  emailExists,
  numeroConselhoExists,
  insertUser,
  updatePassword,
  createResetToken,
  findResetToken,
  deleteResetToken,
  updatePasswordAsync,
  listLoggedUsers,
  getUserInfoById,
  updateLocation,
  updateInformacoes,
  updatePerfil
};

