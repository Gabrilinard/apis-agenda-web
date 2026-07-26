const GENEROS_VALIDOS = ['masculino', 'feminino', 'nao_binario', 'outro', 'prefiro_nao_informar'];

const getTratamento = (genero) => {
  if (genero === 'masculino') return 'Dr.';
  if (genero === 'feminino') return 'Dra.';
  return '';
};

const getNomeComTitulo = (genero, nome) => {
  const tratamento = getTratamento(genero);
  return tratamento ? `${tratamento} ${nome}` : nome;
};

module.exports = { GENEROS_VALIDOS, getTratamento, getNomeComTitulo };
