const { Router } = require('express');
const controller = require('../controllers/simulacao.controller');
const { protegido } = require('../middleware/usuario');

const router = Router();

router.use(protegido);

router.get('/', controller.listar);
router.get('/:id', controller.buscarPorId);

module.exports = router;
