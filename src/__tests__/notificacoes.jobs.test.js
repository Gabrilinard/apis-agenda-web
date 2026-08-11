// Testes UNITÁRIOS dos jobs de background (backend/src/jobs/) que fazem o motor do
// Sistema de Reaproveitamento de Horários e das Urgências funcionar sem ação manual:
// lembrete de confirmação de presença (janela das 48h), auto-liberação por falta de
// confirmação (janela das 15h) e lembrete horário de urgência sem resposta.
// Os models e o módulo de e-mail são mockados diretamente (jest.mock), então aqui não
// sobe Express nem banco — é a lógica dos jobs isolada, chamando as funções exportadas
// (checkLembretesPresenca, checkAutoLiberacao, checkLembretesUrgencia) como o setInterval
// do job faria a cada 5 minutos em produção.
jest.mock('../models/reservasModel');
jest.mock('../models/vagasModel');
jest.mock('../models/notificacoesPacienteModel');
jest.mock('../email');

const reservasModel = require('../models/reservasModel');
const vagasModel = require('../models/vagasModel');
const notificacoesPacienteModel = require('../models/notificacoesPacienteModel');
const email = require('../email');

const { checkLembretesPresenca, checkAutoLiberacao } = require('../jobs/confirmacaoPresenca');
const { checkLembretesUrgencia } = require('../jobs/urgenciaLembrete');

beforeEach(() => jest.clearAllMocks());

describe('checkLembretesPresenca — lembrete de confirmação ao entrar na janela de 48h', () => {
  test('envia e-mail, cria notificação ao paciente e marca o lembrete como enviado', async () => {
    reservasModel.listParaLembretePresenca.mockResolvedValue([
      {
        id: 10, dia: '2099-06-10', horario: '09:00', usuario_id: 1,
        pac_nome: 'Ana', pac_sobrenome: 'Silva', pac_email: 'ana@teste.com',
        prof_nome: 'Carlos', prof_sobrenome: 'Souza', prof_genero: 'masculino',
      },
    ]);
    email.emailConfirmarPresenca.mockResolvedValue(undefined);
    notificacoesPacienteModel.criar.mockResolvedValue(undefined);
    reservasModel.marcarConfirmacaoPresencaEnviada.mockResolvedValue(undefined);

    await checkLembretesPresenca();

    expect(email.emailConfirmarPresenca).toHaveBeenCalledWith(
      expect.objectContaining({ pacienteEmail: 'ana@teste.com', pacienteNome: 'Ana Silva', dia: '10/06/2099', horario: '09:00' })
    );
    expect(notificacoesPacienteModel.criar).toHaveBeenCalledWith(
      expect.objectContaining({ usuario_id: 1, reserva_id: 10 })
    );
    expect(reservasModel.marcarConfirmacaoPresencaEnviada).toHaveBeenCalledWith(10);
  });

  test('continua e marca o envio mesmo se o e-mail falhar (não trava o job por causa de uma falha isolada)', async () => {
    reservasModel.listParaLembretePresenca.mockResolvedValue([
      { id: 11, dia: '2099-06-11', horario: '10:00', usuario_id: 2, pac_nome: 'Bruno', pac_sobrenome: 'Lima', pac_email: 'bruno@teste.com', prof_nome: 'Dra', prof_sobrenome: 'X', prof_genero: 'feminino' },
    ]);
    email.emailConfirmarPresenca.mockRejectedValue(new Error('falha no provedor de e-mail'));
    notificacoesPacienteModel.criar.mockResolvedValue(undefined);
    reservasModel.marcarConfirmacaoPresencaEnviada.mockResolvedValue(undefined);

    await expect(checkLembretesPresenca()).resolves.not.toThrow();

    expect(notificacoesPacienteModel.criar).toHaveBeenCalled();
    expect(reservasModel.marcarConfirmacaoPresencaEnviada).toHaveBeenCalledWith(11);
  });

  test('não faz nada quando não há reservas na janela (lista vazia)', async () => {
    reservasModel.listParaLembretePresenca.mockResolvedValue([]);

    await checkLembretesPresenca();

    expect(email.emailConfirmarPresenca).not.toHaveBeenCalled();
    expect(notificacoesPacienteModel.criar).not.toHaveBeenCalled();
  });
});

