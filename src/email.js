const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM = process.env.EMAIL_FROM || 'Agende Aqui <onboarding@resend.dev>';
const APP_URL = process.env.APP_URL || 'http://localhost:5173';
const DEV_EMAIL = process.env.DEV_EMAIL || 'gabrielleite729@gmail.com';

if (!RESEND_API_KEY) {
  console.error('[email] RESEND_API_KEY não configurada — envios de e-mail vão falhar.');
}
if (FROM.includes('onboarding@resend.dev')) {
  console.warn('[email] Usando domínio de teste do Resend (onboarding@resend.dev): só é possível enviar para o e-mail dono da conta Resend. Verifique um domínio próprio e defina EMAIL_FROM.');
}

const send = async (to, subject, html) => {
  const isProd = process.env.NODE_ENV === 'production';
  const recipient = isProd ? to : DEV_EMAIL;
  const devPrefix = isProd ? '' : `<p style="background:#FEF3C7;padding:8px 12px;border-radius:6px;font-size:12px;margin-bottom:16px"><strong>DEV:</strong> destinatário real: ${Array.isArray(to) ? to.join(', ') : to}</p>`;
  console.log(`[email] Enviando "${subject}" para ${recipient}`);
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM, to: Array.isArray(recipient) ? recipient : [recipient], subject, html: devPrefix + html }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error('[email] Resend error:', err);
    throw new Error(`Resend: ${err}`);
  }
  console.log('[email] Enviado com sucesso');
};

const emailLiberacaoSlot = async ({ pacienteEmail, pacienteNome, profissionalEmail, profissionalNome, dia, horario }) => {
  const diaFmt = dia;
  await send(pacienteEmail, 'Horário liberado — Agende Aqui', `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
      <h2 style="color:#1B4D3E">Horário liberado com sucesso</h2>
      <p>Olá <strong>${pacienteNome}</strong>,</p>
      <p>Seu horário do dia <strong>${diaFmt}</strong> às <strong>${horario}</strong> com
         <strong>Dr. ${profissionalNome}</strong> foi liberado.</p>
      <p style="color:#666">Obrigado por avisar com antecedência! Isso permite que outro paciente seja atendido.</p>
    </div>
  `);

  await send(profissionalEmail, 'Horário liberado por paciente — Agende Aqui', `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
      <h2 style="color:#1B4D3E">Horário liberado</h2>
      <p>Olá <strong>Dr. ${profissionalNome}</strong>,</p>
      <p>O paciente <strong>${pacienteNome}</strong> liberou o horário do dia
         <strong>${diaFmt}</strong> às <strong>${horario}</strong>.</p>
      <p>Acesse o dashboard para ver os candidatos disponíveis para preencher esta vaga.</p>
    </div>
  `);
};

const emailNotificacaoVaga = async ({ candidatoEmail, candidatoNome, profissionalNome, dia, horario, notificacaoId, token }) => {
  const link = `${APP_URL}/MinhasConsultas?aceitar_vaga=${notificacaoId}&token=${token}`;
  await send(candidatoEmail, 'Uma vaga se abriu para você! — Agende Aqui', `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
      <h2 style="color:#1B4D3E">Vaga disponível!</h2>
      <p>Olá <strong>${candidatoNome}</strong>,</p>
      <p>Uma vaga se abriu com <strong>Dr. ${profissionalNome}</strong> para o dia
         <strong>${dia}</strong> às <strong>${horario}</strong>.</p>
      <p>Clique abaixo para aceitar e garantir seu horário:</p>
      <a href="${link}" style="display:inline-block;background:#1B4D3E;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin-top:8px">
        Aceitar vaga
      </a>
      <p style="color:#888;font-size:12px;margin-top:16px">Esta vaga pode ser preenchida por outro paciente a qualquer momento.</p>
    </div>
  `);
};

