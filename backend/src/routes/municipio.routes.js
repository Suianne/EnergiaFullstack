const { Router } = require('express');
const controller = require('../controllers/municipio.controller');
const { autorizar } = require('../middleware/auth');
const { protegido } = require('../middleware/usuario');

const router = Router();

router.use(protegido);

router.get('/', controller.listar);
router.get('/:id', controller.buscarPorId);
router.post('/', autorizar('ADMINISTRADOR'), controller.criar);
router.put('/:id', autorizar('ADMINISTRADOR'), controller.atualizar);
router.post('/:id/atualizar-dados', autorizar('ADMINISTRADOR'), controller.atualizarDados);
router.delete('/:id', autorizar('ADMINISTRADOR'), controller.remover);

module.exports = router;
