export class FalhaEmail extends Error {
  constructor(mensagem, incerta = true, transitória = false) {
    super(mensagem)
    this.incerta = incerta
    this.transitoria = transitória
  }
}

export function fornecedor(env) { return String(env.EMAIL_PROVIDER || 'emailjs').toLowerCase() }

export function envioConfigurado(env) {
  if (fornecedor(env) === 'resend') {
    const from = String(env.RESEND_FROM || '')
    const email = '[^\\s@<>]+@[^\\s@<>]+\\.[^\\s@<>]+'
    return Boolean(env.RESEND_API_KEY && (new RegExp('^'+email+'$').test(from) ||
      new RegExp('^[^<>\\r\\n]{1,80}\\s<'+email+'>$').test(from)))
  }
  if (fornecedor(env) === 'emailjs') return Boolean(env.EMAILJS_SERVICE_ID && env.EMAILJS_PUBLIC_KEY && env.EMAILJS_TEMPLATE_CONFIRM && env.EMAILJS_TEMPLATE_PLAN)
  return false
}

export function recuperarConfigurado(env) {
  return fornecedor(env) === 'resend' ? envioConfigurado(env) : Boolean(env.EMAILJS_TEMPLATE_RECOVERY && envioConfigurado(env))
}

const escapar = valor => String(valor ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))
export function mensagemHTML(tipo, job, dados = {}) {
  const nome = escapar(job.pedido.nome || 'Jovem')
  const id = escapar(job.id)
  const inicio = `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;line-height:1.6;color:#20322d"><h1>RumoCerto MZ</h1>`
  const fim = `<hr><small>Pedido ${id}. Se não fez este pedido, ignore esta mensagem. Não responda com dados pessoais.</small></div>`
  if (tipo === 'recuperacao') return `${inicio}<h2>Recuperação de acesso</h2><p>Olá, ${nome}. Para recuperar o acesso ao seu pedido, introduza este código no RumoCerto:</p><p style="font-size:27px;letter-spacing:4px"><strong>${escapar(dados.codigo)}</strong></p><p>O código expira em 10 minutos. Se não o pediu, ignore este e-mail.</p>${fim}`
  if (tipo === 'confirmacao') return `${inicio}<h2>Confirme o endereço de e-mail</h2><p>Olá, ${nome}. Recebemos um pedido para criar um plano sobre <strong>${escapar(job.pedido.area)}</strong>.</p><p>Introduza este código na aplicação para autorizar o segundo e-mail:</p><p style="font-size:27px;letter-spacing:4px"><strong>${escapar(dados.codigo)}</strong></p><p>Válido durante 24 horas. Sem confirmação, não será enviado o plano.</p>${fim}`
  return `${inicio}<h2>O seu plano está disponível</h2><p>Olá, ${nome}. O plano sobre ${escapar(job.pedido.area)} já pode ser descarregado.</p><p><a href="${escapar(dados.link_pdf)}">Descarregar o PDF privado</a></p><p>O acesso tem validade limitada. Não partilhe esta ligação.</p>${fim}`
}

