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
  origin: 'https://fisiopilattes.netlify.app'
}));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Conectar ao banco de dados
const db = mysql.createConnection({
  host: 'trolley.proxy.rlwy.net',
  port: '29727',
  user: 'root',
  password: 'tWsWbxeTXoDvpqCGKxtFWdQgXpfXnFYn',
  database: 'railway',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = db;

const dbCallback = mysql.createConnection({
  host: 'trolley.proxy.rlwy.net',
  port: '29727',
  user: 'root',
  password: 'tWsWbxeTXoDvpqCGKxtFWdQgXpfXnFYn',
  database: 'railway',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Instância para promessas
const dbPromise = mysql.createConnection({
  host: 'trolley.proxy.rlwy.net',
  port: '29727',
  user: 'root',
  password: 'tWsWbxeTXoDvpqCGKxtFWdQgXpfXnFYn',
  database: 'railway',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
}).promise();

module.exports = { dbCallback, dbPromise };

db.connect(err => {
  if (err) console.error(err);
  else console.log('Banco conectado!');
});

// 🔹 Registro de Usuário
app.post('/register', async (req, res) => {
    const { nome, sobrenome, telefone, email, senha } = req.body;
  
    console.log(req.body);  // Verifique os dados recebidos
  
    if (!nome || !sobrenome || !email || !senha) {
      return res.status(400).json({ error: 'Todos os campos são obrigatórios!' });
    }
  
    try {
      const hashedPassword = await bcrypt.hash(senha, 10);
  
      db.query(
        'INSERT INTO usuario (nome, sobrenome, telefone, email, senha) VALUES (?, ?, ?, ?, ?)',
        [nome, sobrenome, telefone, email, hashedPassword],
        (err, results) => {
          if (err) {
            console.error('Erro ao registrar:', err);
            return res.status(400).json({ error: `Erro ao registrar: ${err.sqlMessage}` });
          }
          console.log('Usuário registrado com sucesso', results);
          res.json({ message: 'Usuário registrado com sucesso!', id: results.insertId });
        }
      );
    } catch (error) {
      console.error('Erro no servidor:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });


// 🔹 Login de Usuário
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
        email: user.email 
      } 
    });
  });
})

// 🔹 Obter Dados do Usuário
app.get('/user/:id', (req, res) => {
  const { id } = req.params;
  db.query('SELECT id, nome, email FROM usuario WHERE id = ?', [id], (err, results) => {
    if (err || results.length === 0) return res.status(404).json({ error: 'Usuário não encontrado' });
    res.json(results[0]);
  });
});

// Rota para agendar um horário
app.post('/reservas', (req, res) => {
    console.log(req.body); // Verifique os dados recebidos
  
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

  
  // Rota para listar agendamentos
  app.get('/reservas/:id', (req, res) => {
    const userId = req.params.id;
    db.query('SELECT * FROM reservas WHERE usuario_id = ?', [userId], (err, results) => {
        if (err) return res.status(500).json(err);
        res.json(results);
    });
});
  
  // Rota para atualizar status do agendamento
  app.delete('/reservas', (req, res) => {
    const { usuario, horario, dia } = req.body;  // Pega os parâmetros da requisição

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
    const { id } = req.params; // ID da reserva a ser atualizada
    const { dia, horario, qntd_pessoa } = req.body; // Dados da reserva a ser atualizada
  
    try {
      // Verificando se a reserva existe
      const reserva = await Reserva.findOne({ where: { id } });
  
      if (!reserva) {
        return res.status(404).json({ error: 'Reserva não encontrada' });
      }
  
      // Verificando se a reserva pertence ao usuário logado
      if (reserva.userId !== userId) {
        return res.status(403).json({ error: 'Você não tem permissão para atualizar essa reserva' });
      }
  
      // Atualizando a reserva no banco de dados
      const reservaAtualizada = await Reserva.update(
        { dia, horario, qntd_pessoa },
        { where: { id } }  // Identifica a reserva pelo ID
      );
  
      if (reservaAtualizada[0] === 0) {
        // Caso o ID não tenha sido encontrado ou não tenha ocorrido nenhuma atualização
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

    db.query(sql, params, (err, result) => {
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
  const userId = req.params.id; // Pega o ID do parâmetro da URL
  console.log('ID do usuário recebido:', userId); // Adicione este log para verificar se o ID está sendo capturado corretamente

  const query = 'SELECT id, nome, sobrenome, email, telefone FROM usuario WHERE id = ?';
  
  db.query(query, [userId], (err, results) => {
    if (err) {
      console.error('Erro ao buscar usuário logado pelo ID:', err);
      return res.status(500).send('Erro ao buscar dados do usuário logado');
    }

    if (results.length === 0) {
      return res.status(404).send('Usuário não encontrado ou não está logado');
    }

    res.json(results[0]); // Retorna o usuário logado como JSON
  });
});

app.post('/api/forgot-password', (req, res) => {
  const { email } = req.body;

  // Verificar se o e-mail existe no banco de dados
  db.query('SELECT id FROM usuario WHERE email = ?', [email], (err, results) => {
    if (err || results.length === 0) {
      return res.status(400).json({ error: 'Usuário não encontrado.' });
    }

    // Retornar o id do usuário encontrado
    const userId = results[0].id; // Pega o ID do primeiro resultado
    res.json({ userId }); // Retorna o id para o frontend
  });
});

app.patch('/api/reset-password/:id', async (req, res) => {
  const { id } = req.params; // Obtemos o id do usuário a partir dos parâmetros
  const { senha } = req.body; // Nova senha que será enviada

  try {
    // Criptografando a nova senha
    const hashedPassword = await bcrypt.hash(senha, 10);

    // Atualizando a senha no banco de dados
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
  
// Inicia o servidor
const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});