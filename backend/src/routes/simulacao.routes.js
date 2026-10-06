const { Router } = require('express');
const controller = require('../controllers/simulacao.controller');

const router = Router();

router.get('/', controller.listar);
router.get('/:id', controller.buscarPorId);

module.exports = router;
