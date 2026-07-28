const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const config = require('../config');
const { dbPromise, pool } = require('../db');
const usuariosModel = require('../models/usuariosModel');
const reservasModel = require('../models/reservasModel');
const formulariosModel = require('../models/formulariosModel');
const { serializeLogin } = require('../serializers/authSerializer');
const { emailRedefinicaoSenha } = require('../email');
const { GENEROS_VALIDOS } = require('../utils/titulo');

const router = express.Router();

// Pacientes de demonstração usados para popular a agenda de um profissional recém-cadastrado,
// para que ele já veja exemplos de vaga liberada, consulta pendente e urgência ao entrar pela primeira vez.
const PACIENTES_DEMO = [
  { nome: 'Ana', sobrenome: 'Demonstração', email: 'ana.demo@sistema.local', cpf: '00000000001', telefone: '(11) 90000-0001' },
  { nome: 'Bruno', sobrenome: 'Demonstração', email: 'bruno.demo@sistema.local', cpf: '00000000002', telefone: '(11) 90000-0002' },
  { nome: 'Carla', sobrenome: 'Demonstração', email: 'carla.demo@sistema.local', cpf: '00000000003', telefone: '(11) 90000-0003' },
  { nome: 'Diana', sobrenome: 'Demonstração', email: 'diana.demo@sistema.local', cpf: '00000000004', telefone: '(11) 90000-0004' },
];

const formatarDataISO = (date) => date.toISOString().split('T')[0];

const obterOuCriarPacienteDemo = async (demo) => {
  const [rows] = await dbPromise.query('SELECT id FROM usuario WHERE email = ? LIMIT 1', [demo.email]);
  if (rows.length) return rows[0].id;
  const senhaAleatoria = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10);
  const [result] = await dbPromise.query(
    'INSERT INTO usuario (nome, sobrenome, telefone, email, senha, cpf, tipoUsuario) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [demo.nome, demo.sobrenome, demo.telefone, demo.email, senhaAleatoria, demo.cpf, 'paciente']
  );
  return result.insertId;
};

const criarReservaDemo = (payload) =>
  new Promise((resolve, reject) => {
    reservasModel.createReserva(payload, (err, result) => (err ? reject(err) : resolve(result)));
  });

