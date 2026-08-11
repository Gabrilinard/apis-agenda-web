const express = require('express');
const fs = require('fs');
const path = require('path');
const usuariosModel = require('../models/usuariosModel');
const auditModel = require('../models/auditModel');
const { authenticate } = require('../middlewares/auth');

const uploadsDir = path.join(__dirname, '../../uploads');
const apagarArquivoLocal = (stored) => {
  if (!stored || /^https?:\/\//.test(stored)) return; // URL do S3, não é arquivo local
  const filename = path.basename(stored.split('?')[0]);
  fs.unlink(path.join(uploadsDir, filename), () => {}); // best-effort: se já não existir, ignora
};

const router = express.Router();

router.use(authenticate);

router.get('/usuarios/logados', (req, res) => {
  usuariosModel.listLoggedUsers((err, results) => {
    if (err) return res.status(500).send('Erro ao buscar usuários logados');
    res.json(results);
  });
});

router.get('/usuarios/solicitarDados/:id', (req, res) => {
  usuariosModel.getUserInfoById(req.params.id, (err, row) => {
    if (err) return res.status(500).send('Erro ao buscar dados do usuário logado');
    if (!row) return res.status(404).send('Usuário não encontrado ou não está logado');

    const podeVer = row.tipoUsuario === 'profissional' || Number(req.params.id) === req.userId;
    if (!podeVer) {
      return res.status(403).send('Você não tem permissão para ver os dados deste usuário.');
    }

    const { tipoUsuario, ...dadosPublicos } = row;
    res.json(dadosPublicos);
  });
});

router.get('/usuarios/buscarPorCPF/:cpf', (req, res) => {
  const cpf = String(req.params.cpf || '').replace(/\D/g, '');
  if (cpf.length !== 11) {
    return res.status(400).json({ error: 'CPF deve conter 11 dígitos.' });
  }

  usuariosModel.findByCpf(cpf, (err, row) => {
    if (err) return res.status(500).json({ error: 'Erro ao buscar usuário por CPF' });
    if (!row) return res.status(404).json({ error: 'Usuário não encontrado com este CPF.' });
    res.json(row);
  });
});

// As três rotas abaixo alteram dados do próprio usuário (localização, perfil e
// informações profissionais) — em nenhum fluxo do sistema um usuário edita o perfil de
// outro, então exigimos que o :id da URL seja o mesmo do token autenticado.
const exigirDono = (req, res) => {
  if (Number(req.params.id) !== req.userId) {
    res.status(403).json({ error: 'Você não tem permissão para alterar dados de outro usuário.' });
    return false;
  }
  return true;
};

router.patch('/usuarios/:id/localizacao', (req, res) => {
  if (!exigirDono(req, res)) return;
  usuariosModel.updateLocation(req.params.id, req.body || {}, (err, result) => {
    if (err) return res.status(500).json({ error: 'Erro ao atualizar localização.' });
    if (!result || result.affectedRows === 0) return res.status(404).json({ error: 'Usuário não encontrado.' });
    res.json({ message: 'Localização atualizada com sucesso.' });
  });
});

router.patch('/usuarios/:id/perfil', (req, res) => {
  if (!exigirDono(req, res)) return;
  usuariosModel.updatePerfil(req.params.id, req.body || {}, (err, result) => {
    if (err) return res.status(500).json({ error: 'Erro ao atualizar perfil.' });
    if (!result || result.affectedRows === 0) return res.status(404).json({ error: 'Usuário não encontrado.' });
    res.json({ message: 'Perfil atualizado com sucesso.' });
  });
});

router.patch('/usuarios/:id/informacoes', (req, res) => {
  if (!exigirDono(req, res)) return;
  usuariosModel.updateInformacoes(req.params.id, req.body || {}, (err) => {
    if (err) return res.status(500).json({ error: 'Erro ao atualizar informações.' });
    res.json({ message: 'Informações atualizadas com sucesso.' });
  });
});

router.delete('/usuarios/:id', async (req, res) => {
  if (!exigirDono(req, res)) return;
  try {
    // Registrado ANTES da exclusão de propósito: usuario_id tem ON DELETE SET NULL,
    // então assim que a linha de usuario for apagada esse log perde o vínculo com o
    // id — o `detalhe` guarda o id em texto para o registro continuar rastreável
    // mesmo depois que a conta não existir mais.
    auditModel.registrar({
      usuarioId: req.userId,
      evento: 'exclusao_conta',
      sucesso: true,
      ip: req.ip,
      detalhe: `usuario ${req.userId} excluído`,
    });
    const { affectedRows, arquivosLocais } = await usuariosModel.excluirConta(req.params.id);
    if (!affectedRows) return res.status(404).json({ error: 'Usuário não encontrado.' });
    arquivosLocais.forEach(apagarArquivoLocal);
    res.json({ message: 'Conta excluída com sucesso.' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao excluir conta.' });
  }
});

module.exports = router;

