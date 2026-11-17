import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'

const ficheiros = [
  ...readdirSync(new URL('../src/views/', import.meta.url)).map(nome => `../src/views/${nome}`),
  ...readdirSync(new URL('../src/components/', import.meta.url)).map(nome => `../src/components/${nome}`),
  '../index.html'
]

test('interface usa linguagem uniforme e não contém expressões promocionais inadequadas', () => {
  const proibidas = /\b(?:malta|teu|tua|teus|tuas|podes|queres|vais|estás|concluíste|criaste|dados reais)\b/i
  for (const ficheiro of ficheiros) {
    const texto = readFileSync(new URL(ficheiro, import.meta.url), 'utf8')
    assert.doesNotMatch(texto, proibidas, ficheiro)
  }
})