// Um formulário de anamnese de exemplo por profissão — igual ao que cada tela de
// Formulario/formularios/*.jsx monta e envia, para o profissional já ver o formulário
// do Bruno preenchido de um jeito condizente com a especialidade dele.
const getFormularioDemoBruno = (tipoProfissional, pacB, demo) => {
  const paciente = { id: pacB, nome: demo.nome, sobrenome: demo.sobrenome, telefone: demo.telefone };
  const geralPadrao = {
    motivoPrincipal: 'Dor lombar recorrente há cerca de um mês.',
    sintomas: 'Dor ao ficar muito tempo sentado e ao levantar peso.',
    inicioSintomas: '1 mês',
    intensidade: 'moderada',
    historicoSaude: { doencaDiagnosticada: 'nao', doencaQual: '', cirurgias: '', internacao: 'nao', historicoFamiliar: '' },
    medicamentosAlergias: { usaMedicamento: 'nao', medicamentosDetalhe: '', suplementos: '', alergiaMedicamento: 'nao', alergiaMedicamentoDetalhe: '' },
    habitosVida: { alimentacao: 'boa', atividadeFisicaFrequencia: '2x por semana', alcool: 'nao', fuma: 'nao', sono: 'regular' },
    saudeEmocional: { estresse: 'medio', ansiedadeDepressao: 'nao', acompanhamentoPsicologico: 'nao' },
    outrosSintomas: { febre: false, tontura: false, faltaDeAr: false, nausea: false, dorPersistente: true },
    observacoes: 'Trabalha em escritório, passa a maior parte do dia sentado.',
  };

  const porProfissao = {
    fisioterapeuta: {
      tipoFormulario: 'saude_geral', tipoAtendimento: 'fisioterapia',
      conteudo: {
        tipoProfissional: 'fisioterapeuta', tipoAtendimento: 'fisioterapia', paciente,
        geral: geralPadrao,
        especifico: {
          queixaPrincipal: 'Dor na região lombar irradiando levemente para a perna direita.',
          localDorOuLimitacao: 'Lombar',
          senteDor: 'sim',
          nivelDor: '6',
          pioraComMovimento: 'Sim, ao curvar o tronco para frente.',
          dificuldadeAtividadesDia: 'Dificuldade para calçar sapatos e permanecer sentado por muito tempo.',
          lesoesTraumas: 'Nenhuma relatada.',
          fezFisioAntes: 'sim',
          diagnostico: '',
        },
      },
    },
    medico: {
      tipoFormulario: 'saude_geral', tipoAtendimento: 'medico',
      conteudo: {
        tipoProfissional: 'medico', tipoAtendimento: 'medico', paciente,
        geral: geralPadrao,
        especifico: {
          jaPassouAntes: 'sim, há uns 6 meses',
          acompanhamentoOutroMedico: 'nao',
          examesRecentes: 'Exame de sangue de rotina há 2 meses, sem alterações.',
          doencasCronicas: 'Nenhuma.',
          vacinacaoEmDia: 'sim',
        },
      },
    },
    fonoaudiologo: {
      tipoFormulario: 'saude_geral', tipoAtendimento: 'fonoaudiologia',
      conteudo: {
        tipoProfissional: 'fonoaudiologo', tipoAtendimento: 'fonoaudiologia', paciente,
        geral: geralPadrao,
        especifico: {
          comunicacao: { dificuldadeFala: 'nao', trocaOmissao: 'nao', dificuldadeCompreensao: 'nao' },
          audicao: { suspeitaPerdaAuditiva: 'nao', exameAuditivo: 'nao' },
          funcoesOrais: { mastigarEngolir: 'Sem dificuldades relatadas.', respiraPelaBoca: 'nao' },
          crianca: { ehCrianca: 'nao', idadeComecouFalar: '', linguagemAdequada: '' },
        },
      },
    },
    nutricionista: {
      tipoFormulario: 'nutricionista', tipoAtendimento: null,
      conteudo: {
        tipoProfissional: 'nutricionista', paciente,
        nutricao: {
          objetivo: 'Emagrecimento e reeducação alimentar.',
          refeicoesPorDia: '4',
          aguaDiaria: '1.5L',
          restricoes: 'Intolerância a lactose.',
          preferenciasAversoes: 'Não gosta de peixe.',
          atividadeFisica: 'Musculação 2x por semana.',
          rotinaTrabalho: 'Trabalho de escritório, sentado a maior parte do dia.',
          horariosRefeicoes: 'Café 7h, almoço 12h30, jantar 20h.',
          problemasMetabolicos: 'Nenhum diagnosticado.',
          suplementos: 'Whey protein ocasionalmente.',
        },
      },
    },
    dentista: {
      tipoFormulario: 'dentista', tipoAtendimento: null,
      conteudo: {
        tipoProfissional: 'dentista', paciente,
        odontologia: {
          motivoConsulta: 'Sensibilidade nos dentes ao consumir bebidas frias.',
          dor: 'nao',
          sangramento: 'nao',
          sensibilidade: 'sim',
          escovacaoFrequencia: '2x ao dia',
          fioDental: 'as vezes',
          ultimaConsulta: 'Há cerca de 1 ano.',
          tratamentoCanal: 'nao',
          aparelhoOrto: 'nao',
          bruxismo: 'sim, à noite',
          alergiaAnestesia: 'nao',
          alergiaAnestesiaDetalhe: '',
          problemasCardiacos: 'nao',
          anticoagulantes: 'nao',
          anticoagulantesDetalhe: '',
        },
      },
    },
    psicologo: {
      tipoFormulario: 'psicologia', tipoAtendimento: 'psicologia',
      conteudo: {
        tipoProfissional: 'psicologo', tipoAtendimento: 'psicologia', paciente,
        motivoBusca: { motivoPrincipal: 'Ansiedade relacionada ao trabalho.', tempoSintomas: '2 meses', intensidade: 'moderada' },
        historicoPsicologico: { diagnosticoPrevio: 'nao', diagnosticoQual: '', jaFezTerapia: 'sim', tempoTerapiaAnterior: '1 ano, há 3 anos', motivoEncerramento: 'Mudança de cidade.' },
        medicamentos: { usaMedicamentoPsiq: 'nao', medicamentoPsiqDetalhe: '', acompanhamentoPsiquiatra: 'nao' },
        saudeEmocional: { nivelAnsiedade: 'medio', nivelDepressao: 'baixo', qualidadeSono: 'regular', nivelEstresse: 'alto', autoestima: 'media', pensamentosNegativoRecorrente: 'nao' },
        contextoVida: { situacaoTrabalho: 'Empregado, carga horária alta.', relacionamentoFamiliar: 'Bom.', relacionamentoSocial: 'Bom, mas pouco tempo livre.', relacaoAmorosa: 'Estável.' },
        trauma: { eventoTraumatico: 'nao', eventoTraumaticoDetalhe: '' },
        objetivos: { objetivos: 'Aprender a lidar melhor com a ansiedade no trabalho.', expectativasTerapia: 'Ter mais equilíbrio entre vida pessoal e profissional.' },
        observacoes: 'Prefere sessões no fim do dia.',
      },
    },
  };

  return porProfissao[tipoProfissional] || porProfissao.fisioterapeuta;
};

