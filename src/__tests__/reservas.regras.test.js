// Testes de REGRA DE NEGÓCIO + INTEGRAÇÃO do módulo de Reaproveitamento de Horários
// (backend/src/views/reservasView.js), validando a janela de cancelamento de 48h descrita
// no artigo (Seção IV-B). Sobe o app Express real (via createApp) com supertest, mas
// substitui o banco (mysql2) e o envio de e-mail por mocks controlados.
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

// reservasView.js reconstrói a data/hora da reserva com `new Date(ano, mes-1, dia, hh, mm)`,
// ou seja, em horário LOCAL. Por isso o helper abaixo monta `dia` também a partir dos
// componentes locais (getFullYear/getMonth/getDate) — usar toISOString() (que é UTC)
// para a data e getHours()/getMinutes() (locais) para o horário misturava dois fusos
// diferentes e podia empurrar o teste para o lado errado da janela de 48h dependendo do
// horário do dia em que a suíte rodasse.
const diaHorarioDaqui = (horasNoFuturo) => {
  const alvo = new Date(Date.now() + horasNoFuturo * 60 * 60 * 1000);
  const dia = `${alvo.getFullYear()}-${String(alvo.getMonth() + 1).padStart(2, '0')}-${String(alvo.getDate()).padStart(2, '0')}`;
  const horario = `${String(alvo.getHours()).padStart(2, '0')}:${String(alvo.getMinutes()).padStart(2, '0')}`;
  return { dia, horario };
};

describe('DELETE /reservas/:id — regra das 48h de antecedência (regra de negócio)', () => {
  beforeEach(() => dbRouter.reset());

  test('bloqueia o cancelamento quando faltam menos de 48h para a consulta', async () => {
    const { dia, horario } = diaHorarioDaqui(10); // daqui a 10h — dentro da janela protegida
    dbRouter.on(/SELECT usuario_id, profissional_id, dia, horario FROM reservas/, () => [
      { usuario_id: 1, profissional_id: 2, dia, horario },
    ]);

    const res = await request(app)
      .delete('/reservas/123')
      .set('Authorization', `Bearer ${tokenPara(1)}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/48h/);
  });

  test('permite o cancelamento quando faltam mais de 48h para a consulta', async () => {
    const { dia, horario } = diaHorarioDaqui(72); // daqui a 72h — fora da janela protegida
    dbRouter.on(/SELECT usuario_id, profissional_id, dia, horario FROM reservas/, () => [
      { usuario_id: 1, profissional_id: 2, dia, horario },
    ]);
    dbRouter.on(/DELETE FROM reservas WHERE id = \?/, () => ({ affectedRows: 1 }));

    const res = await request(app)
      .delete('/reservas/123')
      .set('Authorization', `Bearer ${tokenPara(1)}`);

    expect(res.status).toBe(200);
  });

  test('exatamente 48h de antecedência ainda é bloqueado (limite é inclusivo/protetivo)', async () => {
    const { dia, horario } = diaHorarioDaqui(48);
    dbRouter.on(/SELECT usuario_id, profissional_id, dia, horario FROM reservas/, () => [
      { usuario_id: 1, profissional_id: 2, dia, horario },
    ]);

    const res = await request(app)
      .delete('/reservas/123')
      .set('Authorization', `Bearer ${tokenPara(1)}`);

    // getTime() - Date.now() < 48h => bloqueia; em 48h "cravado" a diferença tende a ficar
    // abaixo do limiar por causa do arredondamento de minuto, então também deve bloquear.
    expect(res.status).toBe(403);
  });

  test('profissional pode excluir a reserva de um paciente mesmo dentro das 48h (regra só vale para o próprio paciente)', async () => {
    const { dia, horario } = diaHorarioDaqui(5); // dentro da janela — mas quem está agindo é o profissional
    dbRouter.on(/SELECT usuario_id, profissional_id, dia, horario FROM reservas/, () => [
      { usuario_id: 1, profissional_id: 2, dia, horario },
    ]);
    dbRouter.on(/DELETE FROM reservas WHERE id = \?/, () => ({ affectedRows: 1 }));

    const res = await request(app)
      .delete('/reservas/123')
      .set('Authorization', `Bearer ${tokenPara(2)}`); // profissional_id = 2

    expect(res.status).toBe(200);
  });

  test('retorna 404 quando a reserva não existe', async () => {
    dbRouter.on(/SELECT usuario_id, profissional_id, dia, horario FROM reservas/, () => []);

    const res = await request(app)
      .delete('/reservas/999')
      .set('Authorization', `Bearer ${tokenPara(1)}`);

    expect(res.status).toBe(404);
  });
});

describe('POST /reservas — bloqueio de agendamento por ausência pós-confirmação (regra de negócio)', () => {
  beforeEach(() => dbRouter.reset());

  test('recusa nova reserva enquanto o paciente estiver bloqueado', async () => {
    const amanha = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    dbRouter.on(/SELECT tipoUsuario FROM usuario WHERE id/, () => [{ tipoUsuario: 'paciente' }]);
    dbRouter.on(/SELECT bloqueado_ate, motivo_bloqueio FROM usuario/, () => [
      { bloqueado_ate: amanha, motivo_bloqueio: 'Ausência em consultas já confirmadas por você (2ª ocorrência ou mais).' },
    ]);

    const res = await request(app)
      .post('/reservas')
      .set('Authorization', `Bearer ${tokenPara(1)}`)
      .send({ nome: 'Ana', sobrenome: 'Silva', dia: '2099-01-01', horario: '10:00', profissional_id: 2 });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/impedido de agendar/);
  });

  test('permite nova reserva quando o bloqueio já expirou', async () => {
    const ontem = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    dbRouter.on(/SELECT tipoUsuario FROM usuario WHERE id/, () => [{ tipoUsuario: 'paciente' }]);
    dbRouter.on(/SELECT bloqueado_ate, motivo_bloqueio FROM usuario/, () => [{ bloqueado_ate: ontem, motivo_bloqueio: null }]);
    dbRouter.on(/INSERT INTO reservas/, () => ({ insertId: 55, affectedRows: 1 }));
    dbRouter.on(/SELECT nome, sobrenome, email, genero FROM usuario WHERE id/, () => [
      { nome: 'Prof', sobrenome: 'Teste', email: 'prof@teste.com', genero: 'masculino' },
    ]);

    const res = await request(app)
      .post('/reservas')
      .set('Authorization', `Bearer ${tokenPara(1)}`)
      .send({ nome: 'Ana', sobrenome: 'Silva', dia: '2099-01-01', horario: '10:00', profissional_id: 2 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
