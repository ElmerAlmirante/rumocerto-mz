import test from 'node:test'
import assert from 'node:assert/strict'
import worker, { PlanoJob, LimiteEnvios, teste } from '../backend/worker.js'
import { AREAS, SITUACOES, DISPONIBILIDADES, INTERNET } from '../shared/planner.js'

const dados = () => ({
  nome: 'Ana', area: AREAS[0], situacao: SITUACOES[0],
  objetivo: 'Criar um pequeno projecto com Vue', disponibilidade: DISPONIBILIDADES[1],
  internet: INTERNET[0], competencias: '', dificuldade: '', usarIA: false,
  consentimento: true, email: 'ana@example.com', website: '', submissaoId: crypto.randomUUID()
})
function estadoSimulado() {
  const map = new Map()
  let serial = Promise.resolve()
  let alarme = null
  return {
    storage: {
      async get(k) { return structuredClone(map.get(k)) },
      async put(k, v) { map.set(k, structuredClone(v)) },
      async setAlarm(valor) { alarme = valor },
      async deleteAll() { map.clear() },
      async getAlarm() { return alarme }
    },
    blockConcurrencyWhile(fn) {
      const atual = serial.then(fn)
      serial = atual.catch(() => {})
      return atual
    }
  }
}
function ambiente() {
  const planos = new Map(), limites = new Map()
  const env = {
    ALLOWED_ORIGINS: 'https://k6n9.github.io,http://localhost:5173',
    PUBLIC_WORKER_URL: 'https://rumocerto.example.com',
    EMAILJS_SERVICE_ID: 'service_demo', EMAILJS_PUBLIC_KEY: 'public_demo',
    EMAILJS_TEMPLATE_CONFIRM: 'confirm_demo', EMAILJS_TEMPLATE_PLAN: 'plan_demo',
    REQUIRE_EMAIL_VERIFICATION: 'false', RATE_SALT: 'salt-seguro-para-testes-2026', DOWNLOAD_SECRET: 'uma-frase-secreta-de-pelo-menos-24-caracteres'
  }
  env.PLANOS = {
    idFromName: nome => nome,
    get(id) {
      if (!planos.has(id)) {
        const state = estadoSimulado()
        const object = new PlanoJob(state, env)
        planos.set(id, { object, state, fetch: (url, init) => object.fetch(new Request(url,init)) })
      }
      return planos.get(id)
    }
  }
  env.LIMITES = {
    idFromName: nome => nome,
    get(id) {
      if (!limites.has(id)) {
        const object = new LimiteEnvios(estadoSimulado())
        limites.set(id, { fetch: (url, init) => object.fetch(new Request(url,init)) })
      }
      return limites.get(id)
    }
  }
  return { env, planos, limites }
}
function request(path, method='GET', data, origin='https://k6n9.github.io', auth='', ip='127.0.0.1') {
  return new Request('https://rumocerto.example.com' + path, {
    method, headers: { Origin: origin, 'Content-Type': 'application/json',
      'CF-Connecting-IP': ip, ...(auth ? { Authorization: `Bearer ${auth}` } : {}) },
    ...(data ? { body: JSON.stringify(data) } : {})
  })
}

