const { Router } = require('express');
const controller = require('../controllers/auth.controller');
const { autenticar } = require('../middleware/auth');
const { carregarUsuario } = require('../middleware/usuario');

const router = Router();

// Públicas
router.post('/registrar', controller.registrar);
router.post('/login', controller.login);

// Usuário logado
router.get('/me', autenticar, carregarUsuario, controller.me);

module.exports = router;