// Popula a agenda de um profissional recém-cadastrado com 3 exemplos: uma vaga liberada (com o
// mesmo paciente já solicitando outro horário), uma consulta comum e uma urgência pendente de confirmação.
const seedConsultasDemo = async (profissionalId) => {
  try {
    const [pacA, pacB, pacC, pacD] = await Promise.all(PACIENTES_DEMO.map(obterOuCriarPacienteDemo));

    const [[profissional]] = await dbPromise.query('SELECT tipoProfissional FROM usuario WHERE id = ? LIMIT 1', [profissionalId]);
    const formularioBruno = getFormularioDemoBruno(profissional?.tipoProfissional, pacB, PACIENTES_DEMO[1]);

    const emDoisDias = new Date();
    emDoisDias.setDate(emDoisDias.getDate() + 2);
    const emTresDias = new Date();
    emTresDias.setDate(emTresDias.getDate() + 3);

    // Paciente A: pediu um novo horário para a consulta dela e o profissional já
    // confirmou a mudança — fica "Reagendada".
    const reservaAna = await criarReservaDemo({
      nome: PACIENTES_DEMO[0].nome, sobrenome: PACIENTES_DEMO[0].sobrenome,
      telefone: PACIENTES_DEMO[0].telefone, email: PACIENTES_DEMO[0].email,
      dia: formatarDataISO(emTresDias), horario: '14:00', horarioFinal: '15:00',
      qntd_pessoa: 1, usuario_id: pacA, profissional_id: profissionalId,
      status: 'confirmado', is_urgente: false,
    });
    await dbPromise.query('UPDATE reservas SET reagendado_em = NOW() WHERE id = ?', [reservaAna.insertId]);
    await dbPromise.query(
      'INSERT INTO notificacoes_profissional (profissional_id, reserva_id, mensagem) VALUES (?, ?, ?)',
      [
        profissionalId,
        reservaAna.insertId,
        `Consulta reagendada de ${PACIENTES_DEMO[0].nome} ${PACIENTES_DEMO[0].sobrenome} confirmada para ${formatarDataISO(emTresDias).split('-').reverse().join('/')} às 14:00. Confira sua agenda.`,
      ]
    );

    // Paciente B: consulta comum, pendente de confirmação, daqui a 2 dias — com o
    // formulário de anamnese já preenchido (de acordo com a profissão do profissional),
    // como se o paciente tivesse enviado.
    const reservaBruno = await criarReservaDemo({
      nome: PACIENTES_DEMO[1].nome, sobrenome: PACIENTES_DEMO[1].sobrenome,
      telefone: PACIENTES_DEMO[1].telefone, email: PACIENTES_DEMO[1].email,
      dia: formatarDataISO(emDoisDias), horario: '11:00', horarioFinal: '12:00',
      qntd_pessoa: 1, usuario_id: pacB, profissional_id: profissionalId,
      status: 'pendente', is_urgente: false,
    });
    await new Promise((resolve, reject) => {
      formulariosModel.upsertByReservaIds([[
        reservaBruno.insertId,
        formularioBruno.tipoFormulario,
        formularioBruno.tipoAtendimento,
        pacB,
        profissionalId,
        JSON.stringify({ ...formularioBruno.conteudo, createdAt: new Date().toISOString() }),
      ]], (err) => (err ? reject(err) : resolve()));
    });

    // Paciente C: urgência ainda pendente de confirmação, daqui a 2 dias.
    await criarReservaDemo({
      nome: PACIENTES_DEMO[2].nome, sobrenome: PACIENTES_DEMO[2].sobrenome,
      telefone: PACIENTES_DEMO[2].telefone, email: PACIENTES_DEMO[2].email,
      dia: formatarDataISO(emDoisDias), horario: '16:00', horarioFinal: '17:00',
      qntd_pessoa: 1, usuario_id: pacC, profissional_id: profissionalId,
      status: 'pendente', is_urgente: true,
      descricao_urgencia: 'Dor aguda após um esforço, preciso de avaliação o quanto antes, mas não quero ir a uma emergência hospitalar.',
      modalidade_urgencia: 'paciente_escolhe',
    });

    const hoje = new Date();
    const diaHojeISO = formatarDataISO(hoje);
    await criarReservaDemo({
      nome: PACIENTES_DEMO[3].nome, sobrenome: PACIENTES_DEMO[3].sobrenome,
      telefone: PACIENTES_DEMO[3].telefone, email: PACIENTES_DEMO[3].email,
      dia: diaHojeISO, horario: '08:00', horarioFinal: '09:00',
      qntd_pessoa: 1, usuario_id: pacD, profissional_id: profissionalId,
      status: 'liberado', is_urgente: false,
    });
    const reservaDiana = await criarReservaDemo({
      nome: PACIENTES_DEMO[3].nome, sobrenome: PACIENTES_DEMO[3].sobrenome,
      telefone: PACIENTES_DEMO[3].telefone, email: PACIENTES_DEMO[3].email,
      dia: diaHojeISO, horario: '10:00', horarioFinal: '11:00',
      qntd_pessoa: 1, usuario_id: pacD, profissional_id: profissionalId,
      status: 'pendente', is_urgente: false,
    });
    await dbPromise.query('UPDATE reservas SET reagendado_em = NOW() WHERE id = ?', [reservaDiana.insertId]);
  } catch (err) {
    console.error('[seedConsultasDemo]', err);
  }
};

