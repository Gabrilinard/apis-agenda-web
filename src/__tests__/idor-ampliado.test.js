// Testes de SEGURANÇA (IDOR) que ampliam a auditoria original de security.test.js.
// A primeira rodada de testes só cobriu usuariosView.js; esta cobre o mesmo tipo de
// falha (rota exige login, mas não confere se o dado pedido pertence a quem pediu)
// encontrada depois em reservasView.js, formulariosView.js, vagasView.js e
// avaliacoesView.js. Cada describe documenta o achado, a correção aplicada e o teste
// que comprova o comportamento correto.
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

describe('GET /reservas — corrigido: não é mais possível listar a agenda de outro profissional (IDOR)', () => {
  test('paciente que passa ?profissional_id=99 NÃO recebe mais as consultas de todos os pacientes desse profissional', async () => {
    dbRouter.on(/SELECT tipoUsuario FROM usuario WHERE id/, () => [{ tipoUsuario: 'paciente' }]);
    // Se o filtro por profissional_id da query string ainda fosse aplicado, esta rota
    // devolveria as consultas de TODOS os pacientes do profissional 99. Registramos essa
    // rota só para garantir que, se o bug voltasse, o teste falharia mostrando os dados.
    dbRouter.on(/SELECT \* FROM reservas WHERE profissional_id = \?/, () => [
      { id: 1, usuario_id: 777, nome: 'Outro Paciente', descricao_urgencia: 'dado sensível de terceiro' },
    ]);
    dbRouter.on(/SELECT \* FROM reservas WHERE usuario_id = \?/, () => []);

    const res = await request(app)
      .get('/reservas?profissional_id=99')
      .set('Authorization', `Bearer ${tokenPara(1)}`);

    expect(res.status).toBe(200);
    // A resposta deve vir da consulta filtrada pelo PRÓPRIO usuário (lista vazia aqui),
    // nunca da consulta por profissional_id que devolveria dados de outros pacientes.
    expect(res.body).toEqual([]);
  });

  test('profissional autenticado ainda vê a própria agenda normalmente', async () => {
    dbRouter.on(/SELECT tipoUsuario FROM usuario WHERE id/, () => [{ tipoUsuario: 'profissional' }]);
    dbRouter.on(/SELECT \* FROM reservas WHERE profissional_id = \?/, () => [{ id: 1, usuario_id: 5 }]);

    const res = await request(app).get('/reservas').set('Authorization', `Bearer ${tokenPara(99)}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });
});

describe('formulariosView — corrigido: formulário clínico só é visível para quem participa da consulta (IDOR)', () => {
  test('usuário autenticado que não é o paciente nem o profissional da consulta NÃO consegue mais ler o formulário', async () => {
    dbRouter.on(/SELECT \* FROM formularios WHERE reserva_id = \?/, () => [
      { id: 1, reserva_id: 10, usuario_id: 2, profissional_id: 3, tipo_formulario: 'saude_geral', conteudo: '{}' },
    ]);

    const res = await request(app)
      .get('/formularios/reserva/10')
      .set('Authorization', `Bearer ${tokenPara(1)}`); // nem paciente (2) nem profissional (3)

    expect(res.status).toBe(403);
  });

  test('o próprio paciente da consulta consegue ler o formulário normalmente', async () => {
    dbRouter.on(/SELECT \* FROM formularios WHERE reserva_id = \?/, () => [
      { id: 1, reserva_id: 10, usuario_id: 2, profissional_id: 3, tipo_formulario: 'saude_geral', conteudo: '{}' },
    ]);

    const res = await request(app)
      .get('/formularios/reserva/10')
      .set('Authorization', `Bearer ${tokenPara(2)}`);

    expect(res.status).toBe(200);
  });

  test('o profissional responsável pela consulta também consegue ler o formulário', async () => {
    dbRouter.on(/SELECT \* FROM formularios WHERE reserva_id = \?/, () => [
      { id: 1, reserva_id: 10, usuario_id: 2, profissional_id: 3, tipo_formulario: 'saude_geral', conteudo: '{}' },
    ]);

    const res = await request(app)
      .get('/formularios/reserva/10')
      .set('Authorization', `Bearer ${tokenPara(3)}`);

    expect(res.status).toBe(200);
  });

  test('não é mais possível enviar um formulário informando o usuarioId de outra pessoa', async () => {
    const res = await request(app)
      .post('/formularios')
      .set('Authorization', `Bearer ${tokenPara(1)}`)
      .send({ reservaIds: [10], tipoFormulario: 'saude_geral', usuarioId: 999, conteudo: {} });

    expect(res.status).toBe(403);
  });
});

describe('vagasView — corrigido: cada rota exige que o solicitante seja dono do recurso (IDOR)', () => {
  test('GET /vagas/candidatos não é mais acessível a um profissional diferente do dono da agenda', async () => {
    const res = await request(app)
      .get('/vagas/candidatos?profissional_id=99&dia=2099-01-01')
      .set('Authorization', `Bearer ${tokenPara(1)}`); // token é do usuário 1, não do 99

    expect(res.status).toBe(403);
  });

  test('POST /vagas/notificar não é mais acessível para notificar em nome de outro profissional', async () => {
    const res = await request(app)
      .post('/vagas/notificar')
      .set('Authorization', `Bearer ${tokenPara(1)}`)
      .send({ profissional_id: 99, dia: '2099-01-01', horario: '10:00', usuario_notificado_id: 5 });

    expect(res.status).toBe(403);
  });

  test('GET /vagas/pendentes/:usuarioId não é mais acessível para ver notificações de outro paciente', async () => {
    const res = await request(app)
      .get('/vagas/pendentes/2')
      .set('Authorization', `Bearer ${tokenPara(1)}`);

    expect(res.status).toBe(403);
  });

  test('POST /vagas/aceitar continua funcionando para o próprio dono da notificação (token + posse)', async () => {
    dbRouter.on(/SELECT \* FROM notificacoes_vaga WHERE id = \? AND token = \?/, () => [
      { id: 1, token: 'tok', usuario_notificado_id: 1, profissional_id: 99, reserva_liberada_id: null, dia: '2099-01-01', horario: '10:00' },
    ]);
    dbRouter.on(/SELECT id, dia, horario, is_urgente[\s\S]*FROM reservas[\s\S]*WHERE usuario_id = \?/, () => []);
    dbRouter.on(/SELECT COUNT\(\*\) AS total FROM notificacoes_vaga[\s\S]*WHERE usuario_notificado_id = \?[\s\S]*status = 'aceita'/, () => [{ total: 0 }]);
    dbRouter.on(/UPDATE notificacoes_vaga SET status = "recusada" WHERE id = \?/, () => ({ affectedRows: 1 }));

    const res = await request(app)
      .post('/vagas/aceitar/1')
      .set('Authorization', `Bearer ${tokenPara(1)}`)
      .send({ token: 'tok' });

    // Sem consultas disponíveis para trocar, a vaga não é aceita — mas o importante aqui
    // é que a rota passou pela checagem de posse (não voltou 403) e seguiu o fluxo normal.
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/não tem mais consultas disponíveis/);
  });

  test('POST /vagas/aceitar retorna 403 quando a notificação pertence a outro paciente', async () => {
    dbRouter.on(/SELECT \* FROM notificacoes_vaga WHERE id = \? AND token = \?/, () => [
      { id: 1, token: 'tok', usuario_notificado_id: 2, profissional_id: 99, reserva_liberada_id: null, dia: '2099-01-01', horario: '10:00' },
    ]);

    const res = await request(app)
      .post('/vagas/aceitar/1')
      .set('Authorization', `Bearer ${tokenPara(1)}`) // token é do usuário 1, notificação é do 2
      .send({ token: 'tok' });

    expect(res.status).toBe(403);
  });

  test('POST /vagas/recusar agora exige que a notificação pertença ao usuário autenticado (antes não exigia nada)', async () => {
    dbRouter.on(/SELECT \* FROM notificacoes_vaga WHERE id = \? AND status = "pendente"/, () => [
      { id: 1, usuario_notificado_id: 2 },
    ]);

    const res = await request(app)
      .post('/vagas/recusar/1')
      .set('Authorization', `Bearer ${tokenPara(1)}`); // usuário 1 tentando recusar vaga do usuário 2

    expect(res.status).toBe(403);
  });

  test('POST /vagas/recusar continua funcionando para o próprio dono da notificação, sem exigir token (front-end não envia)', async () => {
    dbRouter.on(/SELECT \* FROM notificacoes_vaga WHERE id = \? AND status = "pendente"/, () => [
      { id: 1, usuario_notificado_id: 1 },
    ]);
    dbRouter.on(/UPDATE notificacoes_vaga SET status = "recusada" WHERE id = \?/, () => ({ affectedRows: 1 }));

    const res = await request(app)
      .post('/vagas/recusar/1')
      .set('Authorization', `Bearer ${tokenPara(1)}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('GET /notificacoes-profissional/:profissionalId não é mais acessível para ler notificações de outro profissional', async () => {
    const res = await request(app)
      .get('/notificacoes-profissional/99')
      .set('Authorization', `Bearer ${tokenPara(1)}`);

    expect(res.status).toBe(403);
  });

  test('GET /vagas/notificados-pendentes/:profissionalId não é mais acessível para outro profissional', async () => {
    const res = await request(app)
      .get('/vagas/notificados-pendentes/99')
      .set('Authorization', `Bearer ${tokenPara(1)}`);

    expect(res.status).toBe(403);
  });
});

describe('notificacoes-paciente — corrigido: só o próprio paciente lê/marca suas notificações (IDOR)', () => {
  test('GET /notificacoes-paciente/:usuarioId bloqueia acesso a notificações de outro paciente', async () => {
    const res = await request(app)
      .get('/notificacoes-paciente/2')
      .set('Authorization', `Bearer ${tokenPara(1)}`);

    expect(res.status).toBe(403);
  });

  test('o próprio paciente continua conseguindo ler suas notificações', async () => {
    dbRouter.on(/SELECT \* FROM notificacoes_paciente/, () => []);

    const res = await request(app)
      .get('/notificacoes-paciente/1')
      .set('Authorization', `Bearer ${tokenPara(1)}`);

    expect(res.status).toBe(200);
  });
});

describe('POST /avaliacoes — corrigido: não é mais possível publicar uma avaliação em nome de outro paciente', () => {
  test('usuario_id do corpo da requisição é ignorado; a avaliação é sempre atribuída a quem está autenticado', async () => {
    let paramsInseridos = null;
    dbRouter.on(/INSERT INTO avaliacoes/, (params) => {
      paramsInseridos = params;
      return { insertId: 1, affectedRows: 1 };
    });

    const res = await request(app)
      .post('/avaliacoes')
      .set('Authorization', `Bearer ${tokenPara(1)}`)
      .send({ reserva_id: 10, usuario_id: 999, profissional_id: 5, nota: 5, comentario: 'ótimo' });

    expect(res.status).toBe(201);
    // params da query: [reserva_id, usuario_id, profissional_id, nota, comentario]
    expect(paramsInseridos[1]).toBe(1); // usuario_id real (do token), não o 999 forjado no corpo
  });

  test('POST /avaliacoes sem token retorna 401', async () => {
    const res = await request(app)
      .post('/avaliacoes')
      .send({ reserva_id: 10, usuario_id: 1, profissional_id: 5, nota: 5 });

    expect(res.status).toBe(401);
  });
});