export async function enviarEmail(env, tipo, job, dados = {}) {
  const controlador = new AbortController()
  const timeout = setTimeout(() => controlador.abort(), 12000)
  const fase = tipo === 'recuperacao' ? 'recuperacao' : tipo
  try {
    if (fornecedor(env) === 'resend') {
      if (!envioConfigurado(env)) throw new FalhaEmail('Fornecedor não configurado.', false)
      const subject = tipo === 'recuperacao' ? 'Recuperar acesso — RumoCerto MZ' : tipo === 'confirmacao' ? 'Confirme o seu pedido — RumoCerto MZ' : 'O seu plano está pronto — RumoCerto MZ'
      const chave = `rumocerto/${job.id}/${fase}${fase === 'recuperacao' ? '/' + dados.versao : ''}`
      const resp = await fetch('https://api.resend.com/emails', {
        method: 'POST', signal: controlador.signal,
        headers: {Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': chave},
        body: JSON.stringify({from: env.RESEND_FROM, to: [job.email], subject,
          html: mensagemHTML(tipo, job, dados), tags: [{name:'pedido',value:job.id}, {name:'fase',value:fase}]})
      })
      if (!resp.ok) throw new FalhaEmail(`Resend recusou o pedido (${resp.status}).`,
        [408,429].includes(resp.status) || resp.status >= 500,
        [408,429].includes(resp.status) || resp.status >= 500)
      const resposta = await resp.json()
      if (!/^[0-9a-f-]{36}$/i.test(String(resposta.id || ''))) throw new FalhaEmail('Resposta sem identificador de e-mail.', true, true)
      return { id: resposta.id, fornecedor: 'resend' }
    }
    if (!envioConfigurado(env)) throw new FalhaEmail('Fornecedor não configurado.', false)
    const template = tipo === 'confirmacao' ? env.EMAILJS_TEMPLATE_CONFIRM : tipo === 'recuperacao' ? env.EMAILJS_TEMPLATE_RECOVERY : env.EMAILJS_TEMPLATE_PLAN
    if (!template) throw new FalhaEmail('Modelo de e-mail não configurado.', false)
    const parametros = {
      to_email: job.email, nome: escapar(job.pedido.nome || 'Jovem'), pedido_id: job.id,
      area: escapar(job.pedido.area), situacao: escapar(job.pedido.situacao),
      objetivo: escapar(job.pedido.objetivo), disponibilidade: escapar(job.pedido.disponibilidade),
      internet: escapar(job.pedido.internet), usar_ia: job.pedido.usarIA ? 'Sim' : 'Não',
      notas: escapar(job.pedido.dificuldade || 'Não indicado'),
      titulo_plano: escapar(job.plano.titulo), resumo_plano: escapar(job.plano.diagnostico),
      metodo: escapar(job.plano.metodo), passos: escapar(job.plano.semanas[0].tarefas.slice(0,3).join('\n')),
      prazo: tipo === 'confirmacao' ? 'Confirmar em 24 horas' : 'Até 7 dias',
      codigo: dados.codigo || '', codigo_recuperacao: tipo === 'recuperacao' ? dados.codigo : '',
      link_pdf: dados.link_pdf || ''
    }
    const body = {service_id:env.EMAILJS_SERVICE_ID,template_id:template,user_id:env.EMAILJS_PUBLIC_KEY,template_params:parametros}
    if (env.EMAILJS_PRIVATE_KEY) body.accessToken = env.EMAILJS_PRIVATE_KEY
    const resp = await fetch('https://api.emailjs.com/api/v1.0/email/send', {method:'POST',signal:controlador.signal,
      headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
    if (!resp.ok) throw new FalhaEmail(`EmailJS recusou o pedido (${resp.status}).`, [408,429].includes(resp.status)||resp.status >= 500)
    return { id: null, fornecedor: 'emailjs' }
  } catch (e) {
    if (e instanceof FalhaEmail) throw e
    throw new FalhaEmail('Resposta do fornecedor não confirmada.', true, fornecedor(env) === 'resend')
  } finally { clearTimeout(timeout) }
}

function descodificarBase64(valor) {
  const texto = valor.replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(texto), c => c.charCodeAt(0))
}
function igualConstante(a, b) {
  if (a.length !== b.length) return false
  let diferente = 0
  for (let i=0;i<a.length;i++) diferente |= a[i]^b[i]
  return diferente === 0
}
export async function verificarWebhookResend(request, segredo, agora = Date.now()) {
  if (!segredo?.startsWith('whsec_')) return null
  const id = request.headers.get('svix-id') || ''
  const ts = request.headers.get('svix-timestamp') || ''
  const assinaturas = request.headers.get('svix-signature') || ''
  if (!/^msg_[\w-]{8,}$/.test(id) || !/^\d{10}$/.test(ts) || Math.abs(Math.floor(agora/1000)-Number(ts)) > 300) return null
  const raw = await request.text()
  if (raw.length > 20000) return null
  const chave = await crypto.subtle.importKey('raw', descodificarBase64(segredo.slice(6)),{name:'HMAC',hash:'SHA-256'},false,['sign'])
  const assinatura = new Uint8Array(await crypto.subtle.sign('HMAC',chave,new TextEncoder().encode(`${id}.${ts}.${raw}`)))
  let valido = false
  for (const parte of assinaturas.split(' ')) {
    if (!parte.startsWith('v1,')) continue
    try { valido ||= igualConstante(assinatura,descodificarBase64(parte.slice(3))) } catch {}
  }
  if (!valido) return null
  try { return {id,evento:JSON.parse(raw)} } catch { return null }
}
