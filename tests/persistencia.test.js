import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizarEstadoSalvo, normalizarPerfil, planoValido } from '../shared/persistencia.js'
import { gerarPlano, AREAS, SITUACOES, DISPONIBILIDADES, INTERNET } from '../shared/planner.js'
import { assinaturaPerfil } from '../shared/estado.js'
import { gerarPdf } from '../shared/pdf.js'

const perfil = () => ({ nome: 'Ana', area: AREAS[0], situacao: SITUACOES[0],
  objetivo: 'Preparar portefolio para emprego', disponibilidade: DISPONIBILIDADES[1],
  internet: INTERNET[0], competencias: '', dificuldade: '', usarIA: false })

test('rejeita plano com semanas incompletas ou dados corrompidos', () => {
  const valido = gerarPlano(perfil())
  const errado = structuredClone(valido)
  errado.semanas[1].tarefas = [null, 'outra tarefa']
  assert.equal(planoValido(valido), true)
  assert.equal(planoValido(errado), false)
  const estado = normalizarEstadoSalvo({ perfil: perfil(), plano: errado, concluidas: ['0-1'] })
  assert.equal(estado.plano, null)
  assert.deepEqual(estado.concluidas, [])
})

test('limita campos guardados e rejeita valores inesperados', () => {
  const resultado = normalizarPerfil({ ...perfil(), nome: 'x'.repeat(1000),
    area: '__proto__', usarIA: 'true', disponibilidade: 99 })
  assert.equal(resultado.nome.length, 90)
  assert.equal(resultado.area, '')
  assert.equal(resultado.usarIA, false)
  assert.equal(resultado.disponibilidade, DISPONIBILIDADES[1])
})

test('recupera apenas tarefas que existem e nao confia em assinaturas guardadas', () => {
  const p = perfil()
  const plano = gerarPlano(p)
  const resultado = normalizarEstadoSalvo({ perfil: p, perfilDoPlano: p, plano,
    assinatura: 'fraudulenta', concluidas: ['0-0','0-0','9-9','0-9',{},'3-4'] })
  assert.deepEqual(resultado.concluidas, ['0-0','3-4'])
  assert.equal(resultado.assinatura, assinaturaPerfil(p))
})

test('PDF nao apaga caracteres sem suporte e conserva o seu ponto Unicode', () => {
  const p = { ...perfil(), objetivo: 'Preparar currículo com 50€, símbolos 📌 e caracteres 你好' }
  const doc = new TextDecoder('latin1').decode(gerarPdf(p, gerarPlano(p)))
  assert.match(doc, /50\x80/)
  assert.match(doc, /\[U\+1F4CC\]/)
  assert.match(doc, /\[U\+4F60\]/)
  assert.match(doc, /\[U\+597D\]/)
  assert.doesNotMatch(doc, /\?\?/)
})
