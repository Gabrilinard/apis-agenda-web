const mysql = require('mysql2');

const db = mysql.createConnection({
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: 'REDACTED',
  database: 'agendamento'
});

console.log('Verificando TODOS os usuários...\n');

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
  ORDER BY id
`;

db.query(query, (err, results) => {
  if (err) {
    console.error('Erro ao verificar usuários:', err);
    process.exit(1);
  }
  
  console.log(`Total de usuários: ${results.length}\n`);
  
  const precisamCorrecao = [];
  
  results.forEach((user) => {
    const temCamposProfissional = !!(user.tipoProfissional || user.numeroConselho || user.ufRegiao);
    const precisaCorrecao = temCamposProfissional && user.tipoUsuario !== 'profissional';
    
    if (precisaCorrecao) {
      precisamCorrecao.push(user);
    }
    
    const status = precisaCorrecao ? '❌ PRECISA CORREÇÃO' : '✅ OK';
    console.log(`${status} | ID: ${user.id} | ${user.nome} ${user.sobrenome} | ${user.email}`);
    console.log(`   tipoUsuario: ${user.tipoUsuario} | temCamposProfissional: ${temCamposProfissional ? 'SIM' : 'NÃO'}\n`);
  });
  
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Total que precisam correção: ${precisamCorrecao.length}`);
  
  if (precisamCorrecao.length > 0) {
    console.log('\nUsuários que precisam correção:');
    precisamCorrecao.forEach(u => {
      console.log(`  - ID ${u.id}: ${u.nome} ${u.sobrenome} (${u.email})`);
    });
    console.log('\nExecute: node fix_tipoUsuario_profissionais.js');
  } else {
    console.log('\n✅ Todos os usuários estão corretos!');
  }
  
  db.end();
});

