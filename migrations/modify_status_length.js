const mysql = require('mysql2');
const dbConfig = require('../dbConfig');

const connection = mysql.createConnection(dbConfig);

const sql = "ALTER TABLE reservas MODIFY COLUMN status VARCHAR(50) DEFAULT 'pendente'";

connection.query(sql, (err, result) => {
  if (err) {
    console.error('Erro ao modificar coluna status:', err);
  } else {
    console.log('Coluna status modificada com sucesso para VARCHAR(50)!');
  }
  connection.end();
});
