const prisma = require('../config/database');
const { ErroConflito } = require('../middleware/errorHandler');

const PERFIS = ['ADMINISTRADOR', 'PESQUISADOR', 'GESTOR'];

const CAMPOS = { id: true, nome: true, email: true, perfil: true, createdAt: true };

async function listar() {
  return prisma.usuario.findMany({ orderBy: { nome: 'asc' }, select: CAMPOS });
}

// Nunca pode sobrar o sistema sem nenhum administrador.
async function garantirOutroAdministrador(id) {
  const outros = await prisma.usuario.count({ where: { perfil: 'ADMINISTRADOR', id: { not: id } } });
  if (outros === 0) throw new ErroConflito('Deve existir ao menos um administrador.');
}

async function alterarPerfil(id, perfil) {
  const alvo = await prisma.usuario.findUnique({ where: { id } });
  if (!alvo) return null;
  if (alvo.perfil === 'ADMINISTRADOR' && perfil !== 'ADMINISTRADOR') await garantirOutroAdministrador(id);
  return prisma.usuario.update({ where: { id }, data: { perfil }, select: CAMPOS });
}

async function remover(id, idSolicitante) {
  if (id === idSolicitante) throw new ErroConflito('Você não pode excluir a própria conta.');
  const alvo = await prisma.usuario.findUnique({ where: { id } });
  if (!alvo) return false;
  if (alvo.perfil === 'ADMINISTRADOR') await garantirOutroAdministrador(id);
  await prisma.usuario.delete({ where: { id } });
  return true;
}

module.exports = { PERFIS, listar, alterarPerfil, remover };
