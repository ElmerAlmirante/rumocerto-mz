import { ref, computed, watch } from 'vue'
import { calcularProgresso } from '../../shared/planner.js'
import { assinaturaPerfil, substituirPlano } from '../../shared/estado.js'
import { estadoInicial, normalizarEstadoSalvo } from '../../shared/persistencia.js'

const KEY = 'rumocerto:v3:estado'
function ler() {
  try { return normalizarEstadoSalvo(JSON.parse(localStorage.getItem(KEY) || 'null')) }
  catch { return estadoInicial() }
}

const dados = ref(ler())
watch(dados, valor => { try { localStorage.setItem(KEY, JSON.stringify(valor)) } catch {} }, { deep: true })

export function usePlano() {
  const perfil = computed(() => dados.value.perfil)
  const plano = computed(() => dados.value.plano)
  const concluidas = computed(() => dados.value.concluidas)
  const perfilDoPlano = computed(() => dados.value.perfilDoPlano)
  const progresso = computed(() => calcularProgresso(dados.value.plano, dados.value.concluidas))
  const desactualizado = computed(() => Boolean(dados.value.plano && dados.value.assinatura !== assinaturaPerfil(dados.value.perfil)))
  function guardarPlano(novo) {
    dados.value = substituirPlano(dados.value, novo, dados.value.perfil)
  }
  function alternarTarefa(chave) {
    const actual = new Set(dados.value.concluidas)
    actual.has(chave) ? actual.delete(chave) : actual.add(chave)
    dados.value.concluidas = [...actual]
  }
  function limpar() { dados.value = estadoInicial() }
  return { perfil, perfilDoPlano, plano, concluidas, progresso, desactualizado, guardarPlano, alternarTarefa, limpar }
}
