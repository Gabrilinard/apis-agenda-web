// Testes de SEGURANÇA descritos no artigo (Seção IV-A): autenticação por JWT, controle
// de acesso por perfil (RBAC) e proteção contra injeção de SQL via prepared statements
// (mysql2). Sobe o app Express real com supertest; banco e e-mail são mockados.
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

describe('Autenticação — rotas protegidas exigem JWT válido (segurança)', () => {
  beforeEach(() => dbRouter.reset());

  test('GET /reservas sem header Authorization retorna 401', async () => {
    const res = await request(app).get('/reservas');
    expect(res.status).toBe(401);
  });

  test('GET /reservas com token assinado com segredo errado retorna 401', async () => {
    const tokenForjado = jwt.sign({ id: 1 }, 'segredo-de-atacante', { expiresIn: '1h' });
    const res = await request(app).get('/reservas').set('Authorization', `Bearer ${tokenForjado}`);
    expect(res.status).toBe(401);
  });

  test('GET /reservas com token expirado retorna 401', async () => {
    const tokenExpirado = jwt.sign({ id: 1 }, config.jwtSecret, { expiresIn: -60 });
    const res = await request(app).get('/reservas').set('Authorization', `Bearer ${tokenExpirado}`);
    expect(res.status).toBe(401);
  });

  test('GET /reservas com token válido é aceito (baseline positivo)', async () => {
    dbRouter.on(/SELECT tipoUsuario FROM usuario WHERE id/, () => [{ tipoUsuario: 'paciente' }]);
    dbRouter.on(/SELECT \* FROM reservas/, () => []);

    const res = await request(app).get('/reservas').set('Authorization', `Bearer ${tokenPara(1)}`);
    expect(res.status).toBe(200);
  });
});

describe('RBAC — um usuário não pode agir sobre dados de outro (segurança)', () => {
  beforeEach(() => dbRouter.reset());

  test('paciente não pode excluir uma reserva que não é dele nem em que ele é o profissional', async () => {
    dbRouter.on(/SELECT usuario_id, profissional_id, dia, horario FROM reservas/, () => [
      { usuario_id: 77, profissional_id: 88, dia: '2099-01-01', horario: '10:00' },
    ]);

    const res = await request(app)
      .delete('/reservas/123')
      .set('Authorization', `Bearer ${tokenPara(1)}`); // nem dono (77) nem profissional (88)

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/não tem permissão/);
  });

  test('paciente não consegue confirmar presença em uma reserva de outro paciente (a query já filtra por usuario_id)', async () => {
    // confirmarPresenca faz UPDATE ... WHERE id = ? AND usuario_id = ? — se o usuario_id
    // não bate, affectedRows = 0 e a rota deve responder 404, não 200.
    dbRouter.on(/UPDATE reservas SET presenca_confirmada = 1 WHERE id = \? AND usuario_id = \?/, () => ({ affectedRows: 0 }));

    const res = await request(app)
      .patch('/reservas/123/confirmar-presenca')
      .set('Authorization', `Bearer ${tokenPara(1)}`);

    expect(res.status).toBe(404);
  });
});

describe('Injeção de SQL — prepared statements protegem os dados de entrada (segurança)', () => {
  beforeEach(() => dbRouter.reset());

  test('payload de SQL injection no e-mail do login é tratado como dado, não como comando SQL', async () => {
    const payloadMalicioso = "' OR '1'='1'; DROP TABLE usuario; --";
    let sqlRecebido = null;
    let paramsRecebidos = null;

    dbRouter.on(/SELECT \* FROM usuario WHERE email = \?/, (params, sqlOriginal) => {
      sqlRecebido = sqlOriginal;
      paramsRecebidos = params;
      return []; // nenhum usuário encontrado — a injeção não deveria "vazar" todos os registros
    });

    const res = await request(app)
      .post('/login')
      .send({ email: payloadMalicioso, senha: 'qualquer' });

    // A query enviada ao driver continua com placeholder (?), nunca com a string concatenada:
    expect(sqlRecebido).toMatch(/WHERE email = \?/);
    expect(sqlRecebido).not.toContain('DROP TABLE');
    // O payload malicioso vira exclusivamente um parâmetro de bind, não altera a query:
    expect(paramsRecebidos).toEqual([payloadMalicioso]);
    // E a tentativa não autentica ninguém:
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Usuário não encontrado/);
  });

  test('payload de SQL injection no CPF do cadastro é rejeitado pela validação antes de tocar o banco', async () => {
    const res = await request(app)
      .post('/register')
      .send({
        nome: 'Ana', sobrenome: 'Silva', email: 'ana@teste.com', senha: 'senha123',
        cpf: "11111111111' OR '1'='1",
      });

    // O CPF "sujo" tem mais de 11 dígitos numéricos após a limpeza (\D removido) ou falha
    // no checksum — de toda forma é rejeitado por validação de negócio, nunca chega ao SQL.
    expect(res.status).toBe(400);
    expect(dbRouter.dbPromiseQuery).not.toHaveBeenCalled();
  });
});

