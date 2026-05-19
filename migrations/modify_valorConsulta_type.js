
const mysql = require('mysql2');

const db = mysql.createConnection({
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: 'REDACTED',
  database: 'agendamento'
});

db.connect((err) => {
  if (err) {
    console.error('Erro ao conectar ao banco de dados:', err);
    process.exit(1);
  }
  console.log('Conectado ao banco de dados.');

  const sql = "ALTER TABLE usuario MODIFY COLUMN valorConsulta VARCHAR(50) NULL";

  db.query(sql, (err, result) => {
    if (err) {
      console.error('Erro ao modificar coluna valorConsulta:', err);
      process.exit(1);
    }
    console.log('Coluna valorConsulta modificada para VARCHAR(50) com sucesso!');
    console.log('Resultado:', result);
    db.end();
  });
});
