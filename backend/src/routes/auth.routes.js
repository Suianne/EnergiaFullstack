const { Router } = require('express');
const controller = require('../controllers/auth.controller');

const router = Router();

router.post('/registrar', controller.registrar);
router.post('/login', controller.login);

module.exports = router;
