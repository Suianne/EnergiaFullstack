const { Router } = require('express');
const controller = require('../controllers/relatorio.controller');

const router = Router();
router.post('/csv', controller.gerarCsv);

module.exports = router;