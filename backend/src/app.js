const express = require('express');
const cors = require('cors');
const topsisRoutes = require('./routes/topsis.routes');
const relatorioRoutes = require('./routes/relatorio.routes');
const { rotaNaoEncontrada, tratarErros } = require('./middleware/errorHandler');

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173' }));
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/topsis', topsisRoutes);
app.use('/api/relatorios', relatorioRoutes)

// Sempre por último: pega o que nenhuma rota atendeu e os erros.
app.use(rotaNaoEncontrada);
app.use(tratarErros);

module.exports = app;