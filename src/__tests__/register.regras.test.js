// Testes de REGRA DE NEGÓCIO + INTEGRAÇÃO do cadastro (POST /register — backend/src/views/authView.js),
// cobrindo especificamente as validações descritas no artigo (Seção II-G / IV-A):
// - CPF validado por dígito verificador (algoritmo oficial da Receita Federal);
// - exigência e formato do número de registro no conselho profissional por categoria
//   (CRM, CRO, CRN, CREFITO, CRFa, CRP), impedindo perfis duplicados;
// - unicidade de e-mail e de número de conselho.
// O banco é mockado; os testes param antes de chegar no INSERT (não testam o cadastro
// bem-sucedido fim a fim, que dispara rotinas de seed de dados de demonstração à parte).
const request = require('supertest');

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


jest.mock('../middlewares/rateLimit', () => ({
  loginLimiter: (req, res, next) => next(),
  registerLimiter: (req, res, next) => next(),
  forgotPasswordLimiter: (req, res, next) => next(),
}));

const { createApp } = require('../app');
const dbRouter = require('../db').__router;

const app = createApp();

const CPF_VALIDO_1 = '12345678909';
const CPF_VALIDO_2 = '52998224725';

const nenhumUsuarioComEsseCpf = () => dbRouter.on(/SELECT \* FROM usuario WHERE cpf = \?/, () => []);
const nenhumEmailDuplicado = () => dbRouter.on(/SELECT id FROM usuario WHERE email = \?/, () => []);
const nenhumConselhoDuplicado = () => dbRouter.on(/SELECT id FROM usuario WHERE numeroConselho = \?/, () => []);

const basePaciente = {
  nome: 'Ana', sobrenome: 'Silva', telefone: '11999999999',
  email: 'ana@teste.com', senha: 'senha123',
};

describe('POST /register — validação de CPF (regra de negócio)', () => {
  beforeEach(() => dbRouter.reset());

  test('rejeita CPF com dígito verificador inválido', async () => {
    const res = await request(app)
      .post('/register')
      .send({ ...basePaciente, cpf: '12345678900' }); // dígitos verificadores errados

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/CPF inválido/);
  });

  test('rejeita CPF com todos os dígitos iguais', async () => {
    const res = await request(app)
      .post('/register')
      .send({ ...basePaciente, cpf: '11111111111' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/CPF inválido/);
  });

  test('rejeita CPF com quantidade de dígitos incorreta', async () => {
    const res = await request(app)
      .post('/register')
      .send({ ...basePaciente, cpf: '123456789' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/11 dígitos/);
  });

  test('aceita um CPF com dígito verificador correto e completa o cadastro do paciente', async () => {
    nenhumUsuarioComEsseCpf();
    nenhumEmailDuplicado();
    dbRouter.on(/INSERT INTO usuario/, () => ({ insertId: 123, affectedRows: 1 }));

    const res = await request(app)
      .post('/register')
      .send({ ...basePaciente, cpf: CPF_VALIDO_1 });

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(123);
  });
});

describe('POST /register — gênero e unicidade (regra de negócio)', () => {
  beforeEach(() => dbRouter.reset());

  test('rejeita gênero fora da lista de valores válidos', async () => {
    const res = await request(app)
      .post('/register')
      .send({ ...basePaciente, cpf: CPF_VALIDO_1, genero: 'invalido' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Gênero inválido/);
  });

  test('rejeita e-mail já cadastrado', async () => {
    nenhumUsuarioComEsseCpf();
    dbRouter.on(/SELECT id FROM usuario WHERE email = \?/, () => [{ id: 1 }]);

    const res = await request(app)
      .post('/register')
      .send({ ...basePaciente, cpf: CPF_VALIDO_1 });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/e-mail já está cadastrado/);
    expect(res.body.field).toBe('email');
  });

  test('rejeita CPF já cadastrado por outro usuário (sem elegibilidade de upgrade para profissional)', async () => {
    dbRouter.on(/SELECT \* FROM usuario WHERE cpf = \?/, () => [
      { id: 9, email: 'outro@teste.com', senha: '$2a$10$hashqualquer', tipoUsuario: 'paciente' },
    ]);

    const res = await request(app)
      .post('/register')
      .send({ ...basePaciente, cpf: CPF_VALIDO_1, tipoUsuario: 'paciente' });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/Já existe um usuário cadastrado/);
  });

  test('não cria uma segunda consulta demo quando a reserva de demonstração já existe para o paciente', async () => {
    dbRouter.on(/SELECT \* FROM usuario WHERE cpf = \?/, () => []);
    dbRouter.on(/SELECT id FROM usuario WHERE email = \?/, (params) => {
      const [email] = params;
      if (email === basePaciente.email) return [];
      if (email === 'fabio.demo@sistema.local') return [{ id: 77 }];
      return [];
    });
    dbRouter.on(/SELECT id FROM reservas WHERE usuario_id = \? AND profissional_id = \? AND status = 'confirmado' LIMIT 1/, () => [{ id: 999 }]);
    dbRouter.on(/INSERT INTO usuario/, () => ({ insertId: 123, affectedRows: 1 }));

    const res = await request(app)
      .post('/register')
      .send({ ...basePaciente, cpf: CPF_VALIDO_1 });

    expect(res.status).toBe(200);
    const insertReservaCalls = dbRouter.dbPromiseQuery.mock.calls.filter(([sql]) => /INSERT INTO reservas/.test(String(sql)));
    expect(insertReservaCalls).toHaveLength(0);
  });
});

