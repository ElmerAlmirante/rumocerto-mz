import { assinaturaPerfil } from './estado.js'
import { AREAS, SITUACOES, DISPONIBILIDADES, INTERNET } from './planner.js'

export const PERFIL_INICIAL = {
  nome: '', area: '', situacao: '', objetivo: '', disponibilidade: DISPONIBILIDADES[1],
  internet: INTERNET[0], competencias: '', dificuldade: '', usarIA: false
}

const LIMITE = { nome: 90, objetivo: 450, competencias: 300, dificuldade: 450 }
const LISTAS = { area: AREAS, situacao: SITUACOES, disponibilidade: DISPONIBILIDADES, internet: INTERNET }

export function normalizarPerfil(valor) {
  const origem = valor && typeof valor === 'object' && !Array.isArray(valor) ? valor : {}
  const perfil = { ...PERFIL_INICIAL }
  for (const [campo, padrao] of Object.entries(PERFIL_INICIAL)) {
    const v = origem[campo]
    if (campo === 'usarIA') perfil[campo] = v === true
    else if (typeof v !== 'string') perfil[campo] = padrao
    else if (LISTAS[campo]) perfil[campo] = LISTAS[campo].includes(v) ? v : padrao
    else perfil[campo] = v.replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, LIMITE[campo] || 450)
  }
  return perfil
}

const texto = (valor, maximo) => typeof valor === 'string' && valor.length > 0 && valor.length <= maximo
const lista = (valor, maximo, tamanho) => Array.isArray(valor) && valor.length <= maximo && valor.every(x => texto(x, tamanho))

export function planoValido(plano) {
  if (!plano || typeof plano !== 'object' || Array.isArray(plano)) return false
  if (!texto(plano.titulo, 250) || !texto(plano.diagnostico, 2000) ||
    !texto(plano.estrategia, 2000) || !texto(plano.metodo, 150) ||
    !Array.isArray(plano.semanas) || plano.semanas.length !== 4) return false
  if (!lista(plano.recursos, 20, 500) || !lista(plano.avisos, 20, 500)) return false
  return plano.semanas.every((semana, i) => semana && typeof semana === 'object' &&
    semana.numero === i + 1 && texto(semana.titulo, 250) && texto(semana.foco, 800) &&
    texto(semana.entregavel, 800) && texto(semana.indicador, 800) &&
    Array.isArray(semana.tarefas) && semana.tarefas.length >= 1 && semana.tarefas.length <= 10 &&
    semana.tarefas.every(t => texto(t, 1200)) &&
    Number.isInteger(semana.minutosSugeridos) && semana.minutosSugeridos >= 0 && semana.minutosSugeridos <= 10080 &&
    Array.isArray(semana.minutosPorTarefa) && semana.minutosPorTarefa.length === semana.tarefas.length &&
    semana.minutosPorTarefa.every(v => Number.isInteger(v) && v >= 0 && v <= 1440))
}

export function estadoInicial() {
  return { perfil: { ...PERFIL_INICIAL }, plano: null, perfilDoPlano: null, concluidas: [], assinatura: '' }
}

export function normalizarEstadoSalvo(salvo) {
  if (!salvo || typeof salvo !== 'object' || Array.isArray(salvo)) return estadoInicial()
  const perfil = normalizarPerfil(salvo.perfil)
  const plano = planoValido(salvo.plano) ? salvo.plano : null
  if (!plano) return { ...estadoInicial(), perfil }
  const perfilDoPlano = normalizarPerfil(salvo.perfilDoPlano || perfil)
  const concluidas = Array.isArray(salvo.concluidas) ? [...new Set(salvo.concluidas.filter(chave => {
    if (typeof chave !== 'string' || !/^[0-3]-\d$/.test(chave)) return false
    const [semana, tarefa] = chave.split('-').map(Number)
    return tarefa < plano.semanas[semana].tarefas.length
  }))] : []
  return {
    perfil, plano, perfilDoPlano, concluidas,
    assinatura: assinaturaPerfil(perfilDoPlano)
  }
}
