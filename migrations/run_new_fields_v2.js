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

const migrationFile = path.join(__dirname, 'add_new_profissional_fields_v2.sql');

console.log('Lendo arquivo de migration...');
const sql = fs.readFileSync(migrationFile, 'utf8');

console.log('Executando migration para adicionar novos campos...');
db.query(sql, (err, results) => {
  if (err) {
    // Se erro for de coluna duplicada, ignorar
    if (err.code === 'ER_DUP_FIELDNAME') {
        console.log('Algumas colunas já existem, ignorando erro de duplicação.');
    } else {
        console.error('Erro ao executar migration:', err);
        // Não sair com erro para não quebrar o fluxo se for apenas duplicação parcial
    }
  } else {
      console.log('Migration executada com sucesso!');
      console.log('Resultados:', results);
  }
  
  db.end();
});
