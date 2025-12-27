const mysql = require('mysql2');

const db = mysql.createConnection({
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: 'REDACTED',
  database: 'agendamento',
  multipleStatements: true
});

console.log('Conectando ao banco de dados...');

db.connect((err) => {
  if (err) {
    console.error('Erro ao conectar ao banco de dados:', err.message);
    process.exit(1);
  }

  console.log('Conectado ao banco de dados!');
  console.log('Excluindo todos os usuários da tabela usuario...');

  const query = 'DELETE FROM usuario';

  db.query(query, (err, results) => {
    if (err) {
      console.error('Erro ao excluir usuários:', err.message);
      db.end();
      process.exit(1);
    }

    console.log(`✅ ${results.affectedRows} usuário(s) excluído(s) com sucesso!`);
    console.log('A tabela usuario foi mantida intacta.');
    
    db.end((err) => {
      if (err) {
        console.error('Erro ao fechar conexão:', err.message);
      } else {
        console.log('Conexão fechada.');
      }
      process.exit(0);
    });
  });
});

