const { autenticar } = require('./auth');

// Depois de o JWT ser validado, recarrega o usuário do banco.
// Assim, se um administrador alterar o perfil de alguém (ou excluir a conta),
// a mudança vale imediatamente, sem esperar o token expirar.
async function carregarUsuario(req, res, next) {
  try {
    const prisma = require('../config/database');
    const usuario = await prisma.usuario.findUnique({
      where: { id: Number(req.usuario?.id) || 0 },
      select: { id: true, nome: true, email: true, perfil: true },
    });

    if (!usuario) {
      return res.status(401).json({ erro: 'Usuário não encontrado. Entre novamente.' });
    }

    req.usuario = usuario;
    next();
  } catch (err) {
    next(err);
  }
}

// Par usado por toda rota autenticada: valida o token e carrega o usuário atual.
const protegido = [autenticar, carregarUsuario];

module.exports = { carregarUsuario, protegido };
