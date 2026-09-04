const { dbPromise, pool } = require('../db');

const findByEmail = async (email) => {
  const [rows] = await dbPromise.query('SELECT * FROM usuario WHERE email = ? LIMIT 1', [email]);
  return rows && rows[0] ? rows[0] : null;
};

const findBasicById = (id, cb) => {
  pool.query('SELECT id, nome, sobrenome, telefone, email, cpf, genero, tipoUsuario, tipoProfissional FROM usuario WHERE id = ? LIMIT 1', [id], (err, rows) => {
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
    'SELECT id, tipoUsuario, nome, sobrenome, email, telefone, genero, tipoProfissional, especialidadeMedica, profissaoCustomizada, numeroConselho, latitude, longitude, cidade, ufRegiao, descricao, publicoAtendido, modalidade, valorConsulta, valorPresencial, valorOnline, valorDomiciliar, diasAtendimento, horariosAtendimento, aceitandoConsultas FROM usuario WHERE id = ?';
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
  if (payload.genero !== undefined) {
    updates.push('genero = ?');
    values.push(payload.genero);
  }

  if (updates.length === 0) return cb(null, { affectedRows: 0 });

  values.push(id);
  pool.query(`UPDATE usuario SET ${updates.join(', ')} WHERE id = ?`, values, cb);
};

const updateInformacoes = (id, payload, cb) => {
  const updates = [];
  const values = [];

  if (payload.genero !== undefined) {
    updates.push('genero = ?');
    values.push(payload.genero);
  }
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
  if (payload.valorPresencial !== undefined) {
    updates.push('valorPresencial = ?');
    values.push(payload.valorPresencial);
  }
  if (payload.valorOnline !== undefined) {
    updates.push('valorOnline = ?');
    values.push(payload.valorOnline);
  }
  if (payload.valorDomiciliar !== undefined) {
    updates.push('valorDomiciliar = ?');
    values.push(payload.valorDomiciliar);
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
  if (payload.aceitandoConsultas !== undefined) {
    updates.push('aceitandoConsultas = ?');
    values.push(payload.aceitandoConsultas ? 1 : 0);
  }

  if (updates.length === 0) return cb(null, { affectedRows: 0 });

  values.push(id);
  pool.query(`UPDATE usuario SET ${updates.join(', ')} WHERE id = ?`, values, cb);
};

const BLOQUEIO_DIAS = 60;

const contarAusenciasPosConfirmacao = async (usuario_id) => {
  const [[usuario]] = await dbPromise.query('SELECT bloqueado_ate FROM usuario WHERE id = ?', [usuario_id]);
  const bloqueioExpirado = usuario?.bloqueado_ate && new Date(usuario.bloqueado_ate) <= new Date();

  const query = bloqueioExpirado
    ? `SELECT COUNT(*) AS total FROM reservas
       WHERE usuario_id = ? AND status = 'ausente' AND presenca_confirmada = 1 AND dia > ?`
    : `SELECT COUNT(*) AS total FROM reservas
       WHERE usuario_id = ? AND status = 'ausente' AND presenca_confirmada = 1`;
  const params = bloqueioExpirado ? [usuario_id, usuario.bloqueado_ate] : [usuario_id];

  const [[row]] = await dbPromise.query(query, params);
  return row.total;
};

const bloquearTemporariamente = async (usuario_id, motivo) => {
  await dbPromise.query(
    'UPDATE usuario SET bloqueado_ate = NOW() + INTERVAL ? DAY, motivo_bloqueio = ? WHERE id = ?',
    [BLOQUEIO_DIAS, motivo, usuario_id]
  );
  const [[row]] = await dbPromise.query('SELECT bloqueado_ate, cpf FROM usuario WHERE id = ?', [usuario_id]);

  if (row?.cpf) {
    // Guarda o bloqueio pelo CPF também: se a conta for excluída e recriada
    // com o mesmo CPF, o bloqueio precisa continuar valendo (ver aplicarBloqueioCpfSeExistir).
    await dbPromise.query(
      `INSERT INTO bloqueios_cpf (cpf, bloqueado_ate, motivo_bloqueio)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE
         bloqueado_ate = GREATEST(bloqueado_ate, VALUES(bloqueado_ate)),
         motivo_bloqueio = VALUES(motivo_bloqueio)`,
      [row.cpf, row.bloqueado_ate, motivo]
    );
  }

  return row.bloqueado_ate;
};

const aplicarBloqueioCpfSeExistir = async (usuario_id, cpf) => {
  const [[row]] = await dbPromise.query('SELECT bloqueado_ate, motivo_bloqueio FROM bloqueios_cpf WHERE cpf = ?', [cpf]);
  if (!row || !row.bloqueado_ate || new Date(row.bloqueado_ate) <= new Date()) return null;

  await dbPromise.query('UPDATE usuario SET bloqueado_ate = ?, motivo_bloqueio = ? WHERE id = ?', [
    row.bloqueado_ate,
    row.motivo_bloqueio,
    usuario_id,
  ]);
  return row;
};

const getBloqueio = async (usuario_id) => {
  const [[row]] = await dbPromise.query('SELECT bloqueado_ate, motivo_bloqueio FROM usuario WHERE id = ?', [usuario_id]);
  if (!row || !row.bloqueado_ate || new Date(row.bloqueado_ate) <= new Date()) return null;
  return row;
};

const getStatusAusencia = async (usuario_id) => {
  const totalAusencias = await contarAusenciasPosConfirmacao(usuario_id);
  const [[row]] = await dbPromise.query('SELECT bloqueado_ate, motivo_bloqueio FROM usuario WHERE id = ?', [usuario_id]);
  const bloqueadoAtivo = row && row.bloqueado_ate && new Date(row.bloqueado_ate) > new Date();
  return {
    totalAusencias,
    bloqueadoAte: bloqueadoAtivo ? row.bloqueado_ate : null,
    motivoBloqueio: bloqueadoAtivo ? row.motivo_bloqueio : null,
  };
};

const excluirConta = async (usuarioId) => {
  const [reservasDoUsuario] = await dbPromise.query(
    'SELECT arquivo_urgencia FROM reservas WHERE usuario_id = ? AND arquivo_urgencia IS NOT NULL',
    [usuarioId]
  );
  const arquivosLocais = reservasDoUsuario.map((r) => r.arquivo_urgencia).filter(Boolean);

  const [formulariosDoUsuario] = await dbPromise.query(
    `SELECT f.conteudo FROM formularios f
     JOIN reservas r ON r.id = f.reserva_id
     WHERE r.usuario_id = ?`,
    [usuarioId]
  );
  formulariosDoUsuario.forEach((f) => {
    try {
      const conteudo = JSON.parse(f.conteudo);
      if (conteudo && conteudo.anexoExame) arquivosLocais.push(conteudo.anexoExame);
    } catch {
      // conteúdo não é um JSON válido — sem anexo a limpar aqui
    }
  });

  await dbPromise.query('DELETE FROM notificacoes_vaga WHERE profissional_id = ? OR usuario_notificado_id = ?', [usuarioId, usuarioId]);
  await dbPromise.query('DELETE FROM notificacoes_profissional WHERE profissional_id = ?', [usuarioId]);
  await dbPromise.query('DELETE FROM notificacoes_paciente WHERE usuario_id = ?', [usuarioId]);

  const [result] = await dbPromise.query('DELETE FROM usuario WHERE id = ?', [usuarioId]);

  return { affectedRows: result.affectedRows, arquivosLocais };
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
  updatePerfil,
  contarAusenciasPosConfirmacao,
  bloquearTemporariamente,
  getBloqueio,
  getStatusAusencia,
  aplicarBloqueioCpfSeExistir,
  BLOQUEIO_DIAS,
  excluirConta,
};

