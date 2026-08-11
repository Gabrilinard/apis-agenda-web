const rateLimit = require('express-rate-limit');

// Sem isso, /login, /register e /api/forgot-password aceitavam tentativas ilimitadas —
// nenhum atraso, bloqueio ou captcha —, permitindo força bruta de senha contra um e-mail
// conhecido e enumeração de e-mails já cadastrados sem qualquer fricção.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas tentativas de login. Tente novamente em alguns minutos.' },
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas tentativas de cadastro. Tente novamente mais tarde.' },
});

const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas solicitações de redefinição de senha. Tente novamente em alguns minutos.' },
});

module.exports = { loginLimiter, registerLimiter, forgotPasswordLimiter };
