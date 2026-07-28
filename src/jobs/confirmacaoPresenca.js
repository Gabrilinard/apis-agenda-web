const reservasModel = require('../models/reservasModel');
const vagasModel = require('../models/vagasModel');
const notificacoesPacienteModel = require('../models/notificacoesPacienteModel');
const { emailConfirmarPresenca, emailHorarioLiberadoPorFaltaConfirmacao } = require('../email');

const CHECK_INTERVAL_MS = 5 * 60 * 1000;

const formatarDataBR = (dia) => {
  const [ano, mes, diaNum] = String(dia).split('T')[0].split('-');
  return `${diaNum}/${mes}/${ano}`;
};

const checkLembretesPresenca = async () => {
  let reservas;
  try {
    reservas = await reservasModel.listParaLembretePresenca();
  } catch (e) {
    console.error('[confirmacao presenca] erro ao buscar reservas para lembrete:', e.message);
    return;
  }

  for (const r of reservas) {
    const pacienteNome = `${r.pac_nome || ''} ${r.pac_sobrenome || ''}`.trim();
    const profissionalNome = `${r.prof_nome || ''} ${r.prof_sobrenome || ''}`.trim();

    try {
      await emailConfirmarPresenca({
        pacienteEmail: r.pac_email,
        pacienteNome,
        profissionalNome,
        profissionalGenero: r.prof_genero,
        dia: formatarDataBR(r.dia),
        horario: r.horario,
      });
    } catch (e) {
      console.error('[confirmacao presenca] erro ao enviar e-mail de lembrete:', e.message);
    }

    try {
      await notificacoesPacienteModel.criar({
        usuario_id: r.usuario_id,
        reserva_id: r.id,
        mensagem: `Sua consulta com ${profissionalNome} é em breve (${formatarDataBR(r.dia)} às ${r.horario}). Confirme sua presença.`,
      });
    } catch (e) {
      console.error('[confirmacao presenca] erro notificacao paciente:', e.message);
    }

    try {
      await reservasModel.marcarConfirmacaoPresencaEnviada(r.id);
    } catch (e) {
      console.error('[confirmacao presenca] erro ao marcar lembrete enviado:', e.message);
    }
  }
};

const checkAutoLiberacao = async () => {
  let reservas;
  try {
    reservas = await reservasModel.listParaAutoLiberarPorFaltaConfirmacao();
  } catch (e) {
    console.error('[confirmacao presenca] erro ao buscar reservas para auto-liberação:', e.message);
    return;
  }

  for (const r of reservas) {
    const pacienteNome = `${r.pac_nome || ''} ${r.pac_sobrenome || ''}`.trim();
    const profissionalNome = `${r.prof_nome || ''} ${r.prof_sobrenome || ''}`.trim();
    const diaFmt = formatarDataBR(r.dia);

    try {
      await reservasModel.autoLiberarPorFaltaConfirmacao(r.id);
    } catch (e) {
      console.error('[confirmacao presenca] erro ao liberar automaticamente:', e.message);
      continue;
    }

    emailHorarioLiberadoPorFaltaConfirmacao({
      pacienteEmail: r.pac_email,
      pacienteNome,
      profissionalEmail: r.prof_email,
      profissionalNome,
      profissionalGenero: r.prof_genero,
      dia: diaFmt,
      horario: r.horario,
    }).catch(e => console.error('[confirmacao presenca] erro e-mail auto-liberação:', e.message));

    vagasModel.criarNotificacaoProfissional({
      profissional_id: r.prof_id,
      reserva_id: r.id,
      mensagem: `${pacienteNome} não confirmou presença a tempo — o horário de ${diaFmt} às ${r.horario} foi liberado automaticamente. Confira sua agenda.`,
    }).catch(e => console.error('[confirmacao presenca] erro notificacao profissional:', e.message));
  }
};

const startConfirmacaoPresencaJob = () => {
  setInterval(() => {
    checkLembretesPresenca().catch(e => console.error('[confirmacao presenca] erro inesperado (lembrete):', e.message));
    checkAutoLiberacao().catch(e => console.error('[confirmacao presenca] erro inesperado (auto-liberação):', e.message));
  }, CHECK_INTERVAL_MS);
};

module.exports = { startConfirmacaoPresencaJob, checkLembretesPresenca, checkAutoLiberacao };
