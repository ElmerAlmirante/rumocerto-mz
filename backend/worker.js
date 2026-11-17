import { gerarPlano, validarPerfil, limparTexto } from '../shared/planner.js'
import { gerarPdf, gerarPdfUnicode } from '../shared/pdf.js'
import { VERSAO_PROTOCOLO } from '../shared/versao.js'

const RETENCAO_MS = 7 * 24 * 60 * 60 * 1000
const ESPERA_MS = 5 * 60 * 1000
const LIMITE_MS = 90 * 1000
const ORIGEM_LOCAL = 'http://localhost:5173,http://localhost:4173'
const PRAZO_ESTADO_MS = 75 * 1000
const SUBMISSAO_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function responder(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: {
    'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer', ...headers
  } })
}
function erro(mensagem, status = 400, headers = {}) { return responder({ erro: mensagem }, status, headers) }
function origemPermitida(request, env) {
  const origem = request.headers.get('Origin') || ''
  const permitidas = String(env.ALLOWED_ORIGINS || ORIGEM_LOCAL).split(',').map(s => s.trim())
  return origem && permitidas.includes(origem) ? {
    'Access-Control-Allow-Origin': origem,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Vary': 'Origin'
  } : {}
}
async function digest(valor) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(valor))
  return [...new Uint8Array(bytes)].map(n => n.toString(16).padStart(2, '0')).join('')
}
function configuracaoEnvio(env) {
  if (!env?.PLANOS || !env?.LIMITES || !env.EMAILJS_SERVICE_ID || !env.EMAILJS_PUBLIC_KEY ||
    !env.EMAILJS_TEMPLATE_CONFIRM || !env.EMAILJS_TEMPLATE_PLAN ||
    String(env.DOWNLOAD_SECRET || '').length < 24 || String(env.RATE_SALT || '').length < 16) return false
  try {
    const url = new URL(String(env.PUBLIC_WORKER_URL || ''))
    return (url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) &&
      !url.username && !url.password && !url.search && !url.hash
  } catch { return false }
}
async function gerarToken(env, id, email) {
  const chave = await crypto.subtle.importKey('raw', new TextEncoder().encode(String(env.DOWNLOAD_SECRET)),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const assinatura = await crypto.subtle.sign('HMAC', chave,
    new TextEncoder().encode(`rumocerto:estado:${id}:${email.toLowerCase()}`))
  return [...new Uint8Array(assinatura)].slice(0, 24).map(n => n.toString(16).padStart(2, '0')).join('')
}
class FalhaEmail extends Error {
  constructor(mensagem, incerta = true) { super(mensagem); this.incerta = incerta }
}
async function assinatura(env, id) {
  if (!env.DOWNLOAD_SECRET || String(env.DOWNLOAD_SECRET).length < 24) throw new Error('Configuração incompleta')
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.DOWNLOAD_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`rumocerto:pdf:${id}`))
  return [...new Uint8Array(sig)].map(v => v.toString(16).padStart(2, '0')).join('')
}
async function ligacaoPdf(env, id) {
  const raiz = new URL(String(env.PUBLIC_WORKER_URL || ''))
  if (raiz.protocol !== 'https:' && !(raiz.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(raiz.hostname))) throw new Error('Endereço público inválido')
  if (raiz.username || raiz.password || raiz.search || raiz.hash) throw new Error('Endereço público inválido')
  const url = new URL(`/api/planos/${id}/pdf`, raiz)
  url.searchParams.set('assinatura', await assinatura(env, id))
  return url.toString()
}
function estadoPublico(job) {
  const estado = job.estado === 'enviando' && Date.now() - job.agendadoPara > 10 * 60 * 1000 ? 'incerto' : job.estado
  return { id: job.id, estado, agendadoPara: new Date(job.agendadoPara).toISOString(),
    enviadoEm: job.enviadoEm || null, metodo: job.plano.metodo,
    faseIncerta: estado === 'incerto' ? (job.faseIncerta || 'entrega') : null }
}
async function emailJS(env, template, parametros) {
  if (!env.EMAILJS_SERVICE_ID || !env.EMAILJS_PUBLIC_KEY || !template) throw new FalhaEmail('E-mail indisponível', false)
  const corpo = { service_id: env.EMAILJS_SERVICE_ID, template_id: template,
    user_id: env.EMAILJS_PUBLIC_KEY, template_params: parametros }
  if (env.EMAILJS_PRIVATE_KEY) corpo.accessToken = env.EMAILJS_PRIVATE_KEY
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12000)
  try {
    const resposta = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST', signal: controller.signal,
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo)
    })
    if (!resposta.ok) throw new FalhaEmail(`Envio recusado (${resposta.status})`,
      resposta.status >= 500 || resposta.status === 429 || resposta.status === 408)
  } catch (e) {
    if (e instanceof FalhaEmail) throw e
    throw new FalhaEmail('Não foi possível confirmar o resultado do serviço de e-mail.', true)
  } finally { clearTimeout(timeout) }
}

