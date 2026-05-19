const mysql = require('mysql2');

const connection = mysql.createConnection({
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: 'REDACTED',
  database: 'agendamento'
});

const sql = `
  ALTER TABLE reservas 
  ADD COLUMN is_urgente BOOLEAN DEFAULT FALSE,
  ADD COLUMN descricao_urgencia TEXT NULL,
  ADD COLUMN arquivo_urgencia VARCHAR(255) NULL
`;

connection.query(sql, (err, result) => {
  if (err) {
    if (err.code === 'ER_DUP_FIELDNAME') {
      console.log('Colunas de urgência já existem na tabela reservas.');
    } else {
      console.error('Erro ao adicionar colunas de urgência:', err);
    }
  } else {
    console.log('Colunas de urgência adicionadas com sucesso!');
  }
  connection.end();
});
