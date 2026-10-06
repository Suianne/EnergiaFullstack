const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'energia-renovavel-secret';

// Verifica se o token JWT é válido e coloca os dados do usuário em req.usuario
function autenticar(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ erro: 'Token não fornecido.' });
  }

  const token = header.split(' ')[1];

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.usuario = payload;
    next();
  } catch (err) {
    return res.status(401).json({ erro: 'Token inválido ou expirado.' });
  }
}

// Verifica se o perfil do usuário está na lista de perfis permitidos
function autorizar(...perfisPermitidos) {
  return (req, res, next) => {
    if (!req.usuario || !perfisPermitidos.includes(req.usuario.perfil)) {
      return res.status(403).json({ erro: 'Acesso negado. Permissão insuficiente.' });
    }
    next();
  };
}

module.exports = { autenticar, autorizar, JWT_SECRET };
