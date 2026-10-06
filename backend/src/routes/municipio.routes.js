const { Router } = require('express');
const controller = require('../controllers/municipio.controller');
const { autenticar, autorizar } = require('../middleware/auth');

const router = Router();

router.get('/', autenticar, controller.listar);
router.get('/:id', autenticar, controller.buscarPorId);
router.post('/', autenticar, autorizar('ADMINISTRADOR'), controller.criar);
router.put('/:id', autenticar, autorizar('ADMINISTRADOR'), controller.atualizar);
router.delete('/:id', autenticar, autorizar('ADMINISTRADOR'), controller.remover);

module.exports = router;
