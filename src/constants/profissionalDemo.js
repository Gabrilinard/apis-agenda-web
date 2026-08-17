const gerarSlotsMeiaHora = (inicio, fim) => {
  const slots = [];
  let [h, m] = inicio.split(':').map(Number);
  const [hFim, mFim] = fim.split(':').map(Number);
  while (h < hFim || (h === hFim && m < mFim)) {
    slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    m += 30;
    if (m >= 60) { m -= 60; h += 1; }
  }
  return slots;
};

const HORARIO_DEMO_DIA = gerarSlotsMeiaHora('09:00', '17:00');

// Fonte única do profissional de demonstração (Fábio). Usado tanto no seed de
// startup (app.js) quanto no seed disparado a cada novo cadastro de paciente
// (authView.js) — mantenha só aqui para os dois nunca ficarem dessincronizados.
const PROFISSIONAL_DEMO = {
  nome: 'Fábio', sobrenome: 'Demonstração', email: 'fabio.demo@sistema.local', cpf: '00000000005',
  telefone: '(11) 90000-0005', tipoProfissional: 'medico', especialidadeMedica: 'Clínico Geral',
  genero: 'masculino', valorConsulta: '150',
  descricao: 'Médico clínico geral com experiência em atendimento de rotina e preventivo. Disponível para consultas presenciais e online.',
  publicoAtendido: 'Todas as idades',
  modalidade: 'presencial',
  valorPresencial: '150',
  valorOnline: '120',
  valorDomiciliar: '200',
  horariosAtendimento: JSON.stringify({
    Segunda: HORARIO_DEMO_DIA,
    Terça: HORARIO_DEMO_DIA,
    Quarta: HORARIO_DEMO_DIA,
    Quinta: HORARIO_DEMO_DIA,
    Sexta: HORARIO_DEMO_DIA,
  }),
  diasAtendimento: JSON.stringify(['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta']),
  ufRegiao: 'SP',
  cidade: 'São Paulo',
};

module.exports = { PROFISSIONAL_DEMO };
