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

async function recreateUsuarioTable() {
  return new Promise((resolve, reject) => {
    const migrationFile = path.join(__dirname, 'recreate_usuario_table.sql');
    
    if (!fs.existsSync(migrationFile)) {
      console.error(`Arquivo ${migrationFile} não encontrado.`);
      return reject(new Error('Arquivo não encontrado'));
    }
    
    console.log('\n=== RECRIANDO TABELA USUARIO ===');
    console.log('ATENÇÃO: Todos os dados da tabela usuario serão apagados!\n');
    
    const sql = fs.readFileSync(migrationFile, 'utf8');
    
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.trim().startsWith('--') && !s.trim().startsWith('USE'));
    
    let statementIndex = 0;
    
    function executeNext() {
      if (statementIndex >= statements.length) {
        console.log('\n✓ Tabela usuario recriada com sucesso!');
        return resolve();
      }
      
      const currentStatement = statements[statementIndex];
      
      if (currentStatement.startsWith('--')) {
        statementIndex++;
        return executeNext();
      }
      
      db.query(currentStatement + ';', (err, results) => {
        if (err) {
          if (err.code === 'ER_CANT_DROP_FIELD_OR_KEY' || 
              err.code === 'ER_BAD_FIELD_ERROR' ||
              err.code === 'ER_NO_SUCH_TABLE' ||
              err.code === 'ER_CANNOT_ADD_FOREIGN' ||
              err.message.includes("doesn't exist") ||
              err.message.includes('Unknown') ||
              err.message.includes('Table') && err.message.includes("doesn't exist")) {
            console.log(`⚠ Aviso: ${err.message.substring(0, 80)}... (ignorado)`);
            statementIndex++;
            return executeNext();
          }
          console.error(`✗ Erro ao executar statement ${statementIndex + 1}:`, err.message);
          return reject(err);
        }
        
        if (results && results.length > 0) {
          console.log(`✓ Statement ${statementIndex + 1} executado`);
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
    console.log('Conectando ao banco de dados...');
    
    await new Promise((resolve, reject) => {
      db.connect((err) => {
        if (err) {
          console.error('Erro ao conectar:', err);
          return reject(err);
        }
        console.log('✓ Conectado ao banco de dados\n');
        resolve();
      });
    });
    
    await recreateUsuarioTable();
    
    db.end();
    console.log('\n✓ Processo concluído!');
    process.exit(0);
  } catch (error) {
    console.error('\n✗ Erro ao executar script:', error);
    db.end();
    process.exit(1);
  }
}

main();

