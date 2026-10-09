const { Router } = require('express');
const controller = require('../controllers/criterio.controller');
const { autorizar } = require('../middleware/auth');
const { protegido } = require('../middleware/usuario');

const router = Router();

router.use(protegido);

router.get('/', controller.listar);
router.get('/:id', controller.buscarPorId);
router.post('/', autorizar('ADMINISTRADOR', 'PESQUISADOR'), controller.criar);
router.put('/:id', autorizar('ADMINISTRADOR', 'PESQUISADOR'), controller.atualizar);
router.delete('/:id', autorizar('ADMINISTRADOR', 'PESQUISADOR'), controller.remover);

module.exports = router;
