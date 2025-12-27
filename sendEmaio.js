const axios = require('axios');

const SERVICE_ID = 'service_5guvy7s';
const TEMPLATE_ID = 'template_6rjaiue';
const USER_ID = '95NytkXcfDF9Z3EEQ';

async function sendEmailNotification(userEmail, userId) {
  const templateParams = {
    email: userEmail,
    reset_link: userId, // ou outro dado, como contagens
  };

  try {
    const response = await axios.post('https://api.emailjs.com/api/v1.0/email/send', {
      service_id: SERVICE_ID,
      template_id: TEMPLATE_ID,
      user_id: USER_ID,
      template_params: templateParams,
    });

    console.log('Email enviado:', response.status);
  } catch (error) {
    console.error('Erro ao enviar email:', error.response?.data || error.message);
  }
}

module.exports = { sendEmailNotification };