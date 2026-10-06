const { Router } = require('express');
const controller = require('../controllers/simulacao.controller');
const { autenticar } = require('../middleware/auth');

const router = Router();

router.get('/', autenticar, controller.listar);
router.get('/:id', autenticar, controller.buscarPorId);

module.exports = router;
