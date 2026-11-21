import { readdirSync, readFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'

const raiz = new URL('../src/', import.meta.url)
const temporarios = mkdtempSync(join(tmpdir(), 'rumocerto-vue-'))
let total = 0
let problemas = 0
function verificar(directorio) {
  for (const item of readdirSync(directorio, { withFileTypes: true })) {
    const caminho = join(directorio, item.name)
    if (item.isDirectory()) { verificar(caminho); continue }
    if (!item.name.endsWith('.vue')) continue
    const ficheiro = readFileSync(caminho, 'utf8')
    const blocos = [...ficheiro.matchAll(/<script(?:\s+[^>]*)?>([\s\S]*?)<\/script>/g)]
    const templates = [...ficheiro.matchAll(/<template\s*>/g)]
    if (templates.length !== 1) {
      problemas++
      console.error(`Componente incompleto: ${caminho}`)
      continue
    }
    for (const [indice, bloco] of blocos.entries()) {
      const temporario = join(temporarios, `script-${total++}-${indice}.mjs`)
      writeFileSync(temporario, bloco[1])
      const resultado = spawnSync(process.execPath, ['--check', temporario], { encoding: 'utf8' })
      if (resultado.status !== 0) {
        problemas++
        console.error(`Erro na sintaxe JavaScript de ${caminho}:\n${resultado.stderr}`)
      }
    }
  }
}
try {
  verificar(new URL('.', raiz).pathname)
  if (problemas) process.exitCode = 1
  else console.log(`Sintaxe JavaScript verificada em ${total} componentes Vue.`)
} finally { rmSync(temporarios, { recursive: true, force: true }) }
