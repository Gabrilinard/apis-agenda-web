const mysql = require('mysql2');

const db = mysql.createConnection({
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: 'REDACTED',
  database: 'agendamento'
});

console.log('Verificando usuários que precisam correção...\n');

const query = `
  SELECT 
    id, 
    nome, 
    email, 
    tipoUsuario, 
    tipoProfissional, 
    numeroConselho, 
    ufRegiao,
    CASE 
      WHEN tipoProfissional IS NOT NULL OR numeroConselho IS NOT NULL OR ufRegiao IS NOT NULL 
      THEN 'SIM' 
      ELSE 'NÃO' 
    END as tem_campos_profissional
  FROM usuario 
  WHERE tipoProfissional IS NOT NULL 
     OR numeroConselho IS NOT NULL 
     OR ufRegiao IS NOT NULL
  ORDER BY id
`;

db.query(query, (err, results) => {
  if (err) {
    console.error('Erro ao verificar usuários:', err);
    process.exit(1);
  }
  
  console.log(`Encontrados ${results.length} usuários com campos de profissional:\n`);
  
  results.forEach((user, index) => {
    console.log(`${index + 1}. ID: ${user.id} | Nome: ${user.nome} | Email: ${user.email}`);
    console.log(`   tipoUsuario atual: ${user.tipoUsuario}`);
    console.log(`   tipoProfissional: ${user.tipoProfissional || 'NULL'}`);
    console.log(`   numeroConselho: ${user.numeroConselho || 'NULL'}`);
    console.log(`   ufRegiao: ${user.ufRegiao || 'NULL'}`);
    console.log(`   Precisa correção: ${user.tipoUsuario !== 'profissional' ? 'SIM' : 'NÃO'}\n`);
  });
  
  const precisamCorrecao = results.filter(u => u.tipoUsuario !== 'profissional');
  console.log(`\nTotal que precisam correção: ${precisamCorrecao.length}`);
  
  if (precisamCorrecao.length > 0) {
    console.log('\nExecute a migration fix_tipoUsuario_profissionais.js para corrigir.');
  }
  
  db.end();
});

