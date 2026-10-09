const { Router } = require('express');
const controller = require('../controllers/relatorio.controller');
const { autorizar } = require('../middleware/auth');
const { protegido } = require('../middleware/usuario');

const router = Router();

router.use(protegido);

router.post('/csv', controller.gerarCsv);
router.get('/:id/pdf', autorizar('ADMINISTRADOR', 'GESTOR'), controller.gerarPdf);

module.exports = router;
