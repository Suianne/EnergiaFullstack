const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/database');
const { JWT_SECRET } = require('../middleware/auth');

const SALT_ROUNDS = 10;
const TOKEN_EXPIRA_EM = '24h';

async function registrar({ nome, email, senha, perfil }) {
  const existe = await prisma.usuario.findUnique({ where: { email } });
  if (existe) {
    return { erro: 'Email já cadastrado.' };
  }

  const senhaHash = await bcrypt.hash(senha, SALT_ROUNDS);

  const usuario = await prisma.usuario.create({
    data: { nome, email, senha: senhaHash, perfil },
  });

  return {
    usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, perfil: usuario.perfil },
  };
}

async function login({ email, senha }) {
  const usuario = await prisma.usuario.findUnique({ where: { email } });
  if (!usuario) {
    return { erro: 'Email ou senha incorretos.' };
  }

  const senhaCorreta = await bcrypt.compare(senha, usuario.senha);
  if (!senhaCorreta) {
    return { erro: 'Email ou senha incorretos.' };
  }

  const token = jwt.sign(
    { id: usuario.id, nome: usuario.nome, email: usuario.email, perfil: usuario.perfil },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRA_EM },
  );

  return {
    token,
    usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, perfil: usuario.perfil },
  };
}

module.exports = { registrar, login };