const emailConfirmacaoVaga = async ({ pacienteEmail, pacienteNome, profissionalEmail, profissionalNome, dia, horario }) => {
  await send(pacienteEmail, 'Vaga confirmada! — Agende Aqui', `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
      <h2 style="color:#1B4D3E">Consulta confirmada!</h2>
      <p>Olá <strong>${pacienteNome}</strong>,</p>
      <p>Sua consulta foi confirmada para o dia <strong>${dia}</strong> às <strong>${horario}</strong>
         com <strong>Dr. ${profissionalNome}</strong>.</p>
      <p>Até lá!</p>
    </div>
  `);

  await send(profissionalEmail, 'Vaga preenchida — Agende Aqui', `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
      <h2 style="color:#1B4D3E">Vaga preenchida!</h2>
      <p>Olá <strong>Dr. ${profissionalNome}</strong>,</p>
      <p>O paciente <strong>${pacienteNome}</strong> aceitou a vaga do dia
         <strong>${dia}</strong> às <strong>${horario}</strong>.</p>
    </div>
  `);
};

const emailNovaUrgencia = async ({ profissionalEmail, profissionalNome, pacienteNome, pacienteTelefone, descricao, dia, horario }) => {
  const diaStr = dia ? `<tr><td style="padding:6px 0;color:#666;font-size:13px">Data preferida</td><td style="padding:6px 0;font-weight:600">${dia}</td></tr>` : '';
  const horStr = horario ? `<tr><td style="padding:6px 0;color:#666;font-size:13px">Horário preferido</td><td style="padding:6px 0;font-weight:600">${horario}</td></tr>` : '';
  const telStr = pacienteTelefone ? `<tr><td style="padding:6px 0;color:#666;font-size:13px">Telefone</td><td style="padding:6px 0;font-weight:600">${pacienteTelefone}</td></tr>` : '';
  await send(profissionalEmail, '⚡ Nova solicitação de urgência — Agende Aqui', `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
      <div style="background:#FFF3EE;border-left:4px solid #E8611A;padding:12px 16px;border-radius:6px;margin-bottom:20px">
        <span style="color:#C2410C;font-weight:700;font-size:13px">⚡ SOLICITAÇÃO URGENTE</span>
      </div>
      <h2 style="color:#1B4D3E;margin:0 0 8px">Nova urgência recebida</h2>
      <p>Olá <strong>Dr. ${profissionalNome}</strong>,</p>
      <p>O paciente <strong>${pacienteNome}</strong> enviou uma solicitação de atendimento urgente:</p>
      <blockquote style="background:#F7F7F4;border-left:3px solid #E8611A;padding:10px 14px;border-radius:0 6px 6px 0;margin:16px 0;font-size:14px;color:#333;line-height:1.6">
        ${descricao || 'Sem descrição'}
      </blockquote>
      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        ${diaStr}${horStr}${telStr}
      </table>
      <p style="color:#666;font-size:13px">Acesse o painel de urgências para aceitar ou propor um horário.</p>
    </div>
  `);
};

const emailNovaConsulta = async ({ profissionalEmail, profissionalNome, pacienteNome, pacienteTelefone, dia, horario }) => {
  const diaStr = dia ? `<tr><td style="padding:6px 0;color:#666;font-size:13px">Data</td><td style="padding:6px 0;font-weight:600">${dia}</td></tr>` : '';
  const horStr = horario ? `<tr><td style="padding:6px 0;color:#666;font-size:13px">Horário</td><td style="padding:6px 0;font-weight:600">${horario}</td></tr>` : '';
  const telStr = pacienteTelefone ? `<tr><td style="padding:6px 0;color:#666;font-size:13px">Telefone</td><td style="padding:6px 0;font-weight:600">${pacienteTelefone}</td></tr>` : '';
  await send(profissionalEmail, 'Nova consulta agendada — Agende Aqui', `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
      <h2 style="color:#1B4D3E">Nova consulta agendada</h2>
      <p>Olá <strong>Dr. ${profissionalNome}</strong>,</p>
      <p>O paciente <strong>${pacienteNome}</strong> agendou uma consulta com você:</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        ${diaStr}${horStr}${telStr}
      </table>
      <p style="color:#666;font-size:13px">Acesse o painel para confirmar ou propor outro horário.</p>
    </div>
  `);
};

