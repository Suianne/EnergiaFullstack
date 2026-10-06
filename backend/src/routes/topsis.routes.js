const { Router } = require('express');
const controller = require('../controllers/topsis.controller');
const { autenticar } = require('../middleware/auth');

const router = Router();

router.post('/executar', autenticar, controller.executar);

module.exports = router;
