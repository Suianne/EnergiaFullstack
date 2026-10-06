const { Router } = require('express');
const controller = require('../controllers/topsis.controller');

const router = Router();
router.post('/executar', controller.executar);

module.exports = router;