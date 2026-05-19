const mysql = require('mysql2');
const fs = require('fs');
const path = require('path');

const db = mysql.createConnection({
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: 'REDACTED',
  database: 'agendamento',
  multipleStatements: true
});

async function runMigration(fileName, description) {
  return new Promise((resolve, reject) => {
    const migrationFile = path.join(__dirname, fileName);
    
    if (!fs.existsSync(migrationFile)) {
      console.log(`Arquivo ${fileName} não encontrado. Pulando...`);
      return resolve();
    }
    
    console.log(`\n${description}...`);
    const sql = fs.readFileSync(migrationFile, 'utf8');
    
    // Remove comentários e divide em statements
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('USE'));
    
    let currentStatement = '';
    let statementIndex = 0;
    
    function executeNext() {
      if (statementIndex >= statements.length) {
        console.log(`✓ ${description} concluída!`);
        return resolve();
      }
      
      currentStatement = statements[statementIndex];
      
      // Pula comentários
      if (currentStatement.startsWith('--')) {
        statementIndex++;
        return executeNext();
      }
      
      db.query(currentStatement + ';', (err, results) => {
        if (err) {
          // Se for erro de coluna/constraint já existente, ignora
          if (err.code === 'ER_DUP_FIELDNAME' || err.code === 'ER_DUP_KEYNAME' || err.code === 'ER_BAD_FIELD_ERROR' || err.code === 'ER_FK_DUP_NAME') {
            console.log(`⚠ Aviso: ${err.message} (ignorado)`);
            statementIndex++;
            return executeNext();
          }
          console.error(`✗ Erro ao executar statement ${statementIndex + 1}:`, err.message);
          return reject(err);
        }
        
        statementIndex++;
        executeNext();
      });
    }
    
    executeNext();
  });
}

async function main() {
  try {
    console.log('Iniciando migrations...\n');
    
    // Primeiro executa a migration de campos profissionais
    await runMigration('add_profissional_fields.sql', 'Adicionando campos de profissional');
    
    // Depois executa a migration de empresas
    await runMigration('create_empresas_table.sql', 'Criando tabela de empresas');
    
    console.log('\n✓ Todas as migrations foram executadas com sucesso!');
    db.end();
  } catch (error) {
    console.error('\n✗ Erro ao executar migrations:', error);
    db.end();
    process.exit(1);
  }
}

main();