describe('checkAutoLiberacao — libera automaticamente quem não confirmou presença até 15h antes', () => {
  test('libera o horário, notifica o paciente por e-mail e cria notificação para o profissional', async () => {
    reservasModel.listParaAutoLiberarPorFaltaConfirmacao.mockResolvedValue([
      {
        id: 20, dia: '2099-06-10', horario: '09:00',
        pac_nome: 'Ana', pac_sobrenome: 'Silva', pac_email: 'ana@teste.com',
        prof_id: 99, prof_nome: 'Carlos', prof_sobrenome: 'Souza', prof_email: 'carlos@teste.com', prof_genero: 'masculino',
      },
    ]);
    reservasModel.autoLiberarPorFaltaConfirmacao.mockResolvedValue(undefined);
    email.emailHorarioLiberadoPorFaltaConfirmacao.mockResolvedValue(undefined);
    vagasModel.criarNotificacaoProfissional.mockResolvedValue(undefined);

    await checkAutoLiberacao();

    expect(reservasModel.autoLiberarPorFaltaConfirmacao).toHaveBeenCalledWith(20);
    expect(email.emailHorarioLiberadoPorFaltaConfirmacao).toHaveBeenCalledWith(
      expect.objectContaining({ pacienteEmail: 'ana@teste.com', profissionalEmail: 'carlos@teste.com', dia: '10/06/2099', horario: '09:00' })
    );
    expect(vagasModel.criarNotificacaoProfissional).toHaveBeenCalledWith(
      expect.objectContaining({
        profissional_id: 99,
        reserva_id: 20,
        mensagem: expect.stringMatching(/não confirmou presença a tempo/),
      })
    );
  });

  test('se a liberação no banco falhar, não dispara e-mail nem notificação para essa reserva (evita avisar sobre algo que não aconteceu)', async () => {
    reservasModel.listParaAutoLiberarPorFaltaConfirmacao.mockResolvedValue([
      { id: 21, dia: '2099-06-10', horario: '09:00', pac_nome: 'A', pac_sobrenome: 'B', pac_email: 'a@teste.com', prof_id: 99, prof_nome: 'C', prof_sobrenome: 'D', prof_email: 'c@teste.com', prof_genero: 'masculino' },
    ]);
    reservasModel.autoLiberarPorFaltaConfirmacao.mockRejectedValue(new Error('erro de banco'));

    await expect(checkAutoLiberacao()).resolves.not.toThrow();

    expect(email.emailHorarioLiberadoPorFaltaConfirmacao).not.toHaveBeenCalled();
    expect(vagasModel.criarNotificacaoProfissional).not.toHaveBeenCalled();
  });

  test('não faz nada quando não há reservas para auto-liberar', async () => {
    reservasModel.listParaAutoLiberarPorFaltaConfirmacao.mockResolvedValue([]);

    await checkAutoLiberacao();

    expect(reservasModel.autoLiberarPorFaltaConfirmacao).not.toHaveBeenCalled();
  });
});

describe('checkLembretesUrgencia — lembrete horário de urgência sem resposta', () => {
  test('envia e-mail ao profissional e ao paciente, cria as duas notificações e marca o lembrete como enviado', async () => {
    const umaHoraAtras = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    reservasModel.listUrgenciasSemRespostaHaUmaHora.mockResolvedValue([
      {
        id: 30, usuario_id: 1, profissional_id: 99, created_at: umaHoraAtras,
        pac_nome: 'Ana', pac_sobrenome: 'Silva', pac_email: 'ana@teste.com', pac_telefone: '11999999999',
        prof_nome: 'Carlos', prof_sobrenome: 'Souza', prof_email: 'carlos@teste.com', prof_genero: 'masculino',
        descricao_urgencia: 'Dor aguda',
      },
    ]);
    email.emailUrgenciaLembreteProfissional.mockResolvedValue(undefined);
    email.emailUrgenciaLembretePaciente.mockResolvedValue(undefined);
    vagasModel.criarNotificacaoProfissional.mockResolvedValue(undefined);
    notificacoesPacienteModel.criar.mockResolvedValue(undefined);
    reservasModel.marcarLembreteUrgenciaEnviado.mockResolvedValue(undefined);

    await checkLembretesUrgencia();

    expect(email.emailUrgenciaLembreteProfissional).toHaveBeenCalledWith(
      expect.objectContaining({ profissionalEmail: 'carlos@teste.com', pacienteNome: 'Ana Silva' })
    );
    expect(email.emailUrgenciaLembretePaciente).toHaveBeenCalledWith(
      expect.objectContaining({ pacienteEmail: 'ana@teste.com', profissionalNome: 'Carlos Souza' })
    );
    expect(vagasModel.criarNotificacaoProfissional).toHaveBeenCalledWith(
      expect.objectContaining({ profissional_id: 99, reserva_id: 30 })
    );
    expect(notificacoesPacienteModel.criar).toHaveBeenCalledWith(
      expect.objectContaining({ usuario_id: 1, reserva_id: 30 })
    );
    expect(reservasModel.marcarLembreteUrgenciaEnviado).toHaveBeenCalledWith(30);
  });

  test('não faz nada quando não há urgências pendentes há mais de 1h', async () => {
    reservasModel.listUrgenciasSemRespostaHaUmaHora.mockResolvedValue([]);

    await checkLembretesUrgencia();

    expect(email.emailUrgenciaLembreteProfissional).not.toHaveBeenCalled();
    expect(reservasModel.marcarLembreteUrgenciaEnviado).not.toHaveBeenCalled();
  });
});