// Profissional de demonstração usado para já popular "Minhas Consultas" de todo
// paciente recém-cadastrado, com uma consulta confirmada marcada para o dia seguinte.
const PROFISSIONAL_DEMO = {
  nome: 'Fábio', sobrenome: 'Demonstração', email: 'fabio.demo@sistema.local', cpf: '00000000005',
  telefone: '(11) 90000-0005', tipoProfissional: 'medico', especialidadeMedica: 'Clínico Geral',
  genero: 'masculino', valorConsulta: '150',
};

const obterOuCriarProfissionalDemo = async () => {
  const [rows] = await dbPromise.query('SELECT id FROM usuario WHERE email = ? LIMIT 1', [PROFISSIONAL_DEMO.email]);
  if (rows.length) return rows[0].id;
  const senhaAleatoria = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10);
  const [result] = await dbPromise.query(
    `INSERT INTO usuario
      (nome, sobrenome, telefone, email, senha, cpf, tipoUsuario, tipoProfissional, especialidadeMedica, genero, valorConsulta, modalidade, aceitandoConsultas)
     VALUES (?, ?, ?, ?, ?, ?, 'profissional', ?, ?, ?, ?, 'presencial', 1)`,
    [
      PROFISSIONAL_DEMO.nome, PROFISSIONAL_DEMO.sobrenome, PROFISSIONAL_DEMO.telefone, PROFISSIONAL_DEMO.email,
      senhaAleatoria, PROFISSIONAL_DEMO.cpf, PROFISSIONAL_DEMO.tipoProfissional, PROFISSIONAL_DEMO.especialidadeMedica,
      PROFISSIONAL_DEMO.genero, PROFISSIONAL_DEMO.valorConsulta,
    ]
  );
  return result.insertId;
};

