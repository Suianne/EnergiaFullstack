const { Router } = require('express');
const controller = require('../controllers/admin.controller');
const { autorizar } = require('../middleware/auth');
const { protegido } = require('../middleware/usuario');

const router = Router();

router.use(protegido, autorizar('ADMINISTRADOR'));

router.get('/estatisticas', controller.estatisticas);
router.post('/reset-dados', controller.resetarDados);

module.exports = router;
