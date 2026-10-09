const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth.routes');
const municipioRoutes = require('./routes/municipio.routes');
const criterioRoutes = require('./routes/criterio.routes');
const topsisRoutes = require('./routes/topsis.routes');
const simulacaoRoutes = require('./routes/simulacao.routes');
const relatorioRoutes = require('./routes/relatorio.routes');
const importacaoRoutes = require('./routes/importacao.routes');
const usuarioRoutes = require('./routes/usuario.routes');
const { rotaNaoEncontrada, tratarErros } = require('./middleware/errorHandler');

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json({ limit: '2mb' })); // 2mb: o PDF do ranking recebe a lista inteira de municípios

app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', authRoutes);
app.use('/api/municipios', municipioRoutes);
app.use('/api/criterios', criterioRoutes);
app.use('/api/topsis', topsisRoutes);
app.use('/api/simulacoes', simulacaoRoutes);
app.use('/api/relatorios', relatorioRoutes);
app.use('/api/importacao', importacaoRoutes);
app.use('/api/usuarios', usuarioRoutes);

// Sempre por último: pega o que nenhuma rota atendeu e os erros.
app.use(rotaNaoEncontrada);
app.use(tratarErros);

module.exports = app;