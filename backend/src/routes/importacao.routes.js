const { Router } = require('express');
const controller = require('../controllers/importacao.controller');
const { autorizar } = require('../middleware/auth');
const { protegido } = require('../middleware/usuario');

const router = Router();

router.use(protegido);

// Consultas às fontes externas (qualquer usuário logado)
router.get('/ibge/municipios/:uf', controller.listarMunicipiosIBGE);
router.get('/aneel/:uf', controller.resumoAneel);

// Importar municípios da UF (já com dados IBGE + ANEEL) — só ADMINISTRADOR
router.post('/ibge/municipios/:uf', autorizar('ADMINISTRADOR'), controller.importarPorUF);

// Reprocessar municípios da UF sem dados — só ADMINISTRADOR
router.post('/atualizar-dados/:uf', autorizar('ADMINISTRADOR'), controller.atualizarDadosPorUF);
// Nome antigo da rota, mantido por compatibilidade
router.post('/popular-dados/:uf', autorizar('ADMINISTRADOR'), controller.atualizarDadosPorUF);

module.exports = router;
