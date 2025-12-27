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

  db.query('SELECT id, nome, sobrenome, cpf FROM usuario LIMIT 10', (err, results) => {
    if (err) {
      console.error('Erro:', err);
    } else {
      console.log('\n=== USUÁRIOS NO BANCO ===');
      if (results.length === 0) {
        console.log('Nenhum usuário encontrado.');
      } else {
        results.forEach(u => {
          console.log(`ID: ${u.id}, Nome: ${u.nome} ${u.sobrenome}, CPF: ${u.cpf || 'NULL'}`);
        });
      }
    }
    db.end();
    console.log('\nVerificação concluída!');
  });
});

