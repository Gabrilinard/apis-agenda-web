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

  db.query('DESCRIBE usuario', (err, results) => {
    if (err) {
      console.error('Erro ao verificar tabela usuario:', err);
    } else {
      console.log('\n=== ESTRUTURA DA TABELA usuario ===');
      results.forEach(col => {
        console.log(`${col.Field} - ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${col.Key ? `(${col.Key})` : ''}`);
      });
    }

    db.query('DESCRIBE reservas', (err, results) => {
      if (err) {
        console.error('Erro ao verificar tabela reservas:', err);
      } else {
        console.log('\n=== ESTRUTURA DA TABELA reservas ===');
        results.forEach(col => {
          console.log(`${col.Field} - ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${col.Key ? `(${col.Key})` : ''}`);
        });
      }

      db.end();
      console.log('\n✅ Verificação concluída!');
    });
  });
});