test('saude declara protocolo e disponibilidade do envio', async () => {
  const { env } = ambiente()
  const response = await worker.fetch(request('/api/saude'), env)
  const body = await response.json()
  assert.equal(response.status, 200)
  assert.equal(body.versao, '3.8')
  assert.equal(body.envioDisponivel, true)
})
test('bloqueia origem desconhecida e responde a preflight', async () => {
  const { env } = ambiente()
  assert.equal((await worker.fetch(request('/api/saude', 'GET', null, 'https://outro.example'), env)).status, 403)
  const res = await worker.fetch(request('/api/planos','OPTIONS'), env)
  assert.equal(res.status, 204)
  assert.match(res.headers.get('Access-Control-Allow-Headers'), /Authorization/)
})
test('rejeita perfil, consentimento e honeypot inválidos', async () => {
  for (const invalido of [{ email:'invalido' },{ consentimento:false },{ website:'sou-bot' }]) {
    const { env } = ambiente()
    assert.equal((await worker.fetch(request('/api/planos','POST',{ ...dados(),...invalido }), env)).status, 422)
  }
})
test('rejeita configuração insegura do endereço PDF', async () => {
  const { env } = ambiente()
  await assert.rejects(teste.ligacaoPdf({ ...env, PUBLIC_WORKER_URL: 'http://inseguro.example' }, crypto.randomUUID()))
})
test('assinatura PDF é exclusiva por pedido', async () => {
  const { env } = ambiente()
  const a = crypto.randomUUID(), b = crypto.randomUUID()
  assert.notEqual(await teste.assinatura(env,a), await teste.assinatura(env,b))
  assert.match(await teste.ligacaoPdf(env,a), /assinatura=[0-9a-f]{64}/)
})
test('guarda pedido primeiro, envia confirmação e entrega PDF protegido', async () => {
  const antigo = globalThis.fetch
  const mensagens = []
  globalThis.fetch = async (_url, init) => {
    mensagens.push(JSON.parse(init.body))
    return new Response('OK', { status: 200 })
  }
  try {
    const { env, planos } = ambiente()
    const response = await worker.fetch(request('/api/planos','POST',dados()), env)
    assert.equal(response.status, 201)
    const recebido = await response.json()
    assert.equal(recebido.estado, 'pendente')
    assert.equal(mensagens.length, 1)
    const internal = planos.get(recebido.id)
    assert.equal((await internal.state.storage.get('job')).estado,'pendente')
    assert.equal((await worker.fetch(request(`/api/planos/${recebido.id}`),env)).status,401)
    assert.equal((await worker.fetch(request(`/api/planos/${recebido.id}`,'GET',null,'https://k6n9.github.io',recebido.token),env)).status,200)
    const link = await teste.ligacaoPdf(env, recebido.id)
    const pdfUrl = new URL(link)
    const pdf = await worker.fetch(request(pdfUrl.pathname + pdfUrl.search), env)
    assert.equal(pdf.status,200)
    assert.equal(pdf.headers.get('Content-Type'),'application/pdf')
    assert.equal((await worker.fetch(request(pdfUrl.pathname+'?assinatura=invalid'), env)).status,401)
    const job = await internal.state.storage.get('job')
    job.agendadoPara=Date.now()-1
    await internal.state.storage.put('job',job)
    await Promise.all([internal.object.alarm(),internal.object.alarm()])
    assert.equal(mensagens.length,2)
    assert.equal(mensagens[1].template_id,'plan_demo')
    assert.equal((await internal.state.storage.get('job')).estado, 'enviado')
    assert.equal((await worker.fetch(request('/api/planos','POST',dados()),env)).status,429)
  } finally { globalThis.fetch=antigo }
})
test('duas solicitações simultâneas no mesmo IP são limitadas', async () => {
  const antigo = globalThis.fetch
  globalThis.fetch = async () => new Response('OK',{status:200})
  try {
    const { env } = ambiente()
    const results = await Promise.all([
      worker.fetch(request('/api/planos','POST',dados()),env),
      worker.fetch(request('/api/planos','POST',{ ...dados(), email:'outro@example.com' }),env)
    ])
    assert.deepEqual(results.map(x=>x.status).sort(),[201,429])
  } finally { globalThis.fetch=antigo }
})
test('falha no envio de confirmação não agenda a entrega', async () => {
  const antigo = globalThis.fetch
  globalThis.fetch = async () => new Response('erro',{status:502})
  try {
    const { env, planos } = ambiente()
    const r = await worker.fetch(request('/api/planos','POST',dados()),env)
    assert.equal(r.status,202)
    const recuperacao = await r.json()
    assert.equal(recuperacao.estado,'incerto')
    assert.equal(recuperacao.faseIncerta,'confirmacao')
    assert.match(recuperacao.token,/^[0-9a-f]{48}$/)
    const job = await [...planos.values()][0].state.storage.get('job')
    assert.equal(job.estado,'incerto')
  } finally { globalThis.fetch=antigo }
})
test('segundo envio recusado resulta em falha, sem reenvio duplicado', async () => {
  const antigo = globalThis.fetch
  let num=0
  globalThis.fetch = async () => new Response('ok',{status:++num===1?200:502})
  try {
    const { env, planos } = ambiente()
    const r = await worker.fetch(request('/api/planos','POST',dados()),env)
    const response = await r.json()
    const object = planos.get(response.id)
    const job = await object.state.storage.get('job')
    job.agendadoPara = Date.now()-1
    await object.state.storage.put('job',job)
    await object.object.alarm()
    await object.object.alarm()
    assert.equal(num,2)
    assert.equal((await object.state.storage.get('job')).estado,'incerto')
  } finally { globalThis.fetch=antigo }
})

