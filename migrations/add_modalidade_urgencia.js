require('dotenv').config();
const { pool } = require('../src/db');

const sql = `
  ALTER TABLE reservas
  ADD COLUMN modalidade_urgencia VARCHAR(30) NULL
`;

pool.query(sql, (err, result) => {
  if (err) {
    if (err.code === 'ER_DUP_FIELDNAME') {
      console.log('Coluna modalidade_urgencia já existe na tabela reservas.');
    } else {
      console.error('Erro ao adicionar coluna modalidade_urgencia:', err);
    }
  } else {
    console.log('Coluna modalidade_urgencia adicionada com sucesso!');
  }
  process.exit(0);
});
