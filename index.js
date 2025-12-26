/* eslint-env node */
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000'],
  credentials: true
}));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const db = mysql.createConnection({
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: 'REDACTED',
  database: 'agendamento',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = db;

const dbCallback = mysql.createConnection({
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: 'REDACTED',
  database: 'agendamento',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

const dbPromise = mysql.createConnection({
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: 'REDACTED',
  database: 'agendamento',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
}).promise();

module.exports = { dbCallback, dbPromise };

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});

db.connect(err => {
  if (err) {
    console.error('Erro ao conectar ao banco de dados:', err.message);
    console.log('Servidor continuará rodando, mas operações de banco podem falhar.');
  } else {
    console.log('Banco conectado!');
  }
});

app.post('/register', async (req, res) => {
    const { 
      nome, 
      sobrenome, 
      telefone, 
      email, 
      senha, 
      tipoUsuario, 
      fazParteEmpresa, 
      nomeEmpresa, 
      tipoProfissional, 
      profissaoCustomizada
    } = req.body;
  
    console.log('=== DADOS RECEBIDOS NO REGISTRO ===');
    console.log('req.body completo:', JSON.stringify(req.body, null, 2));
    console.log('fazParteEmpresa:', fazParteEmpresa, 'tipo:', typeof fazParteEmpresa);
    console.log('nomeEmpresa:', nomeEmpresa);
    console.log('tipoUsuario:', tipoUsuario);
  
    if (!nome || !sobrenome || !email || !senha) {
      return res.status(400).json({ error: 'Todos os campos são obrigatórios!' });
    }

    if (tipoUsuario === 'profissional') {
      if (fazParteEmpresa === undefined || fazParteEmpresa === null) {
        return res.status(400).json({ error: 'Informe se faz parte de uma empresa.' });
      }
      if (fazParteEmpresa && (!nomeEmpresa || !nomeEmpresa.trim())) {
        return res.status(400).json({ error: 'Nome da empresa é obrigatório quando faz parte de uma empresa.' });
      }
      if (!tipoProfissional) {
        return res.status(400).json({ error: 'Tipo de profissional é obrigatório.' });
      }
      if (tipoProfissional === 'outros' && (!profissaoCustomizada || !profissaoCustomizada.trim())) {
        return res.status(400).json({ error: 'Profissão customizada é obrigatória quando selecionar "Outros".' });
      }
    }
  
    try {
      const hashedPassword = await bcrypt.hash(senha, 10);

      let query = 'INSERT INTO usuario (nome, sobrenome, telefone, email, senha';
      let values = [nome, sobrenome, telefone, email, hashedPassword];
      let placeholders = '?, ?, ?, ?, ?';

      query += ', tipoUsuario';
      placeholders += ', ?';
      values.push(tipoUsuario || 'cliente');

      if (tipoUsuario === 'profissional') {
        query += ', fazParteEmpresa, nomeEmpresa, tipoProfissional, profissaoCustomizada';
        placeholders += ', ?, ?, ?, ?';
        values.push(
          fazParteEmpresa ? 1 : 0,
          fazParteEmpresa ? nomeEmpresa : null,
          tipoProfissional,
          tipoProfissional === 'outros' ? profissaoCustomizada : null
        );
      }

      query += `) VALUES (${placeholders})`;

      db.query(query, values, async (err, results) => {
        if (err) {
          console.error('Erro ao registrar:', err);
          if (err.code === 'ER_BAD_FIELD_ERROR') {
            console.log('Colunas de profissional não existem, inserindo apenas campos básicos...');
            db.query(
              'INSERT INTO usuario (nome, sobrenome, telefone, email, senha) VALUES (?, ?, ?, ?, ?)',
              [nome, sobrenome, telefone, email, hashedPassword],
              (err2, results2) => {
                if (err2) {
                  console.error('Erro ao registrar:', err2);
                  return res.status(400).json({ error: `Erro ao registrar: ${err2.sqlMessage}` });
                }
                console.log('Usuário registrado com sucesso (sem campos profissionais)', results2);
                res.json({ message: 'Usuário registrado com sucesso!', id: results2.insertId });
              }
            );
          } else {
            return res.status(400).json({ error: `Erro ao registrar: ${err.sqlMessage}` });
          }
        } else {
          const userId = results.insertId;
          console.log('Usuário criado com ID:', userId);
          console.log('Dados recebidos - tipoUsuario:', tipoUsuario, 'fazParteEmpresa:', fazParteEmpresa, 'nomeEmpresa:', nomeEmpresa);
          
          // Se for profissional e faz parte de empresa, criar/associar empresa
          const fazParteEmpresaBool = fazParteEmpresa === true || fazParteEmpresa === 1 || fazParteEmpresa === '1' || fazParteEmpresa === 'true';
          console.log('Verificando condições - tipoUsuario:', tipoUsuario, 'fazParteEmpresaBool:', fazParteEmpresaBool, 'nomeEmpresa:', nomeEmpresa);
          if (tipoUsuario === 'profissional' && fazParteEmpresaBool && nomeEmpresa && nomeEmpresa.trim()) {
            console.log('Processando empresa:', nomeEmpresa, 'fazParteEmpresaBool:', fazParteEmpresaBool);
            
            // Verifica se a empresa já existe
            db.query('SELECT id FROM empresas WHERE nome = ?', [nomeEmpresa], (errEmpresa, empresaResults) => {
              if (errEmpresa) {
                console.error('Erro ao verificar empresa:', errEmpresa);
                // Se a tabela não existir, tenta criar
                if (errEmpresa.code === 'ER_NO_SUCH_TABLE') {
                  console.log('Tabela empresas não existe. Execute a migration primeiro.');
                }
                return res.json({ message: 'Usuário registrado com sucesso!', id: userId });
              }
              
              let empresaId;
              
              if (empresaResults.length > 0) {
                // Empresa já existe, usa o ID existente
                empresaId = empresaResults[0].id;
                console.log('Empresa já existe com ID:', empresaId);
                
                // Atualiza usuario com empresa_id existente
                db.query(
                  'UPDATE usuario SET empresa_id = ? WHERE id = ?',
                  [empresaId, userId],
                  (errUpdate) => {
                    if (errUpdate) {
                      console.error('Erro ao associar empresa:', errUpdate);
                    } else {
                      console.log('Usuário associado à empresa existente');
                    }
                    res.json({ message: 'Usuário registrado com sucesso!', id: userId });
                  }
                );
              } else {
                // Cria nova empresa
                console.log('Criando nova empresa:', nomeEmpresa);
                db.query(
                  'INSERT INTO empresas (nome, usuario_criador_id) VALUES (?, ?)',
                  [nomeEmpresa, userId],
                  (errCreate, createResults) => {
                    if (errCreate) {
                      console.error('Erro ao criar empresa:', errCreate);
                      return res.json({ message: 'Usuário registrado com sucesso!', id: userId });
                    }
                    
                    empresaId = createResults.insertId;
                    console.log('Empresa criada com ID:', empresaId);
                    
                    // Atualiza usuario com empresa_id
                    db.query(
                      'UPDATE usuario SET empresa_id = ? WHERE id = ?',
                      [empresaId, userId],
                      (errUpdate) => {
                        if (errUpdate) {
                          console.error('Erro ao associar empresa:', errUpdate);
                        } else {
                          console.log('Usuário associado à nova empresa');
                        }
                        res.json({ message: 'Usuário registrado com sucesso!', id: userId });
                      }
                    );
                  }
                );
              }
            });
          } else {
            console.log('=== NÃO ENTROU NA CONDIÇÃO DE CRIAR EMPRESA ===');
            console.log('tipoUsuario === profissional?', tipoUsuario === 'profissional');
            console.log('fazParteEmpresaBool?', fazParteEmpresaBool);
            console.log('nomeEmpresa existe e não vazio?', nomeEmpresa && nomeEmpresa.trim());
            console.log('Usuário registrado com sucesso (não é profissional com empresa)', results);
            res.json({ message: 'Usuário registrado com sucesso!', id: userId });
          }
        }
      });
    } catch (error) {
      console.error('Erro no servidor:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });


app.post('/login', (req, res) => {
  const { email, senha } = req.body;
  db.query('SELECT * FROM usuario WHERE email = ?', [email], async (err, results) => {
    if (err || results.length === 0) return res.status(400).json({ error: 'Usuário não encontrado' });

    const user = results[0];
    const senhaCorreta = await bcrypt.compare(senha, user.senha);

    if (!senhaCorreta) return res.status(401).json({ error: 'Senha incorreta' });

    const token = jwt.sign({ id: user.id }, 'secreto', { expiresIn: '1h' });

    res.json({ 
      token, 
      user: { 
        id: user.id, 
        nome: user.nome, 
        sobrenome: user.sobrenome, 
        telefone: user.telefone,
        email: user.email,
        tipoUsuario: user.tipoUsuario || 'cliente'
      } 
    });
  });
})

app.get('/user/:id', (req, res) => {
  const { id } = req.params;
  db.query('SELECT id, nome, email, tipoUsuario FROM usuario WHERE id = ?', [id], (err, results) => {
    if (err || results.length === 0) return res.status(404).json({ error: 'Usuário não encontrado' });
    res.json(results[0]);
  });
});

app.post('/reservas', (req, res) => {
    console.log(req.body); 
  
    const { nome, sobrenome, telefone, email, dia, horario, horarioFinal, qntd_pessoa, usuario_id } = req.body;

    const sql = 'INSERT INTO reservas (nome, sobrenome, telefone, email, dia, horario, horarioFinal, qntd_pessoa, usuario_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';
    db.query(sql, [nome, sobrenome, telefone, email, dia, horario, horarioFinal, qntd_pessoa, usuario_id], (err, result) => {
        if (err) {
            console.error('Erro ao inserir no banco de dados:', err);
            return res.status(500).json({ error: 'Erro ao processar a reserva.' });
        }
        res.json({ success: true, id: result.insertId });
    });
});

  
  app.get('/reservas/:id', (req, res) => {
    const userId = req.params.id;
    db.query('SELECT * FROM reservas WHERE usuario_id = ?', [userId], (err, results) => {
        if (err) return res.status(500).json(err);
        res.json(results);
    });
});
  
  app.delete('/reservas', (req, res) => {
    const { usuario, horario, dia } = req.body;  

    console.error('Usuário:', usuario, 'Horário:', horario, 'Dia:', dia);

    if (!usuario || !horario || !dia) {
        return res.status(400).json({ error: 'Usuário, horário e dia são obrigatórios.' });
    }

    const query = 'DELETE FROM reservas WHERE usuario_id = ? AND horario = ? AND dia = ?';

    db.query(query, [usuario, horario, dia], (err, result) => {
        if (err) {
            console.error('Erro ao remover a reserva:', err);
            return res.status(500).json({ error: 'Erro ao remover a reserva.' });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Nenhuma reserva encontrada para este usuário, horário e dia.' });
        }

        res.status(200).json({ message: 'Reserva removida com sucesso.' });
    });
});

app.get('/reservas', (req, res) => {
    db.query('SELECT * FROM reservas', (err, results) => {
      if (err) return res.status(500).json(err);
      res.json(results);
    });
  });
  

  app.patch('/reservas/:id', (req, res) => {
    const agendamentoId = req.params.id;
    const { status } = req.body; // No seu caso, deve ser o "status", não "horario"
    
    if (!status) {
      return res.status(400).json({ error: 'Status é obrigatório' });
    }
  
    const query = `UPDATE reservas SET status = ? WHERE id = ?`;
  
    db.query(query, [status, agendamentoId], (err, results) => {
      if (err) {
        return res.status(500).json({ error: 'Erro ao atualizar o status', details: err });
      }
  
      if (results.affectedRows === 0) {
        return res.status(404).json({ message: 'Reserva não encontrada' });
      }
  
      res.status(200).json({ message: `Status atualizado com sucesso para ${status}` });
    });
  });
  
  app.put('/reservas/:id', async (req, res) => {
    const { id } = req.params; 
    const { dia, horario, qntd_pessoa } = req.body; 
  
    try {
      const [reservas] = await dbPromise.query('SELECT * FROM reservas WHERE id = ?', [id]);
  
      if (reservas.length === 0) {
        return res.status(404).json({ error: 'Reserva não encontrada' });
      }
  
      const [result] = await dbPromise.query(
        'UPDATE reservas SET dia = ?, horario = ?, qntd_pessoa = ? WHERE id = ?',
        [dia, horario, qntd_pessoa, id]
      );
  
      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Reserva não encontrada ou nenhum dado alterado' });
      }
  
      res.status(200).json({ message: 'Reserva atualizada com sucesso!' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao atualizar a reserva' });
    }
  });
  

  app.delete('/reservas/:id', (req, res) => {
    const { id } = req.params;
  
    const sql = 'DELETE FROM reservas WHERE id = ?';
    db.query(sql, [id], (err, result) => {
      if (err) {
        console.error('Erro ao excluir reserva:', err);
        return res.status(500).json({ error: 'Erro ao excluir reserva' });
      }
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: 'Reserva não encontrada ou não pertence a este usuário' });
      }
      res.json({ message: 'Reserva removida com sucesso!' });
    });
  });

  app.put('/reservas/solicitar/:id', (req, res) => {
    const reservaId = req.params.id; // Obtém o ID da reserva
    const { motivoFalta } = req.body; // Obtém o motivo da falta do corpo da requisição
    const novoStatus = 'ausente';

    // Atualiza o status e o motivo da falta
    const sql = 'UPDATE reservas SET status = ?, motivoFalta = ? WHERE id = ?';
    db.query(sql, [novoStatus, motivoFalta, reservaId], (err, result) => {
        if (err) {
            console.error('Erro ao atualizar status:', err);
            return res.status(500).json({ success: false, message: 'Erro ao atualizar status' });
        }

        if (result.affectedRows > 0) {
            res.json({ success: true, message: 'Status atualizado para ausente e motivo registrado' });
        } else {
            res.status(404).json({ success: false, message: 'Reserva não encontrada' });
        }
    });
});

  

app.get('/reservas/extra', (req, res) => {
    const query = `
        SELECT 
            reservas.id, 
            reservas.dia, 
            reservas.horario, 
            usuario.nome, 
            usuario.sobrenome, 
            usuario.email 
        FROM reservas
        JOIN usuario ON reservas.usuario_id = usuario.id
    `;

    db.query(query, (err, results) => {
        if (err) {
            console.error('Erro ao buscar reservas:', err);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
        res.json(results);
    });
});

app.patch('/reservas/negado/:id', async (req, res) => {
    const { status, motivoNegacao } = req.body;
    const reservaId = req.params.id;
    console.log(req.body, req.params.id);

    let sql = `UPDATE reservas SET status = ? ${status === 'negado' ? ', motivoNegacao = ?' : ', motivoNegacao = NULL'} WHERE id = ?`;
    let params = status === 'negado' ? [status, motivoNegacao, reservaId] : [status, reservaId];

    db.query(sql, params, (err) => {
        if (err) {
            console.error("Erro ao atualizar reserva:", err);
            return res.status(500).json({ error: "Erro ao atualizar reserva" });
        }
        res.json({ message: "Reserva atualizada com sucesso!" });
    });
});

app.patch('/reservas/editar/:id', async (req, res) => {
    const { id } = req.params;
    const { dia, horario, horarioFinal, qntd_pessoa } = req.body;

    try {
        await dbPromise.query(
            'UPDATE reservas SET dia = ?, horario = ?, horarioFinal = ?, qntd_pessoa = ?, status = ? WHERE id = ?',
            [dia, horario, horarioFinal, qntd_pessoa, 'pendente', id]
        );
        res.status(200).json({ message: 'Reserva editada e aguardando confirmação do professor!' });
    } catch (error) {
        console.error('Erro ao atualizar reserva:', error);
        res.status(500).json({ error: 'Erro ao atualizar reserva' });
    }
});

// Rota para pegar usuários logados
app.get('/usuarios/logados', (req, res) => {
  // Consulta SQL para pegar os usuários logados
  const query = 'SELECT id, nome, sobrenome, telefone, email FROM usuario;';

  db.query(query, (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Erro ao buscar usuários logados');
    }

    // Retorna os resultados como resposta JSON
    res.json(results);
  });
});

app.get('/usuarios/solicitarDados/:id', (req, res) => {
  const userId = req.params.id; 
  console.log('ID do usuário recebido:', userId); 

  const query = 'SELECT id, nome, sobrenome, email, telefone FROM usuario WHERE id = ?';
  
  db.query(query, [userId], (err, results) => {
    if (err) {
      console.error('Erro ao buscar usuário logado pelo ID:', err);
      return res.status(500).send('Erro ao buscar dados do usuário logado');
    }

    if (results.length === 0) {
      return res.status(404).send('Usuário não encontrado ou não está logado');
    }

    res.json(results[0]); 
  });
});

app.get('/empresas', (req, res) => {
  const query = `
    SELECT 
      e.id,
      e.nome as nomeEmpresa,
      COUNT(DISTINCT u.id) as quantidadeProfissionais,
      GROUP_CONCAT(DISTINCT u.tipoProfissional) as tiposProfissionais
    FROM empresas e
    LEFT JOIN usuario u ON u.empresa_id = e.id
    GROUP BY e.id, e.nome
    ORDER BY e.nome ASC
  `;
  
  db.query(query, (err, results) => {
    if (err) {
      console.error('Erro ao buscar empresas:', err);
      // Se a tabela empresas não existir, tenta buscar da forma antiga
      const fallbackQuery = `
        SELECT DISTINCT nomeEmpresa, 
               COUNT(*) as quantidadeProfissionais,
               GROUP_CONCAT(DISTINCT tipoProfissional) as tiposProfissionais
        FROM usuario 
        WHERE fazParteEmpresa = 1 AND nomeEmpresa IS NOT NULL AND nomeEmpresa != ''
        GROUP BY nomeEmpresa
        ORDER BY nomeEmpresa ASC
      `;
      
      db.query(fallbackQuery, (err2, results2) => {
        if (err2) {
          return res.status(500).json({ error: 'Erro ao buscar empresas' });
        }
        res.json(results2);
      });
    } else {
      res.json(results);
    }
  });
});

app.post('/api/forgot-password', (req, res) => {
  const { email } = req.body;

  db.query('SELECT id FROM usuario WHERE email = ?', [email], (err, results) => {
    if (err || results.length === 0) {
      return res.status(400).json({ error: 'Usuário não encontrado.' });
    }

    const userId = results[0].id; 
    res.json({ userId }); 
  });
});

app.patch('/api/reset-password/:id', async (req, res) => {
  const { id } = req.params; 
  const { senha } = req.body; 

  try {
    const hashedPassword = await bcrypt.hash(senha, 10);

    const query = 'UPDATE usuario SET senha = ? WHERE id = ?';

    db.query(query, [hashedPassword, id], (err, result) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ message: 'Erro ao atualizar a senha.' });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ message: 'Usuário não encontrado.' });
      }

      return res.status(200).json({ message: 'Senha redefinida com sucesso.' });
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao processar a senha.' });
  }
});