describe('POST /register — validação de registro em conselho profissional (regra de negócio)', () => {
  beforeEach(() => {
    dbRouter.reset();
    // O handler consulta CPF e e-mail duplicados ANTES de validar os campos específicos
    // de profissional — sem isso, a Promise de dbPromise.query rejeita sem handler de
    // erro no route (não há try/catch nessa parte do authView.js) e a requisição trava
    // até o timeout do Jest. Deixamos "livre" por padrão; testes específicos sobrescrevem.
    nenhumUsuarioComEsseCpf();
    nenhumEmailDuplicado();
  });

  const baseProfissional = {
    ...basePaciente,
    cpf: CPF_VALIDO_2,
    tipoUsuario: 'profissional',
    ufRegiao: 'PI',
  };

  test('rejeita profissional sem tipoProfissional informado', async () => {
    const res = await request(app).post('/register').send(baseProfissional);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Tipo de profissional é obrigatório/);
  });

  test('rejeita médico sem especialidade médica', async () => {
    const res = await request(app)
      .post('/register')
      .send({ ...baseProfissional, tipoProfissional: 'medico' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Especialidade médica é obrigatória/);
  });

  test('rejeita profissional "outros" sem profissão customizada', async () => {
    const res = await request(app)
      .post('/register')
      .send({ ...baseProfissional, tipoProfissional: 'outros' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Profissão customizada é obrigatória/);
  });

  test('rejeita profissional sem número de conselho', async () => {
    const res = await request(app)
      .post('/register')
      .send({ ...baseProfissional, tipoProfissional: 'medico', especialidadeMedica: 'Clínico Geral' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Número do conselho é obrigatório/);
  });

  test('rejeita CRM fora do formato esperado (CRM/UF NNNNNN)', async () => {
    const res = await request(app)
      .post('/register')
      .send({
        ...baseProfissional, tipoProfissional: 'medico', especialidadeMedica: 'Clínico Geral',
        numeroConselho: '12345', // sem o prefixo CRM/UF
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Formato esperado: CRM\/PI 425041/);
  });

  test('rejeita CREFITO fora do formato esperado', async () => {
    const res = await request(app)
      .post('/register')
      .send({
        ...baseProfissional, tipoProfissional: 'fisioterapeuta',
        numeroConselho: 'CREFITO123456', // faltam barra e sufixo -F/-T
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/CREFITO-8\/123456-F/);
  });

  test('aceita CRM no formato correto, mas rejeita se o número já estiver cadastrado', async () => {
    nenhumUsuarioComEsseCpf();
    nenhumEmailDuplicado();
    dbRouter.on(/SELECT id FROM usuario WHERE numeroConselho = \?/, () => [{ id: 5 }]);

    const res = await request(app)
      .post('/register')
      .send({
        ...baseProfissional, tipoProfissional: 'medico', especialidadeMedica: 'Clínico Geral',
        numeroConselho: 'CRM/PI 425041',
      });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/número de conselho já está cadastrado/);
    expect(res.body.field).toBe('numeroConselho');
  });

  test('rejeita profissional sem UF/Região quando o número de conselho é válido e inédito', async () => {
    nenhumUsuarioComEsseCpf();
    nenhumEmailDuplicado();
    nenhumConselhoDuplicado();

    const res = await request(app)
      .post('/register')
      .send({
        nome: 'Carlos', sobrenome: 'Souza', telefone: '11999999999', email: 'carlos@teste.com', senha: 'senha123',
        cpf: CPF_VALIDO_2, tipoUsuario: 'profissional', tipoProfissional: 'medico', especialidadeMedica: 'Clínico Geral',
        numeroConselho: 'CRM/PI 425041',
        // ufRegiao propositalmente omitida
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/UF\/Região é obrigatória/);
  });
});
