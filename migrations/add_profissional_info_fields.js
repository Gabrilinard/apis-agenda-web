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

  const queries = [
    "ALTER TABLE usuario ADD COLUMN descricao TEXT",
    "ALTER TABLE usuario ADD COLUMN publicoAtendido VARCHAR(100)",
    "ALTER TABLE usuario ADD COLUMN modalidade VARCHAR(100)"
  ];

  let completed = 0;
  queries.forEach((query, index) => {
    db.query(query, (err, result) => {
      if (err) {
        // Se a coluna já existe, apenas ignora o erro
        if (err.code === 'ER_DUP_FIELDNAME') {
          const columnName = query.match(/ADD COLUMN (\w+)/)[1];
          console.log(`Coluna ${columnName} já existe, pulando...`);
        } else {
          console.error(`Erro ao executar query ${index + 1}:`, err.message);
        }
      } else {
        const columnName = query.match(/ADD COLUMN (\w+)/)[1];
        console.log(`✅ Coluna ${columnName} adicionada com sucesso`);
      }
      
      completed++;
      if (completed === queries.length) {
        db.end();
        console.log('Migração concluída!');
      }
    });
  });
});

