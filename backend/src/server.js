const http = require('node:http');

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200);
    return res.end(JSON.stringify({ status: 'ok' }));
  }

  res.writeHead(404);
  res.end(JSON.stringify({ erro: 'Rota não encontrada' }));
});

// '0.0.0.0' é obrigatório em container: com 'localhost' a porta publicada não funcionaria.
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend no ar na porta ${PORT}`);
});

// Permite que `docker stop` encerre o servidor na hora.
process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT', () => server.close(() => process.exit(0)));