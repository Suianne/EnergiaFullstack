const { Router } = require('express');
const controller = require('../controllers/usuario.controller');
const { autenticar, autorizar } = require('../middleware/auth');

const router = Router();

// Gestão de usuários e níveis de acesso: só ADMINISTRADOR.
router.get('/', autenticar, autorizar('ADMINISTRADOR'), controller.listar);
router.patch('/:id/perfil', autenticar, autorizar('ADMINISTRADOR'), controller.alterarPerfil);
router.delete('/:id', autenticar, autorizar('ADMINISTRADOR'), controller.remover);

module.exports = router;
