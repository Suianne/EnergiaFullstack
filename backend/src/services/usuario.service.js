// Gestão de usuários e níveis de acesso (somente ADMINISTRADOR).
const prisma = require('../config/database');
const { ErroHttp } = require('../middleware/errorHandler');
const authService = require('./auth.service');

const SELECT_PUBLICO = { id: true, nome: true, email: true, perfil: true, createdAt: true };

async function listar() {
  return prisma.usuario.findMany({ select: SELECT_PUBLICO, orderBy: [{ perfil: 'asc' }, { nome: 'asc' }] });
}

async function criar(dados) {
  const { usuario } = await authService.registrar(dados, { porAdministrador: true });
  return usuario;
}

async function contarAdministradores() {
  return prisma.usuario.count({ where: { perfil: 'ADMINISTRADOR' } });
}

/**
 * Altera o perfil de um usuário. Impede que o sistema fique sem administrador.
 */
async function atualizarPerfil(id, perfil, { solicitanteId }) {
  if (!authService.PERFIS.includes(perfil)) {
    throw new ErroHttp(`"perfil" deve ser: ${authService.PERFIS.join(', ')}.`, 400);
  }

  const alvo = await prisma.usuario.findUnique({ where: { id } });
  if (!alvo) throw new ErroHttp('Usuário não encontrado.', 404);

  if (alvo.perfil === 'ADMINISTRADOR' && perfil !== 'ADMINISTRADOR') {
    if (alvo.id === solicitanteId) {
      throw new ErroHttp('Você não pode remover o próprio perfil de administrador.', 400);
    }
    if ((await contarAdministradores()) <= 1) {
      throw new ErroHttp('O sistema precisa de ao menos um administrador.', 400);
    }
  }

  return prisma.usuario.update({ where: { id }, data: { perfil }, select: SELECT_PUBLICO });
}

async function remover(id, { solicitanteId }) {
  if (id === solicitanteId) throw new ErroHttp('Você não pode excluir a própria conta.', 400);

  const alvo = await prisma.usuario.findUnique({ where: { id } });
  if (!alvo) throw new ErroHttp('Usuário não encontrado.', 404);

  if (alvo.perfil === 'ADMINISTRADOR' && (await contarAdministradores()) <= 1) {
    throw new ErroHttp('O sistema precisa de ao menos um administrador.', 400);
  }

  // As simulações do usuário são mantidas (usuario_id vira null).
  await prisma.usuario.delete({ where: { id } });
}

module.exports = { listar, criar, atualizarPerfil, remover };