// Popula "Minhas Consultas" de um paciente recém-cadastrado com uma consulta já
// confirmada com o Fábio Demonstração, marcada para o dia seguinte ao cadastro.
const seedConsultaDemoParaPaciente = async (usuarioId, dadosPaciente) => {
  try {
    const profissionalDemoId = await obterOuCriarProfissionalDemo();
    const amanha = new Date();
    amanha.setDate(amanha.getDate() + 1);

    await criarReservaDemo({
      nome: dadosPaciente.nome, sobrenome: dadosPaciente.sobrenome,
      telefone: dadosPaciente.telefone, email: dadosPaciente.email,
      dia: formatarDataISO(amanha), horario: '10:00', horarioFinal: '11:00',
      qntd_pessoa: 1, usuario_id: usuarioId, profissional_id: profissionalDemoId,
      status: 'confirmado', is_urgente: false,
      modalidade: 'presencial', valor: PROFISSIONAL_DEMO.valorConsulta,
    });
  } catch (err) {
    console.error('[seedConsultaDemoParaPaciente]', err);
  }
};

router.post('/register', async (req, res) => {
  const {
    nome,
    sobrenome,
    telefone,
    email,
    senha,
    cpf,
    genero,
    tipoUsuario,
    tipoProfissional,
    especialidadeMedica,
    profissaoCustomizada,
    numeroConselho,
    ufRegiao,
    cidade,
    latitude,
    longitude,
    descricao,
    publicoAtendido,
    modalidade,
    valorConsulta,
    valorPresencial,
    valorOnline,
    valorDomiciliar,
    diasAtendimento,
    horariosAtendimento
  } = req.body;

  if (!nome || !sobrenome || !email || !senha || !cpf) {
    return res.status(400).json({ error: 'Todos os campos são obrigatórios!' });
  }

  if (genero && !GENEROS_VALIDOS.includes(genero)) {
    return res.status(400).json({ error: 'Gênero inválido.' });
  }

  const cpfLimpo = cpf.replace(/\D/g, '');
  if (cpfLimpo.length !== 11) {
    return res.status(400).json({ error: 'CPF deve conter 11 dígitos.' });
  }

  if (/^(\d)\1{10}$/.test(cpfLimpo)) {
    return res.status(400).json({ error: 'CPF inválido.' });
  }
  let soma = 0;
  let resto;

  for (let i = 1; i <= 9; i++) {
    soma += parseInt(cpfLimpo.substring(i - 1, i)) * (11 - i);
  }
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cpfLimpo.substring(9, 10))) {
    return res.status(400).json({ error: 'CPF inválido.' });
  }

  soma = 0;
  for (let i = 1; i <= 10; i++) {
    soma += parseInt(cpfLimpo.substring(i - 1, i)) * (12 - i);
  }
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cpfLimpo.substring(10, 11))) {
    return res.status(400).json({ error: 'CPF inválido.' });
  }

  const existingUserByCpf = await usuariosModel.findFullByCpf(cpfLimpo);
  let upgradeUserId = null;

  if (existingUserByCpf) {
    const mesmoEmail = existingUserByCpf.email.toLowerCase() === String(email).toLowerCase();
    const senhaConfere = mesmoEmail && (await bcrypt.compare(senha, existingUserByCpf.senha));
    const podeVirarProfissional =
      tipoUsuario === 'profissional' && existingUserByCpf.tipoUsuario === 'paciente' && mesmoEmail && senhaConfere;

    if (!podeVirarProfissional) {
      return res.status(409).json({ error: 'Já existe um usuário cadastrado com esses dados.' });
    }
    upgradeUserId = existingUserByCpf.id;
  }

  if (!upgradeUserId) {
    const emailJaExiste = await usuariosModel.emailExists(email);
    if (emailJaExiste) {
      return res.status(409).json({ error: 'Este e-mail já está cadastrado.', field: 'email' });
    }
  }

  if (tipoUsuario === 'profissional') {
    if (!tipoProfissional) {
      return res.status(400).json({ error: 'Tipo de profissional é obrigatório.' });
    }
    const tiposValidos = ['medico', 'dentista', 'nutricionista', 'fisioterapeuta', 'fonoaudiologo', 'psicologo', 'outros'];
    if (!tiposValidos.includes(tipoProfissional)) {
      return res.status(400).json({ error: 'Tipo de profissional inválido.' });
    }
    if (tipoProfissional === 'medico' && (!especialidadeMedica || !especialidadeMedica.trim())) {
      return res.status(400).json({ error: 'Especialidade médica é obrigatória para médicos.' });
    }
    if (tipoProfissional === 'outros' && (!profissaoCustomizada || !profissaoCustomizada.trim())) {
      return res.status(400).json({ error: 'Profissão customizada é obrigatória quando selecionar "Outros".' });
    }
    if (!numeroConselho || !numeroConselho.trim()) {
      return res.status(400).json({ error: 'Número do conselho é obrigatório para profissionais.' });
    }

    const conselhoTrimmed = numeroConselho.trim();

    const formatosConselho = {
      medico:        { regex: /^CRM\/[A-Z]{2} \d{4,6}$/i,          exemplo: 'CRM/PI 425041' },
      dentista:      { regex: /^CRO\/[A-Z]{2} \d{4,6}$/i,          exemplo: 'CRO/SP 12345' },
      nutricionista: { regex: /^CRN-[1-9] \d{4,5}$/,               exemplo: 'CRN-3 12345' },
      fisioterapeuta:{ regex: /^CREFITO-\d{1,2}\/\d{4,6}-[FT]$/i,  exemplo: 'CREFITO-8/123456-F' },
      fonoaudiologo: { regex: /^CRFa\/[A-Z]{2} \d{4,5}$/i,         exemplo: 'CRFa/SP 12345' },
      psicologo:     { regex: /^CRP \d{2}\/\d{4,6}$/,              exemplo: 'CRP 06/12345' },
    };

    const formato = formatosConselho[tipoProfissional];
    if (formato) {
      if (!formato.regex.test(conselhoTrimmed)) {
        return res.status(400).json({
          error: `Número do conselho inválido. Formato esperado: ${formato.exemplo}`,
        });
      }
    } else if (!/^[A-Za-z0-9 \\/\-]{3,20}$/.test(conselhoTrimmed)) {
      return res.status(400).json({ error: 'Número do conselho inválido.' });
    }

    const conselhoJaExiste = await usuariosModel.numeroConselhoExists(conselhoTrimmed);
    if (conselhoJaExiste) {
      return res.status(409).json({ error: 'Este número de conselho já está cadastrado.', field: 'numeroConselho' });
    }
    if (!ufRegiao || !ufRegiao.trim()) {
      return res.status(400).json({ error: 'UF/Região é obrigatória para profissionais.' });
    }
  }

  try {
    const hashedPassword = await bcrypt.hash(senha, 10);

    if (upgradeUserId) {
      const fields = ['nome = ?', 'sobrenome = ?', 'telefone = ?', 'senha = ?', 'tipoUsuario = ?'];
      const values = [nome, sobrenome, telefone, hashedPassword, 'profissional'];

      if (genero) { fields.push('genero = ?'); values.push(genero); }

      const tipoProfissionalFinal =
        tipoProfissional === 'medico' ? especialidadeMedica : tipoProfissional === 'outros' ? profissaoCustomizada : tipoProfissional;
      fields.push('tipoProfissional = ?'); values.push(tipoProfissionalFinal);
      fields.push('numeroConselho = ?'); values.push(numeroConselho.trim());
      fields.push('ufRegiao = ?'); values.push(ufRegiao.trim());
      if (cidade) { fields.push('cidade = ?'); values.push(cidade.trim()); }
      if (latitude) { fields.push('latitude = ?'); values.push(latitude); }
      if (longitude) { fields.push('longitude = ?'); values.push(longitude); }
      if (descricao) { fields.push('descricao = ?'); values.push(descricao.trim()); }
      if (publicoAtendido) { fields.push('publicoAtendido = ?'); values.push(publicoAtendido.trim()); }
      if (modalidade) { fields.push('modalidade = ?'); values.push(modalidade.trim()); }
      if (valorConsulta) { fields.push('valorConsulta = ?'); values.push(valorConsulta); }
      if (valorPresencial) { fields.push('valorPresencial = ?'); values.push(valorPresencial); }
      if (valorOnline) { fields.push('valorOnline = ?'); values.push(valorOnline); }
      if (valorDomiciliar) { fields.push('valorDomiciliar = ?'); values.push(valorDomiciliar); }
      if (diasAtendimento) {
        fields.push('diasAtendimento = ?');
        values.push(typeof diasAtendimento === 'object' ? JSON.stringify(diasAtendimento) : diasAtendimento);
      }
      if (horariosAtendimento) {
        fields.push('horariosAtendimento = ?');
        values.push(typeof horariosAtendimento === 'object' ? JSON.stringify(horariosAtendimento) : horariosAtendimento);
      }

      values.push(upgradeUserId);
      pool.query(`UPDATE usuario SET ${fields.join(', ')} WHERE id = ?`, values, (err) => {
        if (err) return res.status(400).json({ error: `Erro ao atualizar conta: ${err.sqlMessage}` });
        res.json({ message: 'Conta atualizada para profissional com sucesso!', id: upgradeUserId });
        seedConsultasDemo(upgradeUserId);
      });
      return;
    }

    let query = 'INSERT INTO usuario (nome, sobrenome, telefone, email, senha, cpf';
    const values = [nome, sobrenome, telefone, email, hashedPassword, cpfLimpo];
    let placeholders = '?, ?, ?, ?, ?, ?';

    query += ', tipoUsuario';
    placeholders += ', ?';
    values.push(tipoUsuario || 'paciente');

    if (genero) {
      query += ', genero';
      placeholders += ', ?';
      values.push(genero);
    }

    if (tipoUsuario === 'profissional') {
      query += ', tipoProfissional';
      placeholders += ', ?';

      const tipoProfissionalFinal =
        tipoProfissional === 'medico' ? especialidadeMedica : tipoProfissional === 'outros' ? profissaoCustomizada : tipoProfissional;
      values.push(tipoProfissionalFinal);

      query += ', numeroConselho';
      placeholders += ', ?';
      values.push(numeroConselho.trim());

      query += ', ufRegiao';
      placeholders += ', ?';
      values.push(ufRegiao.trim());

      if (cidade) {
        query += ', cidade';
        placeholders += ', ?';
        values.push(cidade.trim());
      }

      if (latitude) {
        query += ', latitude';
        placeholders += ', ?';
        values.push(latitude);
      }

      if (longitude) {
        query += ', longitude';
        placeholders += ', ?';
        values.push(longitude);
      }

      if (descricao) {
        query += ', descricao';
        placeholders += ', ?';
        values.push(descricao.trim());
      }

      if (publicoAtendido) {
        query += ', publicoAtendido';
        placeholders += ', ?';
        values.push(publicoAtendido.trim());
      }

      if (modalidade) {
        query += ', modalidade';
        placeholders += ', ?';
        values.push(modalidade.trim());
      }

      if (valorConsulta) {
        query += ', valorConsulta';
        placeholders += ', ?';
        values.push(valorConsulta);
      }

      if (valorPresencial) {
        query += ', valorPresencial';
        placeholders += ', ?';
        values.push(valorPresencial);
      }

      if (valorOnline) {
        query += ', valorOnline';
        placeholders += ', ?';
        values.push(valorOnline);
      }

      if (valorDomiciliar) {
        query += ', valorDomiciliar';
        placeholders += ', ?';
        values.push(valorDomiciliar);
      }

      if (diasAtendimento) {
        query += ', diasAtendimento';
        placeholders += ', ?';
        values.push(typeof diasAtendimento === 'object' ? JSON.stringify(diasAtendimento) : diasAtendimento);
      }

      if (horariosAtendimento) {
        query += ', horariosAtendimento';
        placeholders += ', ?';
        values.push(typeof horariosAtendimento === 'object' ? JSON.stringify(horariosAtendimento) : horariosAtendimento);
      }
    }

    query += ') VALUES (' + placeholders + ')';

    pool.query(query, values, (err, results) => {
      if (err) {
        if (tipoUsuario === 'profissional') {
          const query2 = 'INSERT INTO usuario (nome, sobrenome, telefone, email, senha, cpf, tipoUsuario) VALUES (?, ?, ?, ?, ?, ?, ?)';
          const values2 = [nome, sobrenome, telefone, email, hashedPassword, cpfLimpo, tipoUsuario || 'paciente'];
          pool.query(query2, values2, (err2, results2) => {
            if (err2) {
              return res.status(400).json({ error: `Erro ao registrar: ${err2.sqlMessage}` });
            }
            res.json({ message: 'Usuário registrado com sucesso!', id: results2.insertId });
            seedConsultasDemo(results2.insertId);
          });
        } else {
          return res.status(400).json({ error: `Erro ao registrar: ${err.sqlMessage}` });
        }
      } else {
        const userId = results.insertId;
        res.json({ message: 'Usuário registrado com sucesso!', id: userId });
        if (tipoUsuario === 'profissional') seedConsultasDemo(userId);
        else seedConsultaDemoParaPaciente(userId, { nome, sobrenome, telefone, email });
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.post('/login', (req, res) => {
  const { email, senha } = req.body;
  pool.query('SELECT * FROM usuario WHERE email = ?', [email], async (err, results) => {
    if (err || !results || results.length === 0) return res.status(400).json({ error: 'Usuário não encontrado' });

    const user = results[0];
    const senhaCorreta = await bcrypt.compare(senha, user.senha);
    if (!senhaCorreta) return res.status(401).json({ error: 'Senha incorreta' });

    const token = jwt.sign({ id: user.id }, config.jwtSecret, { expiresIn: '1h' });
    res.json(serializeLogin(user, token));
  });
});

router.get('/user/:id', (req, res) => {
  usuariosModel.findBasicById(req.params.id, (err, userRow) => {
    if (err || !userRow) return res.status(404).json({ error: 'Usuário não encontrado' });
    res.json(userRow);
  });
});

router.post('/api/forgot-password', async (req, res) => {
  const { email } = req.body;
  try {
    const user = await usuariosModel.findByEmail(email);
    if (user) {
      const token = crypto.randomBytes(32).toString('hex');
      await usuariosModel.createResetToken(user.id, token);
      await emailRedefinicaoSenha({ userEmail: user.email, userName: user.nome, token });
    }
    // Sempre retorna sucesso para não revelar se o e-mail existe
    return res.json({ message: 'Se o e-mail estiver cadastrado, você receberá o link em breve.' });
  } catch (err) {
    console.error('[forgot-password]', err);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

router.patch('/api/reset-password', async (req, res) => {
  const { token, senha } = req.body;
  if (!token || !senha) return res.status(400).json({ error: 'Dados inválidos.' });
  try {
    const tokenRow = await usuariosModel.findResetToken(token);
    if (!tokenRow) return res.status(400).json({ error: 'Link inválido ou expirado.' });
    const hashedPassword = await bcrypt.hash(senha, 10);
    await usuariosModel.updatePasswordAsync(tokenRow.user_id, hashedPassword);
    await usuariosModel.deleteResetToken(token);
    return res.json({ message: 'Senha redefinida com sucesso.' });
  } catch (err) {
    console.error('[reset-password]', err);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

module.exports = router;