test('saude nao anuncia email sem as credenciais obrigatorias', async () => {
  for (const chave of ['EMAILJS_SERVICE_ID', 'EMAILJS_PUBLIC_KEY', 'EMAILJS_TEMPLATE_CONFIRM', 'PUBLIC_WORKER_URL']) {
    const { env } = ambiente()
    delete env[chave]
    const response = await worker.fetch(request('/api/saude'), env)
    assert.equal((await response.json()).envioDisponivel, false, chave)
    assert.equal((await worker.fetch(request('/api/planos', 'POST', dados()), env)).status, 503, chave)
  }
})

test('guardar agenda recuperacao mesmo antes de tentar enviar confirmacao', async () => {
  const { env, planos } = ambiente()
  const id = crypto.randomUUID()
  const object = env.PLANOS.get(env.PLANOS.idFromName(id))
  const criado = await object.fetch('https://interno/guardar', {
    method: 'POST', body: JSON.stringify({ id, estado: 'por_confirmar', expiraEm: Date.now() + 7 * 86400000,
      agendadoPara: Date.now() + 300000, pedido: dados(), email: 'ana@example.com', plano: { semanas: [{ tarefas: ['passo'] }] } })
  })
  assert.equal(criado.status, 201)
  assert.ok(await planos.get(id).state.storage.getAlarm())
})

test('alarme recupera confirmacao que nao chegou a iniciar', async () => {
  const antigo = globalThis.fetch
  let enviados = 0
  globalThis.fetch = async () => { enviados++; return new Response('ok', { status: 200 }) }
  try {
    const { env, planos } = ambiente()
    const id = crypto.randomUUID()
    const object = env.PLANOS.get(env.PLANOS.idFromName(id))
    const job = { id, estado: 'por_confirmar', expiraEm: Date.now() + 7 * 86400000,
      agendadoPara: Date.now() + 300000, pedido: dados(), email: 'ana@example.com',
      plano: { semanas: [{ tarefas: ['passo'] }] } }
    assert.equal((await object.fetch('https://interno/guardar', { method: 'POST', body: JSON.stringify(job) })).status, 201)
    await planos.get(id).object.alarm()
    assert.equal(enviados, 1)
    assert.equal((await planos.get(id).state.storage.get('job')).estado, 'pendente')
  } finally { globalThis.fetch = antigo }
})

test('repetir identificador do pedido recupera sem enviar novos emails', async () => {
  const antigo = globalThis.fetch
  let enviados = 0
  globalThis.fetch = async () => { enviados++; return new Response('ok', { status: 200 }) }
  try {
    const { env } = ambiente()
    const formulario = dados()
    const resposta = await worker.fetch(request('/api/planos', 'POST', formulario), env)
    const original = await resposta.json()
    assert.equal(resposta.status, 201)
    const repetida = await worker.fetch(request('/api/planos', 'POST', formulario), env)
    assert.equal(repetida.status, 200)
    const recuperado = await repetida.json()
    assert.equal(recuperado.id, original.id)
    assert.equal(recuperado.token, original.token)
    assert.deepEqual(recuperado.plano, original.plano)
    assert.equal(enviados, 1)
  } finally { globalThis.fetch = antigo }
})