const emailConsultaRemarcada = async ({ pacienteEmail, pacienteNome, profissionalNome, novoDia, novoHorario }) => {
  await send(pacienteEmail, 'Novo horário proposto — Agende Aqui', `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
      <h2 style="color:#1B4D3E">O profissional propôs um novo horário</h2>
      <p>Olá <strong>${pacienteNome}</strong>,</p>
      <p>O profissional <strong>Dr. ${profissionalNome}</strong> propôs um novo horário para sua consulta:</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        <tr><td style="padding:8px 0;color:#666;font-size:13px">Nova data</td><td style="padding:8px 0;font-weight:600">${novoDia}</td></tr>
        <tr><td style="padding:8px 0;color:#666;font-size:13px">Novo horário</td><td style="padding:8px 0;font-weight:600">${novoHorario}</td></tr>
      </table>
      <p style="color:#666;font-size:13px">Acesse Minhas Consultas para confirmar ou recusar o novo horário.</p>
    </div>
  `);
};

const emailConsultaNegada = async ({ pacienteEmail, pacienteNome, profissionalNome, motivoNegacao }) => {
  const motivoStr = motivoNegacao
    ? `<p style="color:#666;font-size:14px">Motivo: <em>${motivoNegacao}</em></p>`
    : '';
  await send(pacienteEmail, 'Consulta não confirmada — Agende Aqui', `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
      <h2 style="color:#1B4D3E">Sua consulta não foi confirmada</h2>
      <p>Olá <strong>${pacienteNome}</strong>,</p>
      <p>Infelizmente o profissional <strong>Dr. ${profissionalNome}</strong> não pôde confirmar sua consulta.</p>
      ${motivoStr}
      <p style="color:#666;font-size:13px">Você pode agendar um novo horário acessando o perfil do profissional.</p>
    </div>
  `);
};

const emailConsultaConfirmada = async ({ pacienteEmail, pacienteNome, profissionalEmail, profissionalNome, dia, horario }) => {
  await send(pacienteEmail, 'Consulta confirmada! — Agende Aqui', `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
      <h2 style="color:#1B4D3E">Sua consulta foi confirmada!</h2>
      <p>Olá <strong>${pacienteNome}</strong>,</p>
      <p>O profissional <strong>Dr. ${profissionalNome}</strong> confirmou sua consulta.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        <tr><td style="padding:8px 0;color:#666;font-size:13px">Data</td><td style="padding:8px 0;font-weight:600">${dia}</td></tr>
        <tr><td style="padding:8px 0;color:#666;font-size:13px">Horário</td><td style="padding:8px 0;font-weight:600">${horario}</td></tr>
        <tr><td style="padding:8px 0;color:#666;font-size:13px">Profissional</td><td style="padding:8px 0;font-weight:600">Dr. ${profissionalNome}</td></tr>
      </table>
      <p style="color:#666;font-size:13px">Acompanhe o status da sua consulta em Minhas Consultas.</p>
    </div>
  `);

  await send(profissionalEmail, 'Consulta confirmada — Agende Aqui', `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
      <h2 style="color:#1B4D3E">Consulta confirmada</h2>
      <p>Olá <strong>Dr. ${profissionalNome}</strong>,</p>
      <p>Você confirmou a consulta de <strong>${pacienteNome}</strong> para o dia <strong>${dia}</strong> às <strong>${horario}</strong>.</p>
    </div>
  `);
};

