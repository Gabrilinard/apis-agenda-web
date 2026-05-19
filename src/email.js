const RESEND_API_KEY = 're_i5sR1uMS_7Ef1tW8deTkpNzn2uGiVrcg3';
const FROM = 'Agende Aqui <onboarding@resend.dev>';
const APP_URL = process.env.APP_URL || 'http://localhost:5173';
// Resend testing restriction: unverified domain can only deliver to this address
const DEV_EMAIL = 'gabrielleite729@gmail.com';

const send = async (to, subject, html) => {
  const isProd = process.env.NODE_ENV === 'production';
  const recipient = isProd ? to : DEV_EMAIL;
  const devPrefix = isProd ? '' : `<p style="background:#FEF3C7;padding:8px 12px;border-radius:6px;font-size:12px;margin-bottom:16px"><strong>DEV:</strong> destinatário real: ${Array.isArray(to) ? to.join(', ') : to}</p>`;
  try {
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
    }
  } catch (e) {
    console.error('[email] Falha ao enviar:', e.message);
  }
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

module.exports = { emailLiberacaoSlot, emailNotificacaoVaga, emailConfirmacaoVaga };
