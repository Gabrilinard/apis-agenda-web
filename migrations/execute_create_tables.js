const mysql = require('mysql2');
const fs = require('fs');
const path = require('path');

const db = mysql.createConnection({
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: 'REDACTED',
  multipleStatements: true
});

db.connect(err => {
  if (err) {
    console.error('Erro ao conectar ao banco de dados:', err.message);
    return;
  }
  console.log('Conectado ao banco de dados!');

  const sqlFile = path.join(__dirname, 'create_tables.sql');
  const sql = fs.readFileSync(sqlFile, 'utf8');

  db.query(sql, (err, results) => {
    if (err) {
      console.error('Erro ao executar SQL:', err);
      db.end();
      return;
    }

    console.log('✅ Tabelas criadas com sucesso!');
    console.log('Resultados:', results);
    db.end();
    console.log('Conexão fechada.');
  });
});