test('recusa reutilizacao do mesmo identificador para um perfil diferente', async () => {
  const antigo = globalThis.fetch
  globalThis.fetch = async () => new Response('ok', { status: 200 })
  try {
    const { env } = ambiente()
    const formulario = dados()
    assert.equal((await worker.fetch(request('/api/planos', 'POST', formulario), env)).status, 201)
    assert.equal((await worker.fetch(request('/api/planos', 'POST', {
      ...formulario, email: 'intruso@example.com'
    }), env)).status, 409)
  } finally { globalThis.fetch = antigo }
})

test('falha de rede deixa estado incerto em vez de reenviar automaticamente', async () => {
  const antigo = globalThis.fetch
  let chamados = 0
  globalThis.fetch = async () => {
    chamados++
    if (chamados === 1) return new Response('ok', { status: 200 })
    throw new TypeError('ligacao perdida depois da submissao')
  }
  try {
    const { env, planos } = ambiente()
    const resposta = await worker.fetch(request('/api/planos', 'POST', dados()), env)
    const original = await resposta.json()
    const object = planos.get(original.id)
    const job = await object.state.storage.get('job')
    job.agendadoPara = Date.now() - 1
    await object.state.storage.put('job', job)
    await object.object.alarm()
    await object.object.alarm()
    assert.equal(chamados, 2)
    assert.equal((await object.state.storage.get('job')).estado, 'incerto')
    assert.ok(await object.state.storage.getAlarm())
  } finally { globalThis.fetch = antigo }
})

test('alarme reconhece confirmacao interrompida sem reenviar', async () => {
  const antigo = globalThis.fetch
  let enviados = 0
  globalThis.fetch = async () => { enviados++; return new Response('ok',{status:200}) }
  try {
    const { env, planos } = ambiente()
    const id = crypto.randomUUID()
    const stub = env.PLANOS.get(id)
    const job = { id, estado: 'a_confirmar', confirmacaoIniciada: Date.now()-90000,
      expiraEm: Date.now()+3600000, agendadoPara: Date.now()+300000 }
    await stub.state.storage.put('job',job)
    await stub.object.alarm()
    assert.equal((await planos.get(id).state.storage.get('job')).estado,'incerto')
    assert.equal(enviados,0)
  } finally { globalThis.fetch=antigo }
})

test('alarme limpa pedido expirado sem tentar enviar', async () => {
  const { env, planos } = ambiente()
  const id = crypto.randomUUID()
  const stub = env.PLANOS.get(id)
  await stub.state.storage.put('job', { id, estado:'pendente', expiraEm: Date.now()-1 })
  await stub.object.alarm()
  assert.equal(await planos.get(id).state.storage.get('job'),undefined)
})

test('e-mail bloqueado noutro IP não bloqueia utilizador independente', async () => {
  const anterior = globalThis.fetch
  let enviados = 0
  globalThis.fetch = async () => { enviados++; return new Response('OK', { status: 200 }) }
  try {
    const { env } = ambiente()
    const a = dados()
    const primeira = await worker.fetch(request('/api/planos','POST',a,'https://k6n9.github.io','','203.0.113.10'),env)
    assert.equal(primeira.status,201)
    const repetida = await worker.fetch(request('/api/planos','POST',{...a,submissaoId:crypto.randomUUID()},'https://k6n9.github.io','','203.0.113.20'),env)
    assert.equal(repetida.status,429)
    const b = {...dados(),email:'b@example.com'}
    const terceira = await worker.fetch(request('/api/planos','POST',b,'https://k6n9.github.io','','203.0.113.20'),env)
    assert.equal(terceira.status,201)
    assert.equal(enviados,2)
  } finally { globalThis.fetch = anterior }
})

