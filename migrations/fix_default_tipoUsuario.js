const mysql = require('mysql2');
const fs = require('fs');
const path = require('path');

const db = mysql.createConnection({
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: 'REDACTED',
  database: 'agendamento',
  multipleStatements: true
});

const migrationFile = path.join(__dirname, 'fix_default_tipoUsuario.sql');

console.log('Lendo arquivo de migration...');
const sql = fs.readFileSync(migrationFile, 'utf8');

console.log('Executando migration para corrigir DEFAULT de tipoUsuario...');
db.query(sql, (err, results) => {
  if (err) {
    console.error('Erro ao executar migration:', err);
    process.exit(1);
  }
  
  console.log('Migration executada com sucesso!');
  console.log('Resultados:', results);
  db.end();
});

