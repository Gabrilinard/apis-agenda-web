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

  const query = 'DELETE FROM usuario';
  db.query(query, (err, result) => {
    if (err) {
      console.error('Erro ao excluir usuários:', err);
      db.end();
      return;
    }
    console.log(`✅ ${result.affectedRows} usuário(s) excluído(s) com sucesso!`);
    console.log('A tabela usuario foi mantida intacta.');
    db.end();
    console.log('Conexão fechada.');
  });
});
