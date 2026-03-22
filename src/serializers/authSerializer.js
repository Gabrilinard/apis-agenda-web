const serializeLogin = (user, token) => {
  return {
    token,
    user: {
      id: user.id,
      nome: user.nome,
      sobrenome: user.sobrenome,
      telefone: user.telefone,
      email: user.email,
      tipoUsuario: user.tipoUsuario || 'paciente'
    }
  };
};

module.exports = {
  serializeLogin
};

