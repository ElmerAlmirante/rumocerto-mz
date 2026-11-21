const servidor = String(process.env.RUMOCERTO_WORKER_URL || process.env.VITE_WORKER_URL || '').trim().replace(/\/$/, '')
const origem = String(process.env.RUMOCERTO_ALLOWED_ORIGIN || 'https://k6n9.github.io').trim()
const estrito = process.env.RUMOCERTO_PUBLICACAO_ESTRITA === 'true'
const siteKey = String(process.env.VITE_TURNSTILE_SITE_KEY || '').trim()
const validUrl = valor => { try { const u = new URL(valor); return u.protocol === 'https:' && !u.username && !u.password && !u.search && !u.hash && (u.pathname === '/' || u.pathname === '') } catch { return false } }

if (!validUrl(servidor)) {
  console.error('Configure VITE_WORKER_URL com um domínio HTTPS válido do Worker, sem caminhos adicionais.');
  process.exit(2)
}
try {
  const r = await fetch(`${servidor}/api/saude`, { headers: { Origin: origem }, signal: AbortSignal.timeout(12000) })
  const dados = await r.json()
  if (!r.ok || dados.versao !== '3.8' || dados.ok !== true) {
    throw new Error(`Versão do Worker incompatível, saúde inválida ou erro HTTP ${r.status}. É necessário publicar primeiro o Worker 3.8.`)
  }
  if (r.headers.get('Access-Control-Allow-Origin') !== origem) throw new Error('CORS não autoriza a origem pública configurada')
  const verificar = (condicao, aviso) => {
    if (condicao) return
    if (estrito) throw new Error(aviso)
    console.warn(`AVISO: ${aviso}`)
  }
  verificar(dados.envioDisponivel === true, 'Serviço de e-mail indisponível; configure o fornecedor e os segredos no Worker.')
  verificar(dados.recuperacaoDisponivel === true, 'Recuperação de acesso não configurada no Worker.')
  verificar(dados.verificacaoNecessaria === true, 'A confirmação obrigatória do endereço de e-mail está desactivada.')
  verificar(dados.turnstileNecessario === true, 'Turnstile não está activo no Worker; para publicação pública, configure TURNSTILE_SECRET.')
  verificar(dados.turnstileNecessario !== true || siteKey.length > 0,
    'O Worker exige Turnstile mas a variável pública VITE_TURNSTILE_SITE_KEY não foi configurada no GitHub.')
  verificar(dados.turnstileNecessario === true || siteKey.length === 0,
    'Há chave pública Turnstile no site mas o Worker não confirma desafios; reveja as duas configurações.')
  if (!dados.entregaVerificavel) console.warn('AVISO: o fornecedor não confirma entrega por webhook. Para rastrear entregas, configurar Resend com webhook assinado.')
  console.log(`Worker ${dados.versao} disponível. CORS autorizado. Fornecedor: ${dados.fornecedor || 'não informado'}.`)
  const negar = await fetch(`${servidor}/api/saude`, { headers: { Origin: 'https://origem-nao-autorizada.invalid' }, signal: AbortSignal.timeout(12000) })
  if (negar.status !== 403) throw new Error(`CORS não bloqueou origem externa: HTTP ${negar.status}`)
  console.log('Bloqueio de origem externa: OK. Este teste não enviou e-mails.')
} catch (e) {
  console.error('Falha na validação de publicação:', e.message)
  process.exitCode = 1
}
