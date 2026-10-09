const { Router } = require('express');
const controller = require('../controllers/relatorio.controller');
const { autenticar, autorizar } = require('../middleware/auth');

const router = Router();

router.post('/csv', autenticar, controller.gerarCsv);
// PDF do ranking exibido na tela de Resultado (qualquer usuário logado pode exportar)
router.post('/pdf', autenticar, controller.gerarPdfMunicipios);
router.get('/:id/pdf', autenticar, autorizar('ADMINISTRADOR', 'GESTOR'), controller.gerarPdf);

module.exports = router;
