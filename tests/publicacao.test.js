import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const raiz = fileURLToPath(new URL('../', import.meta.url))
const pre = fileURLToPath(new URL('./fixtures/servico-publicacao-simulado.mjs', import.meta.url))
const script = fileURLToPath(new URL('../scripts/verificar-producao.mjs', import.meta.url))
function executar({ sitekey = '0x4AAAAAA-exemplo-publico', versao = '3.8', cors = 'https://k6n9.github.io' } = {}) {
  return spawnSync(process.execPath, ['--import', pre, script], {cwd: raiz, encoding: 'utf8',
    env: {...process.env, RUMOCERTO_WORKER_URL: 'https://worker.exemplo.org',
      RUMOCERTO_PUBLICACAO_ESTRITA: 'true', VITE_TURNSTILE_SITE_KEY: sitekey,
      RUMOCERTO_TEST_VERSAO: versao, RUMOCERTO_TEST_CORS: cors}})
}
test('publicação permite frontend e Worker 3.8 compatíveis', () => {
  const r = executar()
  assert.equal(r.status, 0, r.stderr)
  assert.match(r.stdout, /Worker 3\.8 disponível/)
})
test('publicação bloqueia se a chave pública do Turnstile falta', () => {
  const r = executar({sitekey:''})
  assert.equal(r.status, 1)
  assert.match(r.stderr, /VITE_TURNSTILE_SITE_KEY/)
})
test('publicação bloqueia versões anteriores do Worker', () => {
  const r = executar({versao:'3.6'})
  assert.equal(r.status, 1)
  assert.match(r.stderr, /incompatível/)
})
test('publicação bloqueia CORS para uma origem diferente', () => {
  const r = executar({cors:'https://dominio-invalido.exemplo.org'})
  assert.equal(r.status, 1)
  assert.match(r.stderr, /CORS/)
})
test('o workflow de publicação transmite a chave Turnstile pública e verifica o Worker', () => {
  const yaml = readFileSync(fileURLToPath(new URL('../.github/workflows/deploy.yml', import.meta.url)), 'utf8')
  assert.match(yaml, /VITE_TURNSTILE_SITE_KEY: \$\{\{ vars\.VITE_TURNSTILE_SITE_KEY \}\}/)
  assert.match(yaml, /RUMOCERTO_PUBLICACAO_ESTRITA: 'true'/)
  assert.match(yaml, /npm run producao:teste/)
})
