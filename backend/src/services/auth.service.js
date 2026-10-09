const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/database');
const crypto = require('crypto');
const { JWT_SECRET } = require('../middleware/auth');
const { ErroAcessoNegado, ErroRequisicao } = require('../middleware/errorHandler');

const SALT_ROUNDS = 10;
const TOKEN_EXPIRA_EM = '24h';

// Cadastro público: a pessoa escolhe o ator (Pesquisador ou Gestor Público). Administrador exige o
// código secreto CODIGO_ADMIN (variável de ambiente), senão qualquer um viraria administrador.
// Exceção: o primeiro usuário do sistema vira ADMINISTRADOR, senão ninguém conseguiria promover ninguém.
const PERFIS_LIVRES = ['PESQUISADOR', 'GESTOR'];

function codigoAdminConfere(informado) {
  const esperado = process.env.CODIGO_ADMIN;
  if (!esperado || typeof informado !== 'string') return false;
  const a = Buffer.from(informado);
  const b = Buffer.from(esperado);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function infoRegistro() {
  return {
    primeiroUsuario: (await prisma.usuario.count()) === 0,
    administradorComCodigo: !!process.env.CODIGO_ADMIN,
  };
}

async function registrar({ nome, email, senha, perfil = 'GESTOR', codigoAdmin }) {
  const existe = await prisma.usuario.findUnique({ where: { email } });
  if (existe) {
    return { erro: 'Email já cadastrado.' };
  }

  const primeiro = (await prisma.usuario.count()) === 0;
  if (!primeiro && perfil === 'ADMINISTRADOR' && !codigoAdminConfere(codigoAdmin)) {
    throw new ErroAcessoNegado('Código de administrador inválido.');
  }
  if (!primeiro && perfil !== 'ADMINISTRADOR' && !PERFIS_LIVRES.includes(perfil)) {
    throw new ErroRequisicao('Perfil inválido.');
  }

  const senhaHash = await bcrypt.hash(senha, SALT_ROUNDS);
  const perfilFinal = primeiro ? 'ADMINISTRADOR' : perfil;

  let usuario;
  try {
    usuario = await prisma.usuario.create({ data: { nome, email, senha: senhaHash, perfil: perfilFinal } });
  } catch (err) {
    if (err.code === 'P2002') return { erro: 'Email já cadastrado.' }; // cadastro simultâneo do mesmo e-mail
    throw err;
  }

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

module.exports = { registrar, login, infoRegistro };