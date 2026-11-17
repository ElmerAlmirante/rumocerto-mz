import test from 'node:test'
import assert from 'node:assert/strict'
import { assinaturaPerfil, substituirPlano } from '../shared/estado.js'
import { gerarPlano, AREAS, SITUACOES, DISPONIBILIDADES, INTERNET } from '../shared/planner.js'

const perfil = () => ({
  area: AREAS[0], situacao: SITUACOES[0], objetivo: 'Criar um projecto Vue completo',
  disponibilidade: DISPONIBILIDADES[1], internet: INTERNET[0], competencias: '', dificuldade: ''
})

test('preserva o progresso ao actualizar o mesmo plano', () => {
  const p = perfil()
  const inicial = { perfil: p, plano: gerarPlano(p), assinatura: assinaturaPerfil(p), concluidas: ['0-1', '1-2'] }
  const final = substituirPlano(inicial, gerarPlano(p), p)
  assert.deepEqual(final.concluidas, ['0-1', '1-2'])
  assert.equal(final.assinatura, assinaturaPerfil(p))
})

test('alterar a meta inicia progresso de um novo plano', () => {
  const p = perfil()
  const inicial = { perfil: p, plano: gerarPlano(p), assinatura: assinaturaPerfil(p), concluidas: ['0-1', '1-2'] }
  const novoPerfil = { ...p, objetivo: 'Melhorar o meu portefólio profissional' }
  const final = substituirPlano(inicial, gerarPlano(novoPerfil), novoPerfil)
  assert.deepEqual(final.concluidas, [])
  assert.equal(final.perfilDoPlano.objetivo, novoPerfil.objetivo)
})

test('a assinatura ignora consentimento, email e nome de tratamento', () => {
  const p = perfil()
  assert.equal(assinaturaPerfil(p), assinaturaPerfil({ ...p, email: 'ana@example.com', nome: 'Ana', consentimento: true }))
})

test('reinicia progresso se as tarefas forem alteradas pela versão remota', () => {
  const p = perfil()
  const anterior = gerarPlano(p)
  const diferente = structuredClone(anterior)
  diferente.semanas[0].tarefas[0] = 'Uma nova tarefa enviada pelo servidor'
  const estado = { perfil: p, plano: anterior, assinatura: assinaturaPerfil(p), concluidas: ['0-0','1-2'] }
  assert.deepEqual(substituirPlano(estado, diferente, p).concluidas, [])
})
