const serializeLogin = (user, token) => {
  return {
    token,
    user: {
      id: user.id,
      nome: user.nome,
      sobrenome: user.sobrenome,
      telefone: user.telefone,
      email: user.email,
      cpf: user.cpf || null,
      genero: user.genero || null,
      tipoUsuario: user.tipoUsuario || 'paciente'
    }
  };
};

module.exports = {
  serializeLogin
};

