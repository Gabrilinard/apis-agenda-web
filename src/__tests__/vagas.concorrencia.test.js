// Teste de CONCORRÊNCIA do Sistema de Reaproveitamento de Horários
// (backend/src/views/vagasView.js), validando a janela de desempate de ~1,2s descrita
// no artigo (Seção IV-B): quando dois pacientes aceitam a mesma vaga liberada quase ao
// mesmo tempo, apenas um pode ganhar, e a prioridade deve seguir a regra definida:
// 1º) paciente com urgência não emergencial pendente; 2º) consulta mais próxima da vaga.
//
// As duas requisições HTTP concorrentes são disparadas de verdade via supertest
// (Promise.all), exercitando o mesmo temporizador (setTimeout) e a mesma fila em memória
// que o servidor usaria em produção — não é um mock da lógica de desempate, é o código real.
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
// /vagas/aceitar exige tanto o token secreto da notificação quanto que o usuário
// autenticado seja o mesmo notificado (correção de IDOR — ver idor-ampliado.test.js).
// Por isso cada candidato precisa de um JWT com o próprio id, não um token genérico.
const tokenPara = (id) => jwt.sign({ id }, config.jwtSecret, { expiresIn: '1h' });

const PROFISSIONAL_ID = 99;
const VAGA_LIBERADA_ID = 500;
const DIA_VAGA = '2099-06-10';
const HORARIO_VAGA = '09:00';

// Registra todas as rotas de banco necessárias para o fluxo completo de aceite de vaga,
// parametrizando o que cada candidato (urgente x não urgente, distância da consulta atual)
// deve devolver quando consultado.
const configurarCenario = ({ candidatoA, candidatoB }) => {
  const notifs = {
    1: { id: 1, token: 'token-a', profissional_id: PROFISSIONAL_ID, reserva_liberada_id: VAGA_LIBERADA_ID, dia: DIA_VAGA, horario: HORARIO_VAGA, horarioFinal: '10:00', usuario_notificado_id: candidatoA.usuarioId, reserva_candidato_id: null },
    2: { id: 2, token: 'token-b', profissional_id: PROFISSIONAL_ID, reserva_liberada_id: VAGA_LIBERADA_ID, dia: DIA_VAGA, horario: HORARIO_VAGA, horarioFinal: '10:00', usuario_notificado_id: candidatoB.usuarioId, reserva_candidato_id: null },
  };

  dbRouter.on(/SELECT \* FROM notificacoes_vaga WHERE id = \? AND token = \?/, (params) => {
    const [id, token] = params;
    const notif = notifs[id];
    return notif && notif.token === token ? [notif] : [];
  });

  dbRouter.on(/SELECT id, dia, horario, is_urgente[\s\S]*FROM reservas[\s\S]*WHERE usuario_id = \?/, (params) => {
    const [usuarioId] = params;
    if (usuarioId === candidatoA.usuarioId) return [candidatoA.reservaDisponivel];
    if (usuarioId === candidatoB.usuarioId) return [candidatoB.reservaDisponivel];
    return [];
  });

  dbRouter.on(/SELECT COUNT\(\*\) AS total FROM notificacoes_vaga[\s\S]*WHERE usuario_notificado_id = \?[\s\S]*status = 'aceita'/, () => [{ total: 0 }]);

  dbRouter.on(/UPDATE reservas SET dia = \?, horario = \?, horarioFinal = \?, status = "confirmado"/, () => ({ affectedRows: 1 }));
  dbRouter.on(/UPDATE reservas SET status = "transferido" WHERE id = \?/, () => ({ affectedRows: 1 }));
  dbRouter.on(/UPDATE notificacoes_vaga SET status = "aceita" WHERE id = \?/, () => ({ affectedRows: 1 }));
  dbRouter.on(/UPDATE notificacoes_vaga SET status = "expirada" WHERE profissional_id = \?/, () => ({ affectedRows: 1 }));
  dbRouter.on(/UPDATE notificacoes_vaga SET status = "expirada" WHERE usuario_notificado_id = \?/, () => ({ affectedRows: 1 }));

  dbRouter.on(/SELECT nome, sobrenome, email FROM usuario WHERE id = \?/, (params) => {
    const [id] = params;
    if (id === candidatoA.usuarioId) return [{ nome: 'Paciente', sobrenome: 'A', email: 'a@teste.com' }];
    if (id === candidatoB.usuarioId) return [{ nome: 'Paciente', sobrenome: 'B', email: 'b@teste.com' }];
    return [];
  });
  dbRouter.on(/SELECT nome, sobrenome, email, genero FROM usuario WHERE id = \?/, () => [
    { nome: 'Prof', sobrenome: 'Teste', email: 'prof@teste.com', genero: 'masculino' },
  ]);

  dbRouter.on(/INSERT INTO notificacoes_profissional/, () => ({ insertId: 1, affectedRows: 1 }));
  dbRouter.on(/INSERT INTO notificacoes_paciente/, () => ({ insertId: 1, affectedRows: 1 }));
};