test('reserva de e-mail é libertada quando o IP já está limitado', async () => {
  const anterior=globalThis.fetch
  globalThis.fetch=async()=>new Response('OK',{status:200})
  try {
    const {env}=ambiente()
    assert.equal((await worker.fetch(request('/api/planos','POST',dados(),'https://k6n9.github.io','','198.51.100.8'),env)).status,201)
    const segundo={...dados(),email:'segundo@example.com'}
    assert.equal((await worker.fetch(request('/api/planos','POST',segundo,'https://k6n9.github.io','','198.51.100.8'),env)).status,429)
    assert.equal((await worker.fetch(request('/api/planos','POST',{...segundo,submissaoId:crypto.randomUUID()},'https://k6n9.github.io','','198.51.100.9'),env)).status,201)
  } finally { globalThis.fetch=anterior }
})

test('a reserva não pode ser libertada por outro identificador', async () => {
  const {env}=ambiente()
  const gate=env.LIMITES.get(env.LIMITES.idFromName('limite-privado'))
  const id=crypto.randomUUID()
  const opcoes=(reserva)=>({method:'POST',body:JSON.stringify({reserva})})
  assert.equal((await gate.fetch('https://interno/reservar',opcoes(id))).status,200)
  assert.deepEqual(await (await gate.fetch('https://interno/libertar',opcoes(crypto.randomUUID()))).json(),{libertado:false})
  assert.equal((await gate.fetch('https://interno/reservar',opcoes(crypto.randomUUID()))).status,429)
  assert.deepEqual(await (await gate.fetch('https://interno/libertar',opcoes(id))).json(),{libertado:true})
  assert.equal((await gate.fetch('https://interno/reservar',opcoes(crypto.randomUUID()))).status,200)
})

test('recusa pedidos sem JSON e corpos maiores que 8 KB sem criar registos', async () => {
  const { env, planos } = ambiente()
  const id = crypto.randomUUID()
  const semTipo = new Request('https://rumocerto.example.com/api/planos', {
    method: 'POST', headers: { Origin: 'https://k6n9.github.io', 'Content-Type': 'text/plain' },
    body: JSON.stringify({ ...dados(), submissaoId: id })
  })
  assert.equal((await worker.fetch(semTipo, env)).status, 415)
  const grande = new Request('https://rumocerto.example.com/api/planos', {
    method: 'POST', headers: { Origin: 'https://k6n9.github.io', 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...dados(), submissaoId: id, lixo: 'x'.repeat(12000) })
  })
  assert.equal((await worker.fetch(grande, env)).status, 413)
  assert.equal(planos.size, 0)
  const corrompido = new Request('https://rumocerto.example.com/api/planos', {
    method: 'POST', headers: { Origin: 'https://k6n9.github.io', 'Content-Type': 'application/json' },
    body: '{'
  })
  assert.equal((await worker.fetch(corrompido, env)).status, 400)
})

test('ligação de PDF tem validade, assinatura e não permite adulterar o prazo', async () => {
  const antigo = globalThis.fetch
  globalThis.fetch = async () => new Response('OK', { status: 200 })
  try {
    const { env } = ambiente()
    const criado = await (await worker.fetch(request('/api/planos', 'POST', dados()), env)).json()
    const url = new URL(await teste.ligacaoPdf(env, criado.id))
    const prazo = Number(url.searchParams.get('expira'))
    assert.ok(prazo - Date.now() > 47 * 60 * 60 * 1000)
    assert.ok(prazo - Date.now() <= 48 * 60 * 60 * 1000)
    const valido = await worker.fetch(request(url.pathname + url.search), env)
    assert.equal(valido.status, 200)
    const alterado = new URL(url)
    alterado.searchParams.set('expira', String(prazo + 10000))
    assert.equal((await worker.fetch(request(alterado.pathname + alterado.search), env)).status, 401)
    const expirado = new URL(url)
    expirado.searchParams.set('expira', String(Date.now() - 1000))
    assert.equal((await worker.fetch(request(expirado.pathname + expirado.search), env)).status, 410)
    const semPrazo = new URL(url)
    semPrazo.searchParams.delete('expira')
    assert.equal((await worker.fetch(request(semPrazo.pathname + semPrazo.search), env)).status, 401)
  } finally { globalThis.fetch = antigo }
})

