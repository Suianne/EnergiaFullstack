const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/database');
const { JWT_SECRET } = require('../middleware/auth');
const { ErroHttp } = require('../middleware/errorHandler');

const SALT_ROUNDS = 10;
const TOKEN_EXPIRA_EM = '24h';
// Chave do lock consultivo usado no cadastro (qualquer inteiro fixo)
const LOCK_REGISTRO = 4201;

const PERFIS = ['ADMINISTRADOR', 'PESQUISADOR', 'GESTOR'];
// Perfis que qualquer pessoa pode escolher ao criar a própria conta.
// ADMINISTRADOR só é concedido pelo primeiro cadastro do sistema ou por outro administrador.
const PERFIS_PUBLICOS = ['GESTOR', 'PESQUISADOR'];
const PERFIL_PUBLICO_PADRAO = 'GESTOR';

function dadosPublicos(usuario) {
  return { id: usuario.id, nome: usuario.nome, email: usuario.email, perfil: usuario.perfil };
}

function gerarToken(usuario) {
  return jwt.sign(dadosPublicos(usuario), JWT_SECRET, { expiresIn: TOKEN_EXPIRA_EM });
}

/**
 * Cria um usuário.
 * - Cadastro público: só GESTOR ou PESQUISADOR. Se ainda não existir nenhum usuário,
 *   o primeiro cadastro vira ADMINISTRADOR (bootstrap do sistema).
 * - `porAdministrador: true` (tela de usuários do admin): qualquer perfil.
 */
async function registrar({ nome, email, senha, perfil }, { porAdministrador = false } = {}) {
  const existe = await prisma.usuario.findUnique({ where: { email } });
  if (existe) throw new ErroHttp('Email já cadastrado.', 409);

  const senhaHash = await bcrypt.hash(senha, SALT_ROUNDS);

  // A decisão "é o primeiro usuário?" e a criação acontecem na mesma transação, com um
  // lock consultivo do PostgreSQL, para que dois cadastros simultâneos num banco vazio
  // não virem dois administradores.
  const { usuario, primeiroUsuario } = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_REGISTRO})`;

    const totalUsuarios = await tx.usuario.count();
    let perfilFinal = perfil || PERFIL_PUBLICO_PADRAO;
    let primeiro = false;

    if (totalUsuarios === 0) {
      perfilFinal = 'ADMINISTRADOR';
      primeiro = true;
    } else if (!porAdministrador && !PERFIS_PUBLICOS.includes(perfilFinal)) {
      throw new ErroHttp(
        `O perfil ${perfilFinal} só pode ser concedido por um administrador. Escolha: ${PERFIS_PUBLICOS.join(' ou ')}.`,
        403,
      );
    }

    const criado = await tx.usuario.create({
      data: { nome, email, senha: senhaHash, perfil: perfilFinal },
    });
    return { usuario: criado, primeiroUsuario: primeiro };
  });

  return { token: gerarToken(usuario), usuario: dadosPublicos(usuario), primeiroUsuario };
}

async function login({ email, senha }) {
  const usuario = await prisma.usuario.findUnique({ where: { email } });
  if (!usuario) throw new ErroHttp('Email ou senha incorretos.', 401);

  const senhaCorreta = await bcrypt.compare(senha, usuario.senha);
  if (!senhaCorreta) throw new ErroHttp('Email ou senha incorretos.', 401);

  return { token: gerarToken(usuario), usuario: dadosPublicos(usuario) };
}

// Dados atuais do usuário logado (perfil pode ter sido alterado por um administrador)
// com um token novo refletindo o perfil atual.
async function usuarioAtual(id) {
  const usuario = await prisma.usuario.findUnique({ where: { id } });
  if (!usuario) throw new ErroHttp('Usuário não encontrado.', 401);
  return { token: gerarToken(usuario), usuario: dadosPublicos(usuario) };
}

module.exports = { registrar, login, usuarioAtual, PERFIS, PERFIS_PUBLICOS, PERFIL_PUBLICO_PADRAO };
