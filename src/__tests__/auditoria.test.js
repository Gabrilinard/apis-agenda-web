// Testes do log de auditoria de acesso (backend/src/models/auditModel.js), a lacuna
// que faltava fechar depois das quatro rodadas de auditoria de segurança: nenhuma
// ação sensível (login, cadastro, redefinição de senha, exclusão de conta) ficava
// registrada em lugar nenhum — em caso de incidente, não haveria como reconstruir
// quem fez o quê, quando. A tabela log_acesso (migração 20260805_create_log_acesso.sql)
// e o registro em authView.js/usuariosView.js cobrem essa lacuna.
const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../db', () => {
  const { createQueryRouter } = require('./helpers/mockDb');
  const router = createQueryRouter();
  return {
    dbPromise: { query: (...args) => router.dbPromiseQuery(...args) },
    pool: { query: (...args) => router.poolQuery(...args) },
    __router: router,
  };
});

jest.mock('../email', () => {
  const actual = jest.requireActual('../email');
  const mocked = {};
  Object.keys(actual).forEach((key) => {
    mocked[key] = jest.fn().mockResolvedValue(undefined);
  });
  return mocked;
});

const bcrypt = require('bcryptjs');
const config = require('../config');
const { createApp } = require('../app');
const dbRouter = require('../db').__router;

const app = createApp();
const tokenPara = (id) => jwt.sign({ id }, config.jwtSecret, { expiresIn: '1h' });

// Como o log é gravado sem `await` na view (fire-and-forget, para não atrasar a
// resposta ao usuário), esperamos um instante antes de checar a chamada ao mock.
const aguardarLogAssincrono = () => new Promise((resolve) => setImmediate(resolve));

beforeEach(() => dbRouter.reset());

describe('Login registra evento de auditoria (log_acesso)', () => {
  test('login com senha correta grava evento de sucesso com o id do usuário', async () => {
    const senhaHash = await bcrypt.hash('senha123456', 10);
    dbRouter.on(/SELECT \* FROM usuario WHERE email = \?/, () => [{ id: 42, senha: senhaHash }]);
    dbRouter.on(/INSERT INTO log_acesso/, () => ({ insertId: 1, affectedRows: 1 }));

    await request(app).post('/login').send({ email: 'ana@teste.com', senha: 'senha123456' });
    await aguardarLogAssincrono();

    expect(dbRouter.dbPromiseQuery).toHaveBeenCalledWith(
      expect.stringMatching(/INSERT INTO log_acesso/),
      [42, 'login', 1, expect.anything(), null]
    );
  });

  test('login com senha errada grava evento de FALHA, não de sucesso', async () => {
    const senhaHash = await bcrypt.hash('senha-certa', 10);
    dbRouter.on(/SELECT \* FROM usuario WHERE email = \?/, () => [{ id: 42, senha: senhaHash }]);
    dbRouter.on(/INSERT INTO log_acesso/, () => ({ insertId: 1, affectedRows: 1 }));

    await request(app).post('/login').send({ email: 'ana@teste.com', senha: 'senha-errada' });
    await aguardarLogAssincrono();

    expect(dbRouter.dbPromiseQuery).toHaveBeenCalledWith(
      expect.stringMatching(/INSERT INTO log_acesso/),
      [42, 'login', 0, expect.anything(), 'senha incorreta']
    );
  });

  test('login com e-mail inexistente grava evento de falha sem id de usuário', async () => {
    dbRouter.on(/SELECT \* FROM usuario WHERE email = \?/, () => []);
    dbRouter.on(/INSERT INTO log_acesso/, () => ({ insertId: 1, affectedRows: 1 }));

    await request(app).post('/login').send({ email: 'naoexiste@teste.com', senha: 'x' });
    await aguardarLogAssincrono();

    expect(dbRouter.dbPromiseQuery).toHaveBeenCalledWith(
      expect.stringMatching(/INSERT INTO log_acesso/),
      [null, 'login', 0, expect.anything(), expect.stringContaining('naoexiste@teste.com')]
    );
  });
});

describe('Exclusão de conta registra evento de auditoria', () => {
  test('DELETE /usuarios/:id da própria conta grava o evento antes de a linha ser removida', async () => {
    dbRouter.on(/SELECT arquivo_urgencia FROM reservas WHERE usuario_id = \?/, () => []);
    dbRouter.on(/SELECT f\.conteudo FROM formularios f[\s\S]*JOIN reservas r/, () => []);
    dbRouter.on(/DELETE FROM notificacoes_vaga WHERE profissional_id = \? OR usuario_notificado_id = \?/, () => ({ affectedRows: 0 }));
    dbRouter.on(/DELETE FROM notificacoes_profissional WHERE profissional_id = \?/, () => ({ affectedRows: 0 }));
    dbRouter.on(/DELETE FROM notificacoes_paciente WHERE usuario_id = \?/, () => ({ affectedRows: 0 }));
    dbRouter.on(/DELETE FROM usuario WHERE id = \?/, () => ({ affectedRows: 1 }));
    dbRouter.on(/INSERT INTO log_acesso/, () => ({ insertId: 1, affectedRows: 1 }));

    const res = await request(app).delete('/usuarios/7').set('Authorization', `Bearer ${tokenPara(7)}`);

    expect(res.status).toBe(200);
    expect(dbRouter.dbPromiseQuery).toHaveBeenCalledWith(
      expect.stringMatching(/INSERT INTO log_acesso/),
      [7, 'exclusao_conta', 1, expect.anything(), expect.stringContaining('7')]
    );
  });
});

describe('Falha ao gravar o log não derruba a requisição original', () => {
  test('se o INSERT em log_acesso falhar, o login continua respondendo normalmente', async () => {
    const senhaHash = await bcrypt.hash('senha123456', 10);
    dbRouter.on(/SELECT \* FROM usuario WHERE email = \?/, () => [{ id: 1, senha: senhaHash }]);
    dbRouter.on(/INSERT INTO log_acesso/, () => {
      throw new Error('tabela de auditoria indisponível');
    });

    const res = await request(app).post('/login').send({ email: 'ana@teste.com', senha: 'senha123456' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });
});
