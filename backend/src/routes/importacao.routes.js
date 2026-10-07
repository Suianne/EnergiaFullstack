const { Router } = require('express');
const controller = require('../controllers/importacao.controller');
const { autenticar, autorizar } = require('../middleware/auth');

const router = Router();

// Consultar municípios do IBGE (qualquer usuário logado)
router.get('/ibge/municipios/:uf', autenticar, controller.listarMunicipiosIBGE);

// Importar municípios de uma UF para o banco (só ADMINISTRADOR)
router.post('/ibge/municipios/:uf', autenticar, autorizar('ADMINISTRADOR'), controller.importarPorUF);

// Popular critérios e MatrizDecisao com dados do IBGE + ANEEL (só ADMINISTRADOR)
router.post('/popular-dados/:uf', autenticar, autorizar('ADMINISTRADOR'), controller.popularDadosPorUF);

module.exports = router;
