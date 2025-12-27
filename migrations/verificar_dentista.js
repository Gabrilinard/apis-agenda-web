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

  const query = 'SELECT id, nome, sobrenome, tipoProfissional, tipoUsuario, ufRegiao, cidade FROM usuario';
  db.query(query, (err, results) => {
    if (err) {
      console.error('Erro ao buscar usuários:', err);
      db.end();
      return;
    }
    
    console.log('\n=== TODOS OS USUÁRIOS ===');
    results.forEach(u => {
      console.log(`ID: ${u.id}, Nome: ${u.nome} ${u.sobrenome}, TipoUsuario: ${u.tipoUsuario}, TipoProfissional: "${u.tipoProfissional}", UF: ${u.ufRegiao}, Cidade: ${u.cidade}`);
    });
    
    console.log('\n=== PROFISSIONAIS ===');
    const profissionais = results.filter(u => u.tipoUsuario === 'profissional');
    profissionais.forEach(p => {
      console.log(`Nome: ${p.nome} ${p.sobrenome}, TipoProfissional: "${p.tipoProfissional}"`);
    });
    
    console.log('\n=== TESTANDO QUERY PARA DENTISTA ===');
    const queryDentista = `
      SELECT 
        u.id,
        CONCAT(u.nome, ' ', u.sobrenome) as nomeCompleto,
        u.tipoProfissional,
        u.email,
        u.telefone,
        u.ufRegiao,
        u.cidade
      FROM usuario u
      WHERE u.tipoUsuario = 'profissional' 
        AND LOWER(u.tipoProfissional) = ?
        AND (u.empresa_id IS NULL OR u.empresa_id = 0)
      ORDER BY u.nome ASC
    `;
    
    db.query(queryDentista, ['dentista'], (err2, results2) => {
      if (err2) {
        console.error('Erro na query de dentista:', err2);
      } else {
        console.log(`Resultados encontrados: ${results2.length}`);
        results2.forEach(d => {
          console.log(`- ${d.nomeCompleto}, TipoProfissional: "${d.tipoProfissional}"`);
        });
      }
      db.end();
      console.log('\nConexão fechada.');
    });
  });
});

