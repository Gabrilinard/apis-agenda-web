const parseConteudo = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

const serializeFormulario = (row) => {
  if (!row) return null;
  return {
    ...row,
    conteudo: parseConteudo(row.conteudo)
  };
};

module.exports = {
  serializeFormulario
};

