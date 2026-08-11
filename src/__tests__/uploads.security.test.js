const fs = require('fs');
const path = require('path');
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

const config = require('../config');
const { createApp } = require('../app');

const app = createApp();
const uploadsDir = path.join(__dirname, '../../uploads');
const NOME_ARQUIVO = `teste-seguranca-${Date.now()}.pdf`;
const CAMINHO_ARQUIVO = path.join(uploadsDir, NOME_ARQUIVO);

beforeAll(() => {
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
  fs.writeFileSync(CAMINHO_ARQUIVO, 'conteudo-sensivel-de-teste');
});

afterAll(() => {
  if (fs.existsSync(CAMINHO_ARQUIVO)) fs.unlinkSync(CAMINHO_ARQUIVO);
});

describe('GET /uploads/:filename — download de arquivos locais exige token assinado (segurança)', () => {
  test('acessar o arquivo diretamente, sem token, é recusado (antes era 100% público)', async () => {
    const res = await request(app).get(`/uploads/${NOME_ARQUIVO}`);
    expect(res.status).toBe(401);
  });

  test('token assinado para OUTRO arquivo não dá acesso a este (o token é amarrado ao nome do arquivo)', async () => {
    const tokenDeOutroArquivo = jwt.sign({ file: 'outro-arquivo.pdf' }, config.jwtSecret, { expiresIn: '5m' });
    const res = await request(app).get(`/uploads/${NOME_ARQUIVO}?token=${tokenDeOutroArquivo}`);
    expect(res.status).toBe(403);
  });

  test('token expirado é recusado', async () => {
    const tokenExpirado = jwt.sign({ file: NOME_ARQUIVO }, config.jwtSecret, { expiresIn: -60 });
    const res = await request(app).get(`/uploads/${NOME_ARQUIVO}?token=${tokenExpirado}`);
    expect(res.status).toBe(401);
  });

  test('token forjado com segredo errado é recusado', async () => {
    const tokenForjado = jwt.sign({ file: NOME_ARQUIVO }, 'segredo-de-atacante', { expiresIn: '5m' });
    const res = await request(app).get(`/uploads/${NOME_ARQUIVO}?token=${tokenForjado}`);
    expect(res.status).toBe(401);
  });

  test('tentativa de path traversal no nome do arquivo é rejeitada', async () => {
    const tokenQualquer = jwt.sign({ file: 'x' }, config.jwtSecret, { expiresIn: '5m' });
    const res = await request(app).get('/uploads/..%2F..%2Fpackage.json').query({ token: tokenQualquer });
    expect([400, 404]).toContain(res.status);
  });

  test('com token válido e correspondente ao arquivo, o download é permitido', async () => {
    const tokenValido = jwt.sign({ file: NOME_ARQUIVO }, config.jwtSecret, { expiresIn: '5m' });
    const res = await request(app).get(`/uploads/${NOME_ARQUIVO}?token=${tokenValido}`);
    expect(res.status).toBe(200);
    expect(Buffer.from(res.body).toString('utf8')).toBe('conteudo-sensivel-de-teste');
  });
});

describe('getFileUrl (middlewares/upload.js) — a URL devolvida ao front-end já vem com o token', () => {
  test('para armazenamento local, getFileUrl embute um token JWT de curta duração na URL', async () => {
    const { getFileUrl } = require('../middlewares/upload');
    const url = await getFileUrl(`/uploads/${NOME_ARQUIVO}`);
    expect(url).toMatch(new RegExp(`^/uploads/${NOME_ARQUIVO}\\?token=`));

    const token = url.split('token=')[1];
    const payload = jwt.verify(token, config.jwtSecret);
    expect(payload.file).toBe(NOME_ARQUIVO);
  });
});
