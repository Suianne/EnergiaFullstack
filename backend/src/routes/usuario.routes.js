const { Router } = require('express');
const controller = require('../controllers/usuario.controller');
const { autorizar } = require('../middleware/auth');
const { protegido } = require('../middleware/usuario');

const router = Router();

// Toda a gestão de usuários é exclusiva do ADMINISTRADOR
router.use(protegido, autorizar('ADMINISTRADOR'));

router.get('/', controller.listar);
router.post('/', controller.criar);
router.put('/:id', controller.atualizarPerfil);
router.delete('/:id', controller.remover);

module.exports = router;
