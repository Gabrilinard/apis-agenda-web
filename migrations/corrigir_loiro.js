const mysql = require('mysql2');

const db = mysql.createConnection({
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: 'REDACTED',
  database: 'agendamento'
});

console.log('Atualizando usuário Loiro para profissional...\n');

const updateQuery = `
  UPDATE usuario 
  SET tipoUsuario = 'profissional' 
  WHERE id = 6 OR email = 'loiro@gmail.com'
`;

db.query(updateQuery, (err, results) => {
  if (err) {
    console.error('Erro ao atualizar:', err);
    process.exit(1);
  }
  
  console.log(`Usuário atualizado! Linhas afetadas: ${results.affectedRows}`);
  
  if (results.affectedRows > 0) {
    console.log('✅ tipoUsuario atualizado para "profissional" com sucesso!');
    console.log('\n⚠️  IMPORTANTE: Faça logout e login novamente para atualizar o localStorage.');
  } else {
    console.log('⚠️  Nenhum usuário foi atualizado. Verifique se o ID ou email está correto.');
  }
  
  db.end();
});