describe('IDOR corrigido: um usuário autenticado não pode mais ler nem editar dados de outro (segurança)', () => {
  beforeEach(() => dbRouter.reset());

  // backend/src/views/usuariosView.js exigia apenas um token válido, sem conferir se o
  // :id da URL correspondia ao req.userId do token — um IDOR (Insecure Direct Object
  // Reference) clássico, que permitia a qualquer paciente autenticado ler e editar o
  // perfil de outro usuário. Corrigido adicionando a checagem de posse nas rotas de
  // escrita e, na rota de leitura, restringindo dados de PACIENTE ao próprio dono
  // (o perfil de um PROFISSIONAL continua acessível a qualquer autenticado, pois já é
  // público em /profissionais e é assim que o paciente vê o profissional antes de agendar).
  test('paciente autenticado NÃO consegue mais ler os dados de outro paciente via GET /usuarios/solicitarDados/:id', async () => {
    dbRouter.on(/SELECT id, tipoUsuario, nome, sobrenome, email, telefone, genero/, () => [
      { id: 2, tipoUsuario: 'paciente', nome: 'Vítima', sobrenome: 'Alheia', email: 'vitima@teste.com', telefone: '11988887777', cidade: 'Teresina' },
    ]);

    const res = await request(app)
      .get('/usuarios/solicitarDados/2') // usuário autenticado é o id 1; pede dados do id 2
      .set('Authorization', `Bearer ${tokenPara(1)}`);

    expect(res.status).toBe(403);
  });

  test('paciente autenticado ainda consegue ler o perfil de um PROFISSIONAL (caso legítimo: ver o profissional antes de agendar)', async () => {
    dbRouter.on(/SELECT id, tipoUsuario, nome, sobrenome, email, telefone, genero/, () => [
      { id: 2, tipoUsuario: 'profissional', nome: 'Dr.', sobrenome: 'Fulano', email: 'medico@teste.com', tipoProfissional: 'medico' },
    ]);

    const res = await request(app)
      .get('/usuarios/solicitarDados/2')
      .set('Authorization', `Bearer ${tokenPara(1)}`);

    expect(res.status).toBe(200);
    expect(res.body.email).toBe('medico@teste.com');
    expect(res.body.tipoUsuario).toBeUndefined(); // campo interno não deve vazar na resposta
  });

  test('paciente autenticado NÃO consegue mais editar o perfil de outro usuário via PATCH /usuarios/:id/perfil', async () => {
    const res = await request(app)
      .patch('/usuarios/2/perfil') // usuário autenticado é o id 1; tenta editar o id 2
      .set('Authorization', `Bearer ${tokenPara(1)}`)
      .send({ nome: 'Nome trocado por um atacante' });

    expect(res.status).toBe(403);
    expect(dbRouter.poolQuery).not.toHaveBeenCalled();
  });

  test('usuário autenticado ainda consegue editar o PRÓPRIO perfil normalmente', async () => {
    dbRouter.on(/UPDATE usuario SET nome = \?/, () => ({ affectedRows: 1 }));

    const res = await request(app)
      .patch('/usuarios/1/perfil')
      .set('Authorization', `Bearer ${tokenPara(1)}`)
      .send({ nome: 'Meu novo nome' });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/Perfil atualizado/);
  });
});

describe('Rota pública não fica mais atrás do authenticate de outro router (regressão do bug de roteamento)', () => {
  beforeEach(() => dbRouter.reset());

  test('GET /profissionais não exige token (é uma rota pública)', async () => {
    dbRouter.on(/FROM usuario u\s*WHERE u\.tipoUsuario = 'profissional'/, () => [
      { id: 1, nome: 'Ana', sobrenome: 'Silva', nomeCompleto: 'Ana Silva', tipoProfissional: 'fisioterapeuta', email: 'ana@teste.com', telefone: '11999999999' },
    ]);
    const res = await request(app).get('/profissionais');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
