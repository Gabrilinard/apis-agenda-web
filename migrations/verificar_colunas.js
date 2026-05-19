const mysql = require('mysql2');

const db = mysql.createConnection({
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: 'REDACTED',
  database: 'agendamento'
});

console.log('Verificando colunas da tabela usuario...\n');

const query = `
  SHOW COLUMNS FROM usuario LIKE 'latitude'
  UNION ALL
  SHOW COLUMNS FROM usuario LIKE 'longitude'
  UNION ALL
  SHOW COLUMNS FROM usuario LIKE 'cidade'
`;

db.query('SHOW COLUMNS FROM usuario', (err, results) => {
  if (err) {
    console.error('Erro ao verificar colunas:', err);
    process.exit(1);
  }
  
  console.log('Colunas da tabela usuario:');
  results.forEach(col => {
    console.log(`  - ${col.Field} (${col.Type})`);
  });
  
  const temLatitude = results.some(col => col.Field === 'latitude');
  const temLongitude = results.some(col => col.Field === 'longitude');
  const temCidade = results.some(col => col.Field === 'cidade');
  
  console.log('\nVerificação:');
  console.log(`  latitude: ${temLatitude ? '✅ Existe' : '❌ NÃO existe'}`);
  console.log(`  longitude: ${temLongitude ? '✅ Existe' : '❌ NÃO existe'}`);
  console.log(`  cidade: ${temCidade ? '✅ Existe' : '❌ NÃO existe'}`);
  
  if (!temLatitude || !temLongitude || !temCidade) {
    console.log('\n⚠️ Algumas colunas não existem. Execute: node add_location_fields.js');
  } else {
    console.log('\n✅ Todas as colunas de localização existem!');
  }
  
  db.end();
});

