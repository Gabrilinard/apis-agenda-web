const mysql = require('mysql2');

const db = mysql.createConnection({
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: 'REDACTED',
  database: 'agendamento'
});

console.log('Corrigindo usuário Girafa...\n');

const updateQuery = `
  UPDATE usuario 
  SET tipoUsuario = 'profissional',
      tipoProfissional = 'fisioterapeuta',
      numeroConselho = 'CREFITO 099009',
      ufRegiao = 'MT',
      latitude = -12.78327480219248,
      longitude = -53.04066728005531,
      cidade = 'Gaúcha do Norte'
  WHERE id = 10 OR email = 'girafa@gmail.com'
`;

db.query(updateQuery, (err, results) => {
  if (err) {
    console.error('Erro ao atualizar:', err);
    process.exit(1);
  }
  
  console.log(`Usuário atualizado! Linhas afetadas: ${results.affectedRows}`);
  
  if (results.affectedRows > 0) {
    console.log('✅ Usuário Girafa corrigido para "profissional" com todos os campos!');
  } else {
    console.log('⚠️ Nenhum usuário foi atualizado.');
  }
  
  db.end();
});