const emailUrgenciaAceita = async ({ pacienteEmail, pacienteNome, profissionalEmail, profissionalNome, dia, horario }) => {
  await send(pacienteEmail, 'Consulta emergente confirmada! — Agende Aqui', `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
      <div style="background:#FFF7F0;border-left:4px solid #E8611A;padding:12px 16px;border-radius:6px;margin-bottom:20px">
        <span style="color:#C2410C;font-weight:700;font-size:13px">⚡ CONSULTA EMERGENTE</span>
      </div>
      <h2 style="color:#1B4D3E">Sua consulta foi confirmada!</h2>
      <p>Olá <strong>${pacienteNome}</strong>,</p>
      <p>O profissional <strong>Dr. ${profissionalNome}</strong> confirmou sua solicitação de urgência.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        <tr><td style="padding:8px 0;color:#666;font-size:13px">Data</td><td style="padding:8px 0;font-weight:600">${dia}</td></tr>
        <tr><td style="padding:8px 0;color:#666;font-size:13px">Horário</td><td style="padding:8px 0;font-weight:600">${horario}</td></tr>
        <tr><td style="padding:8px 0;color:#666;font-size:13px">Profissional</td><td style="padding:8px 0;font-weight:600">Dr. ${profissionalNome}</td></tr>
      </table>
      <p style="color:#666;font-size:13px">Acompanhe o status da sua consulta em Minhas Consultas.</p>
    </div>
  `);

  await send(profissionalEmail, 'Urgência confirmada — Agende Aqui', `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
      <h2 style="color:#1B4D3E">Urgência confirmada</h2>
      <p>Olá <strong>Dr. ${profissionalNome}</strong>,</p>
      <p>Você confirmou a consulta emergente de <strong>${pacienteNome}</strong> para o dia <strong>${dia}</strong> às <strong>${horario}</strong>.</p>
    </div>
  `);
};

const emailUrgenciaRemarcada = async ({ pacienteEmail, pacienteNome, profissionalEmail, profissionalNome, novoDia, novoHorario }) => {
  await send(pacienteEmail, 'Consulta emergente remarcada — Agende Aqui', `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
      <div style="background:#FFF7F0;border-left:4px solid #E8611A;padding:12px 16px;border-radius:6px;margin-bottom:20px">
        <span style="color:#C2410C;font-weight:700;font-size:13px">⚡ CONSULTA EMERGENTE</span>
      </div>
      <h2 style="color:#1B4D3E">Sua consulta foi remarcada</h2>
      <p>Olá <strong>${pacienteNome}</strong>,</p>
      <p>O profissional <strong>Dr. ${profissionalNome}</strong> propôs um novo horário para sua urgência:</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        <tr><td style="padding:8px 0;color:#666;font-size:13px">Nova data</td><td style="padding:8px 0;font-weight:600">${novoDia}</td></tr>
        <tr><td style="padding:8px 0;color:#666;font-size:13px">Novo horário</td><td style="padding:8px 0;font-weight:600">${novoHorario}</td></tr>
      </table>
      <p style="color:#666;font-size:13px">Acesse Minhas Consultas para confirmar ou entrar em contato.</p>
    </div>
  `);

  await send(profissionalEmail, 'Urgência remarcada — Agende Aqui', `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
      <h2 style="color:#1B4D3E">Urgência remarcada</h2>
      <p>Olá <strong>Dr. ${profissionalNome}</strong>,</p>
      <p>Você remarcou a consulta emergente de <strong>${pacienteNome}</strong> para o dia <strong>${novoDia}</strong> às <strong>${novoHorario}</strong>.</p>
    </div>
  `);
};

const emailRedefinicaoSenha = async ({ userEmail, userName, token }) => {
  const link = `${APP_URL}/ResetPassword?token=${token}`;
  await send(userEmail, 'Redefinição de senha — Agende Aqui', `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
      <h2 style="color:#1B4D3E">Redefinição de senha</h2>
      <p>Olá <strong>${userName}</strong>,</p>
      <p>Recebemos uma solicitação para redefinir a senha da sua conta.</p>
      <p>Clique no botão abaixo para criar uma nova senha. O link expira em <strong>1 hora</strong>.</p>
      <a href="${link}" style="display:inline-block;background:#1B4D3E;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin-top:8px">
        Redefinir senha
      </a>
      <p style="color:#888;font-size:12px;margin-top:16px">Se você não solicitou a redefinição, ignore este e-mail — sua senha permanece a mesma.</p>
    </div>
  `);
};

module.exports = { emailLiberacaoSlot, emailNotificacaoVaga, emailConfirmacaoVaga, emailNovaConsulta, emailConsultaConfirmada, emailConsultaRemarcada, emailConsultaNegada, emailNovaUrgencia, emailUrgenciaAceita, emailUrgenciaRemarcada, emailRedefinicaoSenha };
