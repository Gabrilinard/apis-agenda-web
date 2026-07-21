require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mysql = require('mysql2');
const fs = require('fs');
const path = require('path');

const db = mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'agendamento',
  multipleStatements: true
});

const migrationFile = path.join(__dirname, '16_add_tem_acesso_paciente.sql');
const sql = fs.readFileSync(migrationFile, 'utf8');

console.log(`Executando migration contra o banco "${process.env.DB_NAME || 'agendamento'}"...`);
db.query(sql, (err, results) => {
  if (err) {
    console.error('Erro ao executar migration:', err.message);
    db.end();
    process.exit(1);
  }
  console.log('Migration executada com sucesso!');
  console.log(results);
  db.end();
});