describe('POST /vagas/aceitar/:notificacaoId — desempate concorrente (concorrência)', () => {
  beforeEach(() => dbRouter.reset());

  test(
    'paciente com urgência pendente vence mesmo quando o outro candidato tinha consulta mais próxima da vaga',
    async () => {
      const candidatoA = { usuarioId: 10, reservaDisponivel: { id: 111, dia: '2099-06-01', horario: '09:00', is_urgente: 1 } }; // urgente, mais longe
      const candidatoB = { usuarioId: 20, reservaDisponivel: { id: 222, dia: '2099-06-09', horario: '09:00', is_urgente: 0 } }; // não urgente, mais perto
      configurarCenario({ candidatoA, candidatoB });

      const [respA, respB] = await Promise.all([
        request(app).post('/vagas/aceitar/1').send({ token: 'token-a' }).set('Authorization', `Bearer ${tokenPara(10)}`),
        request(app).post('/vagas/aceitar/2').send({ token: 'token-b' }).set('Authorization', `Bearer ${tokenPara(20)}`),
      ]);

      expect(respA.status).toBe(200);
      expect(respA.body.success).toBe(true);

      expect(respB.status).toBe(409);
      expect(respB.body.error).toMatch(/Outro paciente confirmou/);
    },
    15000
  );

  test(
    'entre dois candidatos não urgentes, vence quem tem a consulta mais próxima da vaga liberada',
    async () => {
      const candidatoA = { usuarioId: 10, reservaDisponivel: { id: 111, dia: '2099-07-01', horario: '09:00', is_urgente: 0 } }; // mais longe
      const candidatoB = { usuarioId: 20, reservaDisponivel: { id: 222, dia: '2099-06-09', horario: '09:00', is_urgente: 0 } }; // mais perto
      configurarCenario({ candidatoA, candidatoB });

      const [respA, respB] = await Promise.all([
        request(app).post('/vagas/aceitar/1').send({ token: 'token-a' }).set('Authorization', `Bearer ${tokenPara(10)}`),
        request(app).post('/vagas/aceitar/2').send({ token: 'token-b' }).set('Authorization', `Bearer ${tokenPara(20)}`),
      ]);

      expect(respA.status).toBe(409); // A estava mais longe da vaga, perde
      expect(respB.status).toBe(200); // B estava mais perto, vence
      expect(respB.body.success).toBe(true);
    },
    15000
  );

  test(
    'quando os dois aceites chegam fora da janela de desempate (>1,2s de intervalo), cada um processa isoladamente e ambos podem ganhar suas próprias vagas',
    async () => {
      // Cenário de controle: sem concorrência real, cada notificação tem sua própria
      // reserva_liberada_id, então caem em filas (chaves) diferentes e não competem entre si.
      const notifs = {
        1: { id: 1, token: 'token-a', profissional_id: PROFISSIONAL_ID, reserva_liberada_id: 501, dia: DIA_VAGA, horario: HORARIO_VAGA, horarioFinal: '10:00', usuario_notificado_id: 10, reserva_candidato_id: null },
        2: { id: 2, token: 'token-b', profissional_id: PROFISSIONAL_ID, reserva_liberada_id: 502, dia: DIA_VAGA, horario: HORARIO_VAGA, horarioFinal: '10:00', usuario_notificado_id: 20, reserva_candidato_id: null },
      };
      dbRouter.on(/SELECT \* FROM notificacoes_vaga WHERE id = \? AND token = \?/, (params) => {
        const [id, token] = params;
        const notif = notifs[id];
        return notif && notif.token === token ? [notif] : [];
      });
      dbRouter.on(/SELECT id, dia, horario, is_urgente[\s\S]*FROM reservas[\s\S]*WHERE usuario_id = \?/, (params) => {
        const [usuarioId] = params;
        if (usuarioId === 10) return [{ id: 111, dia: '2099-06-01', horario: '09:00', is_urgente: 0 }];
        if (usuarioId === 20) return [{ id: 222, dia: '2099-06-02', horario: '09:00', is_urgente: 0 }];
        return [];
      });
      dbRouter.on(/SELECT COUNT\(\*\) AS total FROM notificacoes_vaga[\s\S]*WHERE usuario_notificado_id = \?[\s\S]*status = 'aceita'/, () => [{ total: 0 }]);
      dbRouter.on(/UPDATE reservas SET dia = \?, horario = \?, horarioFinal = \?, status = "confirmado"/, () => ({ affectedRows: 1 }));
      dbRouter.on(/UPDATE reservas SET status = "transferido" WHERE id = \?/, () => ({ affectedRows: 1 }));
      dbRouter.on(/UPDATE notificacoes_vaga SET status = "aceita" WHERE id = \?/, () => ({ affectedRows: 1 }));
      dbRouter.on(/UPDATE notificacoes_vaga SET status = "expirada" WHERE profissional_id = \?/, () => ({ affectedRows: 1 }));
      dbRouter.on(/UPDATE notificacoes_vaga SET status = "expirada" WHERE usuario_notificado_id = \?/, () => ({ affectedRows: 1 }));
      dbRouter.on(/SELECT nome, sobrenome, email FROM usuario WHERE id = \?/, (params) => {
        const [id] = params;
        return id === 10 ? [{ nome: 'A', sobrenome: 'A', email: 'a@teste.com' }] : [{ nome: 'B', sobrenome: 'B', email: 'b@teste.com' }];
      });
      dbRouter.on(/SELECT nome, sobrenome, email, genero FROM usuario WHERE id = \?/, () => [
        { nome: 'Prof', sobrenome: 'Teste', email: 'prof@teste.com', genero: 'masculino' },
      ]);
      dbRouter.on(/INSERT INTO notificacoes_profissional/, () => ({ insertId: 1, affectedRows: 1 }));
      dbRouter.on(/INSERT INTO notificacoes_paciente/, () => ({ insertId: 1, affectedRows: 1 }));

      const [respA, respB] = await Promise.all([
        request(app).post('/vagas/aceitar/1').send({ token: 'token-a' }).set('Authorization', `Bearer ${tokenPara(10)}`),
        request(app).post('/vagas/aceitar/2').send({ token: 'token-b' }).set('Authorization', `Bearer ${tokenPara(20)}`),
      ]);

      expect(respA.status).toBe(200);
      expect(respB.status).toBe(200);
    },
    15000
  );
});
