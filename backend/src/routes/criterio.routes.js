const { Router } = require('express');
const controller = require('../controllers/criterio.controller');
const { autenticar, autorizar } = require('../middleware/auth');

const router = Router();

router.get('/', autenticar, controller.listar);
router.get('/:id', autenticar, controller.buscarPorId);
router.post('/', autenticar, autorizar('ADMINISTRADOR', 'PESQUISADOR'), controller.criar);
router.put('/:id', autenticar, autorizar('ADMINISTRADOR', 'PESQUISADOR'), controller.atualizar);
router.delete('/:id', autenticar, autorizar('ADMINISTRADOR', 'PESQUISADOR'), controller.remover);

module.exports = router;
