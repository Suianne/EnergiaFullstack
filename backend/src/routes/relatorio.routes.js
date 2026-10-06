const { Router } = require('express');
const controller = require('../controllers/relatorio.controller');
const { autenticar, autorizar } = require('../middleware/auth');

const router = Router();

router.post('/csv', autenticar, controller.gerarCsv);
router.get('/:id/pdf', autenticar, autorizar('ADMINISTRADOR', 'GESTOR'), controller.gerarPdf);

module.exports = router;
