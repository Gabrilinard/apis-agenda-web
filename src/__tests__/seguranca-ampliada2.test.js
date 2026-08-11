// Testes de SEGURANÇA da terceira rodada de auditoria: segredo do JWT sem fallback
// inseguro, rate limiting em login/registro/recuperação de senha, GET /user/:id exigindo
// autenticação, e o novo endpoint de exclusão de conta (direito de exclusão da LGPD).
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

const config = require('../config');
const { createApp } = require('../app');
const dbRouter = require('../db').__router;

const app = createApp();
const tokenPara = (id) => jwt.sign({ id }, config.jwtSecret, { expiresIn: '1h' });

beforeEach(() => dbRouter.reset());

describe('JWT_SECRET sem fallback inseguro (segurança)', () => {
  // Antes, config.js tinha `jwtSecret: process.env.JWT_SECRET || 'secreto'` — um valor
  // padrão público, visível a qualquer um que lesse o código-fonte. Se JWT_SECRET não
  // fosse configurado (esquecimento em produção), o servidor subia normalmente assinando
  // tokens com 'secreto', e qualquer pessoa poderia forjar um token válido para qualquer
  // usuário. Agora o módulo lança um erro no carregamento se a variável não existir.
  test('carregar config.js sem JWT_SECRET definido lança erro em vez de usar um valor padrão', () => {
    jest.resetModules();
    const original = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;
    try {
      expect(() => require('../config')).toThrow(/JWT_SECRET/);
    } finally {
      process.env.JWT_SECRET = original;
      jest.resetModules();
    }
  });
});

describe('GET /user/:id agora exige autenticação (segurança)', () => {
  // Antes, essa rota não tinha `authenticate` — bastava incrementar o id na URL para
  // coletar nome e e-mail (dado pessoal, LGPD) de qualquer usuário do sistema, sem login
  // e sem limite de tentativas. Nenhuma tela do front-end usa essa rota hoje.
  test('sem token, a rota não devolve mais os dados do usuário', async () => {
    const res = await request(app).get('/user/1');
    expect(res.status).toBe(401);
  });

  test('com token válido, a rota continua funcionando (não ficou quebrada, só deixou de ser pública)', async () => {
    dbRouter.on(/SELECT id, nome, email, tipoUsuario FROM usuario WHERE id/, () => [
      { id: 1, nome: 'Ana', email: 'ana@teste.com', tipoUsuario: 'paciente' },
    ]);
    const res = await request(app).get('/user/1').set('Authorization', `Bearer ${tokenPara(1)}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe('ana@teste.com');
  });
});

describe('Rate limiting em rotas de autenticação (segurança)', () => {
  // Antes, POST /login e POST /register não tinham nenhum limite de tentativas —
  // um atacante podia tentar senhas por força bruta contra um e-mail conhecido, ou
  // varrer e-mails cadastrados (POST /register responde 409 se já existe) sem fricção
  // nenhuma. loginLimiter permite 10 tentativas a cada 15 minutos por IP.
  test('a 11ª tentativa de login no mesmo IP dentro da janela é bloqueada com 429', async () => {
    dbRouter.on(/SELECT \* FROM usuario WHERE email = \?/, () => []); // "usuário não encontrado" em toda tentativa

    let ultimaResposta;
    for (let i = 0; i < 11; i++) {
      ultimaResposta = await request(app).post('/login').send({ email: 'x@teste.com', senha: 'errada' });
    }
    expect(ultimaResposta.status).toBe(429);
  }, 15000);
});

describe('DELETE /usuarios/:id — exclusão de conta (LGPD)', () => {
  test('um usuário não consegue excluir a conta de outro usuário', async () => {
    const res = await request(app).delete('/usuarios/2').set('Authorization', `Bearer ${tokenPara(1)}`);
    expect(res.status).toBe(403);
  });

  test('sem token, a exclusão é recusada', async () => {
    const res = await request(app).delete('/usuarios/1');
    expect(res.status).toBe(401);
  });

  test('o dono da conta consegue excluir a própria conta, e os dados associados são limpos', async () => {
    dbRouter.on(/SELECT arquivo_urgencia FROM reservas WHERE usuario_id = \?/, () => [
      { arquivo_urgencia: '/uploads/1699999999-laudo.pdf' },
    ]);
    dbRouter.on(/SELECT f\.conteudo FROM formularios f[\s\S]*JOIN reservas r/, () => [
      { conteudo: JSON.stringify({ anexoExame: '/uploads/1699999998-exame.pdf' }) },
    ]);
    dbRouter.on(/DELETE FROM notificacoes_vaga WHERE profissional_id = \? OR usuario_notificado_id = \?/, () => ({ affectedRows: 0 }));
    dbRouter.on(/DELETE FROM notificacoes_profissional WHERE profissional_id = \?/, () => ({ affectedRows: 0 }));
    dbRouter.on(/DELETE FROM notificacoes_paciente WHERE usuario_id = \?/, () => ({ affectedRows: 0 }));
    dbRouter.on(/DELETE FROM usuario WHERE id = \?/, () => ({ affectedRows: 1 }));

    const res = await request(app).delete('/usuarios/1').set('Authorization', `Bearer ${tokenPara(1)}`);

    expect(res.status).toBe(200);
    // as três tabelas sem FOREIGN KEY para usuario precisam ter sido limpas manualmente
    expect(dbRouter.dbPromiseQuery).toHaveBeenCalledWith(
      expect.stringMatching(/DELETE FROM notificacoes_vaga WHERE profissional_id = \? OR usuario_notificado_id = \?/),
      [ '1', '1' ]
    );
    expect(dbRouter.dbPromiseQuery).toHaveBeenCalledWith(
      expect.stringMatching(/DELETE FROM notificacoes_profissional WHERE profissional_id = \?/),
      [ '1' ]
    );
    expect(dbRouter.dbPromiseQuery).toHaveBeenCalledWith(
      expect.stringMatching(/DELETE FROM notificacoes_paciente WHERE usuario_id = \?/),
      [ '1' ]
    );
  });

  test('usuário inexistente retorna 404 em vez de 200', async () => {
    dbRouter.on(/SELECT arquivo_urgencia FROM reservas WHERE usuario_id = \?/, () => []);
    dbRouter.on(/SELECT f\.conteudo FROM formularios f[\s\S]*JOIN reservas r/, () => []);
    dbRouter.on(/DELETE FROM notificacoes_vaga WHERE profissional_id = \? OR usuario_notificado_id = \?/, () => ({ affectedRows: 0 }));
    dbRouter.on(/DELETE FROM notificacoes_profissional WHERE profissional_id = \?/, () => ({ affectedRows: 0 }));
    dbRouter.on(/DELETE FROM notificacoes_paciente WHERE usuario_id = \?/, () => ({ affectedRows: 0 }));
    dbRouter.on(/DELETE FROM usuario WHERE id = \?/, () => ({ affectedRows: 0 }));

    const res = await request(app).delete('/usuarios/1').set('Authorization', `Bearer ${tokenPara(1)}`);
    expect(res.status).toBe(404);
  });
});
