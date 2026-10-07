const app = require('./app');

const PORT = process.env.PORT || 3000;

if (!process.env.VERCEL) {
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Backend no ar na porta ${PORT}`);
  });

  process.on('SIGTERM', () => server.close(() => process.exit(0)));
  process.on('SIGINT', () => server.close(() => process.exit(0)));
}

module.exports = app;
