const { Router } = require('express');
const controller = require('../controllers/topsis.controller');
const { protegido } = require('../middleware/usuario');

const router = Router();

router.use(protegido);

// Matriz enviada na requisição
router.post('/executar', controller.executar);

// Municípios e critérios do banco (salva a simulação ligada aos municípios)
router.post('/executar-banco', controller.executarBanco);

module.exports = router;