function parametrosConfirmacao(job) {
  return {
    to_email: job.email, nome: job.pedido.nome || 'Jovem', area: job.pedido.area,
    situacao: job.pedido.situacao, objetivo: job.pedido.objetivo,
    disponibilidade: job.pedido.disponibilidade, internet: job.pedido.internet,
    usar_ia: job.pedido.usarIA ? 'Sim' : 'Não',
    passos: job.plano.semanas[0].tarefas.slice(0, 3).join('\n'),
    notas: job.pedido.dificuldade || 'Não indicado',
    subject: 'Confirmação do pedido — RumoCerto MZ', prazo: 'Cerca de 5 a 7 minutos'
  }
}
async function gerarOpcional(p, env) {
  const base = gerarPlano(p)
  if (!p.usarIA || !env.GEMINI_API_KEY) return base
  try {
    const instrucao = `Produz apenas JSON válido com chaves diagnostico e estrategia (textos curtos). És um orientador educativo moçambicano. Não inventes vagas, cursos pagos, estatísticas ou garantias de contratação. Área: ${limparTexto(p.area, 80)}. Objectivo: ${limparTexto(p.objetivo, 450)}. Situação: ${limparTexto(p.situacao, 80)}. Dificuldade: ${limparTexto(p.dificuldade, 200)}.`
    const modelo = /^[a-z0-9.-]+$/.test(String(env.GEMINI_MODEL || '')) ? String(env.GEMINI_MODEL) : 'gemini-3.5-flash-lite'
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 9000)
    let response
    try {
      response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`, {
        method: 'POST', signal: controller.signal,
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
        body: JSON.stringify({ contents: [{ parts: [{ text: instrucao }] }],
          generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 600 } })
      })
    } finally { clearTimeout(timeout) }
    if (!response.ok) return base
    const dados = await response.json()
    const conteudo = JSON.parse(dados.candidates?.[0]?.content?.parts?.[0]?.text || '{}')
    if (typeof conteudo.diagnostico !== 'string' || typeof conteudo.estrategia !== 'string') return base
    return { ...base, diagnostico: limparTexto(conteudo.diagnostico, 600),
      estrategia: limparTexto(conteudo.estrategia, 600), metodo: 'Plano com personalização opcional' }
  } catch { return base }
}

export class LimiteEnvios {
  constructor(state) { this.state = state }
  async fetch(request) {
    const url = new URL(request.url)
    if (request.method !== 'POST' || !['/reservar', '/libertar'].includes(url.pathname)) return erro('Rota inválida', 404)
    let dados
    try { dados = await request.json() } catch { return erro('Reserva inválida', 400) }
    if (!SUBMISSAO_RE.test(String(dados?.reserva || ''))) return erro('Reserva inválida', 422)
    return this.state.blockConcurrencyWhile(async () => {
      const agora = Date.now()
      const dono = await this.state.storage.get('reserva')
      if (url.pathname === '/libertar') {
        if (dono === dados.reserva) {
          await this.state.storage.deleteAll()
          return responder({ libertado: true })
        }
        return responder({ libertado: false })
      }
      const bloqueadoAte = Number(await this.state.storage.get('ate') || 0)
      if (bloqueadoAte > agora) return erro('Aguarda 90 segundos antes de enviar outro pedido.', 429)
      await this.state.storage.put('ate', agora + LIMITE_MS)
      await this.state.storage.put('reserva', dados.reserva)
      await this.state.storage.setAlarm(agora + LIMITE_MS)
      return responder({ ok: true })
    })
  }
  async alarm() {
    const ate = Number(await this.state.storage.get('ate') || 0)
    if (ate > Date.now()) await this.state.storage.setAlarm(ate)
    else await this.state.storage.deleteAll()
  }
}

export class PlanoJob {
  constructor(state, env) { this.state = state; this.env = env }
  async guardar(job) {
    return this.state.blockConcurrencyWhile(async () => {
      if (await this.state.storage.get('job')) return erro('Pedido já existente.', 409)
      await this.state.storage.put('job', job)
      await this.state.storage.setAlarm(Math.min(job.expiraEm, Date.now() + PRAZO_ESTADO_MS))
      return responder({ ok: true }, 201)
    })
  }
  async confirmar() {
    const reserva = await this.state.blockConcurrencyWhile(async () => {
      const job = await this.state.storage.get('job')
      if (!job || job.estado !== 'por_confirmar') return null
      job.estado = 'a_confirmar'
      job.confirmacaoIniciada = Date.now()
      await this.state.storage.put('job', job)
      await this.state.storage.setAlarm(Math.min(job.expiraEm, Date.now() + PRAZO_ESTADO_MS))
      return job
    })
    if (!reserva) return erro('Pedido indisponível.', 409)
    let aceite = false
    let falha = null
    try { await emailJS(this.env, this.env.EMAILJS_TEMPLATE_CONFIRM, parametrosConfirmacao(reserva)); aceite = true }
    catch (e) { falha = e }
    await this.state.blockConcurrencyWhile(async () => {
      const job = await this.state.storage.get('job')
      if (!job || job.estado !== 'a_confirmar') return
      job.estado = aceite ? 'pendente' : falha?.incerta ? 'incerto' : 'falhou'
      job.faseIncerta = aceite ? null : 'confirmacao'
      await this.state.storage.put('job', job)
      await this.state.storage.setAlarm(aceite ? job.agendadoPara : job.expiraEm)
    })
    return aceite ? responder({ ok: true }) :
      erro(falha?.incerta ? 'Não foi possível confirmar o envio inicial. Verifique a caixa de entrada antes de repetir o pedido.' :
        'O serviço de e-mail recusou a confirmação.', falha?.incerta ? 503 : 502)
  }
  async fetch(request) {
    const url = new URL(request.url)
    if (url.pathname === '/guardar' && request.method === 'POST') return this.guardar(await request.json())
    if (url.pathname === '/confirmar' && request.method === 'POST') return this.confirmar()
    if (url.pathname === '/repetir' && request.method === 'POST') {
      const dados = await request.json()
      const job = await this.state.storage.get('job')
      if (!job) return erro('Pedido inexistente.', 404)
      if (job.impressao !== dados.impressao) return erro('Identificador já utilizado por outro pedido.', 409)
      if (job.expiraEm <= Date.now()) return erro('Pedido expirado.', 410)
      return responder({ existente: true, ...estadoPublico(job), plano: job.plano }, job.estado === 'a_confirmar' || job.estado === 'por_confirmar' ? 202 : 200)
    }
    if (url.pathname === '/estado' && request.method === 'GET') {
      const segredo = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') || ''
      if (!/^[0-9a-f]{48}$/.test(segredo)) return erro('Acesso não autorizado.', 401)
      const job = await this.state.storage.get('job')
      if (!job || job.expiraEm < Date.now()) return erro('Pedido expirado.', 404)
      if (await digest(segredo) !== job.hash) return erro('Acesso não autorizado.', 401)
      return responder(estadoPublico(job))
    }
    if (url.pathname === '/pdf' && request.method === 'GET') {
      const sig = url.searchParams.get('assinatura') || ''
      const job = await this.state.storage.get('job')
      if (!job || job.expiraEm < Date.now()) return erro('Documento expirado.', 404)
      if (!/^[0-9a-f]{64}$/.test(sig) || sig !== await assinatura(this.env, job.id)) return erro('Acesso não autorizado.', 401)
      let pdf, modoPdf = 'unicode'
      try { pdf = await gerarPdfUnicode(job.pedido, job.plano) }
      catch { pdf = gerarPdf(job.pedido, job.plano); modoPdf = 'compatibilidade' }
      return new Response(pdf, { headers: {
        'X-RumoCerto-PDF': modoPdf,
        'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="RumoCerto_MZ_Plano_30_Dias.pdf"',
        'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer',
        'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex, nofollow'
      } })
    }
    return erro('Rota inválida.', 404)
  }
  async alarm() {
    const job = await this.state.blockConcurrencyWhile(async () => {
      const actual = await this.state.storage.get('job')
      if (!actual) return null
      const agora = Date.now()
      if (agora >= actual.expiraEm) { await this.state.storage.deleteAll(); return null }
      if (actual.estado === 'por_confirmar') return { confirmar: true }
      if (['a_confirmar', 'enviando'].includes(actual.estado)) {
        const inicio = actual.estado === 'a_confirmar' ? actual.confirmacaoIniciada : actual.envioIniciado
        if (agora - Number(inicio || 0) >= PRAZO_ESTADO_MS) {
          actual.estado = 'incerto'
          actual.faseIncerta = actual.faseIncerta || (inicio === actual.confirmacaoIniciada ? 'confirmacao' : 'entrega')
          await this.state.storage.put('job', actual)
        }
        await this.state.storage.setAlarm(actual.estado === 'incerto' ? actual.expiraEm : Math.min(actual.expiraEm, agora + PRAZO_ESTADO_MS))
        return null
      }
      if (actual.estado !== 'pendente') { await this.state.storage.setAlarm(actual.expiraEm); return null }
      if (agora < actual.agendadoPara) { await this.state.storage.setAlarm(actual.agendadoPara); return null }
      actual.estado = 'enviando'
      actual.envioIniciado = agora
      await this.state.storage.put('job', actual)
      await this.state.storage.setAlarm(Math.min(actual.expiraEm, agora + PRAZO_ESTADO_MS))
      return actual
    })
    if (!job) return
    if (job.confirmar) { await this.confirmar(); return }
    let aceite = false
    let falha = null
    try {
      await emailJS(this.env, this.env.EMAILJS_TEMPLATE_PLAN, {
        to_email: job.email, nome: job.pedido.nome || 'Jovem',
        titulo_plano: job.plano.titulo, resumo_plano: job.plano.diagnostico,
        metodo: job.plano.metodo, link_pdf: await ligacaoPdf(this.env, job.id),
        area: job.pedido.area, situacao: job.pedido.situacao, objetivo: job.pedido.objetivo,
        disponibilidade: job.pedido.disponibilidade, internet: job.pedido.internet,
        prazo: new Date(job.agendadoPara).toISOString()
      })
      aceite = true
    } catch (e) { falha = e }
    await this.state.blockConcurrencyWhile(async () => {
      const actual = await this.state.storage.get('job')
      if (!actual || (actual.estado !== 'enviando' && actual.estado !== 'incerto') || actual.envioIniciado !== job.envioIniciado) return
      actual.estado = aceite ? 'enviado' : falha?.incerta ? 'incerto' : 'falhou'
      actual.faseIncerta = aceite ? null : 'entrega'
      if (aceite) actual.enviadoEm = new Date().toISOString()
      await this.state.storage.put('job', actual)
      await this.state.storage.setAlarm(actual.expiraEm)
    })
  }
}

async function criarPedido(request, env, headers) {
  if (!configuracaoEnvio(env)) return erro('O envio ainda não está configurado.', 503, headers)
  let dados
  try {
    const texto = await request.text()
    if (texto.length > 8000) return erro('Pedido demasiado grande.', 413, headers)
    dados = JSON.parse(texto)
  } catch { return erro('Pedido inválido.', 400, headers) }
  const erros = validarPerfil(dados, { exigirEmail: true })
  if (Object.keys(erros).length) return responder({ erro: 'Verifique os campos do formulário.', erros }, 422, headers)
  if (!SUBMISSAO_RE.test(String(dados.submissaoId || ''))) return erro('Identificador do pedido inválido.', 422, headers)
  const pedido = {
    nome: limparTexto(dados.nome, 90), area: dados.area, situacao: dados.situacao,
    objetivo: limparTexto(dados.objetivo, 450), disponibilidade: dados.disponibilidade,
    internet: dados.internet, competencias: limparTexto(dados.competencias, 300),
    dificuldade: limparTexto(dados.dificuldade, 450), usarIA: dados.usarIA === true
  }
  const id = dados.submissaoId.toLowerCase()
  const email = String(dados.email).trim().toLowerCase()
  const impressao = await digest(JSON.stringify({ ...pedido, email }))
  const objecto = env.PLANOS.get(env.PLANOS.idFromName(id))
  const repetido = await objecto.fetch('https://interno/repetir', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ impressao })
  })
  if (repetido.status !== 404) {
    const anterior = await repetido.json()
    if (!repetido.ok) return responder(anterior, repetido.status, headers)
    return responder({ ...anterior, token: await gerarToken(env, id, email), recuperado: true }, repetido.status, headers)
  }
  const ip = request.headers.get('CF-Connecting-IP') || 'sem-ip'
  const reservas = []
  async function libertarReservas() {
    await Promise.allSettled(reservas.map(gate => gate.fetch('https://interno/libertar', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reserva: id })
    })))
  }
  try {
    for (const chave of [`email:${email}`, `ip:${ip.toLowerCase()}`]) {
      const grupo = await digest(`${String(env.RATE_SALT)}:${chave}`)
      const gate = env.LIMITES.get(env.LIMITES.idFromName(grupo))
      const reservado = await gate.fetch('https://interno/reservar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reserva: id })
      })
      if (!reservado.ok) {
        await libertarReservas()
        return erro('Aguarda 90 segundos antes de enviar outro pedido.', reservado.status, headers)
      }
      reservas.push(gate)
    }
  } catch {
    await libertarReservas()
    return erro('Não foi possível verificar o limite de envios. Tenta novamente.', 503, headers)
  }
  const plano = await gerarOpcional(pedido, env)
  const token = await gerarToken(env, id, email)
  const agora = Date.now()
  const job = { id, impressao, hash: await digest(token), email, pedido, plano,
    estado: 'por_confirmar', criadoEm: new Date(agora).toISOString(),
    agendadoPara: agora + ESPERA_MS, expiraEm: agora + RETENCAO_MS, enviadoEm: null }
  const persistido = await objecto.fetch('https://interno/guardar', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(job)
  })
  if (persistido.status === 409) {
    const anterior = await objecto.fetch('https://interno/repetir', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ impressao })
    })
    const resposta = await anterior.json()
    if (!anterior.ok) { await libertarReservas(); return responder(resposta, anterior.status, headers) }
    await libertarReservas()
    return responder({ ...resposta, token, recuperado: true }, anterior.status, headers)
  }
  if (!persistido.ok) {
    await libertarReservas()
    return erro('Não foi possível guardar o pedido.', 503, headers)
  }
  const confirmado = await objecto.fetch('https://interno/confirmar', { method: 'POST' })
  if (!confirmado.ok) {
    const recuperado = await objecto.fetch('https://interno/repetir', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ impressao })
    })
    if (recuperado.ok) {
      const anterior = await recuperado.json()
      return responder({ ...anterior, token, recuperado: true,
        mensagem: 'Não foi possível confirmar o processamento da mensagem. Consulte o estado do pedido antes de tentar novamente.' }, 202, headers)
    }
    return erro('Não foi possível confirmar o envio. Verifique a caixa de entrada antes de repetir o pedido.', confirmado.status, headers)
  }
  return responder({ ...estadoPublico({ ...job, estado: 'pendente' }), token, plano,
    mensagem: 'Confirmação aceite pelo serviço de e-mail.' }, 201, headers)
}

export default {
  async fetch(request, env) {
    const headers = origemPermitida(request, env)
    const origin = request.headers.get('Origin')
    if (origin && !headers['Access-Control-Allow-Origin']) return erro('Origem não autorizada.', 403)
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
    const url = new URL(request.url)
    try {
      if (url.pathname === '/api/saude' && request.method === 'GET') return responder({ ok: true,
        aplicacao: 'RumoCerto MZ', versao: VERSAO_PROTOCOLO,
        envioDisponivel: configuracaoEnvio(env) }, 200, headers)
      if (url.pathname === '/api/planos' && request.method === 'POST') return criarPedido(request, env, headers)
      const match = url.pathname.match(/^\/api\/planos\/([0-9a-f-]{36})(\/pdf)?$/)
      if (match && request.method === 'GET') {
        if (!env.PLANOS) return erro('Serviço indisponível.', 503, headers)
        const objecto = env.PLANOS.get(env.PLANOS.idFromName(match[1]))
        const interno = new URL(match[2] ? 'https://interno/pdf' : 'https://interno/estado')
        if (match[2]) interno.searchParams.set('assinatura', url.searchParams.get('assinatura') || '')
        const upstream = await objecto.fetch(interno, { headers: { Authorization: request.headers.get('Authorization') || '' } })
        const resposta = new Response(upstream.body, upstream)
        for (const [k, v] of Object.entries(headers)) resposta.headers.set(k, v)
        return resposta
      }
      return erro('Rota inexistente.', 404, headers)
    } catch { return erro('Serviço temporariamente indisponível.', 503, headers) }
  }
}

export const teste = { criarPedido, assinatura, ligacaoPdf, gerarOpcional, estadoPublico, configuracaoEnvio, gerarToken }
