const mysql = require('mysql2');

const db = mysql.createConnection({
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: 'REDACTED',
  database: 'agendamento'
});

console.log('Verificando usuário Louro (ID 5)...\n');

const query = `
  SELECT 
    id, 
    nome, 
    sobrenome,
    email, 
    tipoUsuario, 
    tipoProfissional, 
    numeroConselho, 
    ufRegiao
  FROM usuario 
  WHERE id = 5 OR email = 'louro@gmail.com'
`;

db.query(query, (err, results) => {
  if (err) {
    console.error('Erro ao verificar usuário:', err);
    process.exit(1);
  }
  
  if (results.length === 0) {
    console.log('Usuário não encontrado!');
    db.end();
    return;
  }
  
  const user = results[0];
  console.log('Dados do usuário:');
  console.log(JSON.stringify(user, null, 2));
  console.log('\n');
  
  const temCamposProfissional = !!(user.tipoProfissional || user.numeroConselho || user.ufRegiao);
  console.log(`Tem campos de profissional: ${temCamposProfissional ? 'SIM' : 'NÃO'}`);
  console.log(`tipoUsuario atual: ${user.tipoUsuario}`);
  console.log(`Precisa correção: ${user.tipoUsuario !== 'profissional' && temCamposProfissional ? 'SIM' : 'NÃO'}`);
  
  if (user.tipoUsuario !== 'profissional' && temCamposProfissional) {
    console.log('\nAtualizando tipoUsuario para "profissional"...');
    const updateQuery = 'UPDATE usuario SET tipoUsuario = "profissional" WHERE id = ?';
    db.query(updateQuery, [user.id], (updateErr, updateResults) => {
      if (updateErr) {
        console.error('Erro ao atualizar:', updateErr);
      } else {
        console.log(`Usuário ${user.id} atualizado com sucesso!`);
      }
      db.end();
    });
  } else {
    db.end();
  }
});