test('eliminar pedido exige token, apaga dados, cancela alarme e revoga PDF', async () => {
  const antigo = globalThis.fetch
  const mensagens = []
  globalThis.fetch = async (_url, init) => { mensagens.push(JSON.parse(init.body)); return new Response('OK', { status: 200 }) }
  try {
    const { env, planos } = ambiente()
    const criado = await (await worker.fetch(request('/api/planos', 'POST', dados()), env)).json()
    const link = new URL(await teste.ligacaoPdf(env, criado.id))
    const caminho = `/api/planos/${criado.id}`
    assert.equal((await worker.fetch(request(caminho, 'DELETE'), env)).status, 401)
    assert.equal((await worker.fetch(request(caminho, 'DELETE', null, 'https://k6n9.github.io', 'a'.repeat(48)), env)).status, 401)
    const response = await worker.fetch(request(caminho, 'DELETE', null, 'https://k6n9.github.io', criado.token), env)
    assert.equal(response.status, 200)
    assert.equal((await response.json()).eliminado, true)
    const objecto = planos.get(criado.id)
    assert.equal(await objecto.state.storage.get('job'), undefined)
    await objecto.object.alarm()
    assert.equal(mensagens.length, 1)
    assert.equal((await worker.fetch(request(link.pathname + link.search), env)).status, 404)
    assert.equal((await worker.fetch(request(caminho, 'GET', null, 'https://k6n9.github.io', criado.token), env)).status, 404)
    assert.equal((await worker.fetch(request(caminho, 'DELETE', null, 'https://k6n9.github.io', criado.token), env)).status, 404)
  } finally { globalThis.fetch = antigo }
})

test('resposta de limite informa segundos para aguardar e Retry-After', async () => {
  const antigo = globalThis.fetch
  globalThis.fetch = async () => new Response('OK', { status: 200 })
  try {
    const { env } = ambiente()
    assert.equal((await worker.fetch(request('/api/planos', 'POST', dados()), env)).status, 201)
    const r = await worker.fetch(request('/api/planos', 'POST', {
      ...dados(), submissaoId: crypto.randomUUID(), email: 'outra@example.com'
    }), env)
    assert.equal(r.status, 429)
    const body = await r.json()
    assert.ok(body.aguardarSegundos >= 1 && body.aguardarSegundos <= 90)
    assert.equal(r.headers.get('Retry-After'), String(body.aguardarSegundos))
    assert.equal(r.headers.get('X-Content-Type-Options'), 'nosniff')
  } finally { globalThis.fetch = antigo }
})

test('preflight autoriza DELETE e não permite origem desconhecida para eliminação', async () => {
  const { env } = ambiente()
  const r = await worker.fetch(request('/api/planos', 'OPTIONS'), env)
  assert.match(r.headers.get('Access-Control-Allow-Methods'), /DELETE/)
  assert.equal((await worker.fetch(request(`/api/planos/${crypto.randomUUID()}`, 'DELETE', null,
    'https://site-externo.example', 'a'.repeat(48)), env)).status, 403)
})

test('recusa identificadores que não sejam UUID versão 4', async () => {
  const { env } = ambiente()
  const invalido = '11111111-1111-1111-1111-111111111111'
  assert.equal((await worker.fetch(request(`/api/planos/${invalido}`, 'GET'), env)).status, 404)
  assert.equal((await worker.fetch(request(`/api/planos/${invalido}`, 'DELETE'), env)).status, 404)
})
