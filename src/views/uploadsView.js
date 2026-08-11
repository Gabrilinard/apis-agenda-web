const express = require('express');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const config = require('../config');

const router = express.Router();
const uploadsDir = path.join(__dirname, '../../uploads');

// Substitui o antigo `express.static('/uploads', ...)`, que servia qualquer arquivo
// (inclusive anexos de exames e documentos de urgência) publicamente, sem autenticação,
// bastando conhecer/adivinhar o nome do arquivo. Agora exige um token assinado de curta
// duração (ver middlewares/upload.js#getFileUrl), gerado somente depois que a view que
// devolve a URL (formulariosView, reservasView) já validou que o usuário autenticado é
// o dono do dado.
router.get('/uploads/:filename', (req, res) => {
  const { filename } = req.params;
  const { token } = req.query;

  if (path.basename(filename) !== filename) {
    return res.status(400).json({ error: 'Nome de arquivo inválido.' });
  }
  if (!token) {
    return res.status(401).json({ error: 'Link de acesso ausente.' });
  }

  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch {
    return res.status(401).json({ error: 'Link expirado ou inválido. Solicite o arquivo novamente.' });
  }
  if (payload.file !== filename) {
    return res.status(403).json({ error: 'Token não corresponde a este arquivo.' });
  }

  const filePath = path.join(uploadsDir, filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Arquivo não encontrado.' });
  }
  res.sendFile(filePath);
});

module.exports = router;
