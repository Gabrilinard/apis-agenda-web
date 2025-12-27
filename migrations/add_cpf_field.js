const mysql = require('mysql2');

const db = mysql.createConnection({
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: 'REDACTED',
  database: 'agendamento'
});

db.connect(err => {
  if (err) {
    console.error('Erro ao conectar ao banco de dados:', err.message);
    return;
  }
  console.log('Conectado ao banco de dados!');

  const query = "ALTER TABLE usuario ADD COLUMN cpf VARCHAR(14)";
  
  db.query(query, (err, result) => {
    if (err) {
      if (err.code === 'ER_DUP_FIELDNAME') {
        console.log('Coluna CPF já existe, pulando...');
      } else {
        console.error('Erro ao adicionar coluna CPF:', err.message);
      }
    } else {
      console.log('✅ Coluna CPF adicionada com sucesso');
    }
    
    db.end();
    console.log('Migração concluída!');
  });
});

