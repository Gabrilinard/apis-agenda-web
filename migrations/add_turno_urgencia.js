require('dotenv').config();
const { pool } = require('../src/db');

const sql = `
  ALTER TABLE reservas
  ADD COLUMN turno_urgencia VARCHAR(100) NULL
`;

pool.query(sql, (err, result) => {
  if (err) {
    if (err.code === 'ER_DUP_FIELDNAME') {
      console.log('Coluna turno_urgencia já existe na tabela reservas.');
    } else {
      console.error('Erro ao adicionar coluna turno_urgencia:', err);
    }
  } else {
    console.log('Coluna turno_urgencia adicionada com sucesso!');
  }
  process.exit(0);
});
