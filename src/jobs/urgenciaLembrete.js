const reservasModel = require('../models/reservasModel');
const { emailUrgenciaLembreteProfissional, emailUrgenciaLembretePaciente } = require('../email');

const CHECK_INTERVAL_MS = 5 * 60 * 1000;

const formatHorasDecorridas = (createdAt) => {
  const minutos = Math.max(60, Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000));
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return m > 0 ? `${h}h${m}min` : `${h}h`;
};

const checkLembretesUrgencia = async () => {
  let urgencias;
  try {
    urgencias = await reservasModel.listUrgenciasSemRespostaHaUmaHora();
  } catch (e) {
    console.error('[lembrete urgencia] erro ao buscar urgências pendentes:', e.message);
    return;
  }

  for (const r of urgencias) {
    const pacienteNome = `${r.pac_nome || ''} ${r.pac_sobrenome || ''}`.trim();
    const profissionalNome = `${r.prof_nome || ''} ${r.prof_sobrenome || ''}`.trim();
    const horasDecorridas = formatHorasDecorridas(r.created_at);

    await Promise.all([
      emailUrgenciaLembreteProfissional({
        profissionalEmail: r.prof_email,
        profissionalNome,
        profissionalGenero: r.prof_genero,
        pacienteNome,
        pacienteTelefone: r.pac_telefone || '',
        descricao: r.descricao_urgencia || '',
        horasDecorridas,
      }).catch(e => console.error('[lembrete urgencia] erro e-mail profissional:', e.message)),
      emailUrgenciaLembretePaciente({
        pacienteEmail: r.pac_email,
        pacienteNome,
        profissionalNome,
        profissionalGenero: r.prof_genero,
        horasDecorridas,
      }).catch(e => console.error('[lembrete urgencia] erro e-mail paciente:', e.message)),
    ]);

    try {
      await reservasModel.marcarLembreteUrgenciaEnviado(r.id);
    } catch (e) {
      console.error('[lembrete urgencia] erro ao marcar lembrete enviado:', e.message);
    }
  }
};

const startUrgenciaLembreteJob = () => {
  setInterval(() => {
    checkLembretesUrgencia().catch(e => console.error('[lembrete urgencia] erro inesperado:', e.message));
  }, CHECK_INTERVAL_MS);
};

module.exports = { startUrgenciaLembreteJob, checkLembretesUrgencia };
