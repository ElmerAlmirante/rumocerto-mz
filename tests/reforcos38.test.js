import test from 'node:test'
import assert from 'node:assert/strict'
import worker, {PlanoJob,LimiteEnvios,teste as interno} from '../backend/worker.js'
import { integrarSugestoesIA } from '../shared/personalizacao.js'
import { gerarPlano, AREAS, SITUACOES, DISPONIBILIDADES, INTERNET } from '../shared/planner.js'
import { gerarPdfUnicode } from '../shared/pdf.js'
import {verificarWebhookResend,mensagemHTML} from '../backend/email.js'

const perfil=()=>({submissaoId:crypto.randomUUID(),nome:'Ana',area:AREAS[0],situacao:SITUACOES[0],
  objetivo:'Construir um portefólio profissional com Vue e aplicações práticas',
  disponibilidade:DISPONIBILIDADES[1],internet:INTERNET[0],competencias:'JavaScript básico',
  dificuldade:'Internet lenta',usarIA:false,consentimento:true,email:'ana@exemplo.org',website:''})
function estadoSimulado() {
  const dados=new Map();let alarme=null;let serie=Promise.resolve()
  return {storage:{get:async k=>structuredClone(dados.get(k)),put:async(k,v)=>dados.set(k,structuredClone(v)),
    deleteAll:async()=>dados.clear(),setAlarm:async v=>{alarme=v}, getAlarm:async()=>alarme},
    blockConcurrencyWhile:fn=>{const x=serie.then(fn);serie=x.catch(()=>{});return x}}
}
function ambiente(opcoes={}) {
  const env={ALLOWED_ORIGINS:'https://k6n9.github.io',PUBLIC_WORKER_URL:'https://rumo.exemplo.org',
    EMAILJS_SERVICE_ID:'serv',EMAILJS_PUBLIC_KEY:'pub',EMAILJS_TEMPLATE_CONFIRM:'confirm',
    EMAILJS_TEMPLATE_PLAN:'plan',EMAILJS_TEMPLATE_RECOVERY:'recover',
    DOWNLOAD_SECRET:'RumoCerto-testes-chave-secreta-2026-mais-seguro',RATE_SALT:'rumocerto-salt-testes-maior-que-24',
    REQUIRE_EMAIL_VERIFICATION:'true',...opcoes}
  const planos=new Map(),limites=new Map()
  env.PLANOS={idFromName:x=>x,get(id){
    if(!planos.has(id)){
      const state=estadoSimulado(),obj=new PlanoJob(state,env)
      planos.set(id,{state,obj,fetch:(u,init)=>obj.fetch(new Request(u,init))})
    }
    return planos.get(id)
  }}
  env.LIMITES={idFromName:x=>x,get(id){
    if(!limites.has(id)){
      const obj=new LimiteEnvios(estadoSimulado())
      limites.set(id,{fetch:(u,init)=>obj.fetch(new Request(u,init))})
    }
    return limites.get(id)
  }}
  return {env,planos,limites}
}
function pedido(url,method='GET',body,token='',ip='10.0.0.1') {
  return new Request('https://rumo.exemplo.org'+url,{method,
    headers:{Origin:'https://k6n9.github.io','Content-Type':'application/json',
      'CF-Connecting-IP':ip,...(token?{Authorization:'Bearer '+token}:{})},
    ...(body!==undefined?{body:JSON.stringify(body)}:{})})
}
function mockEmailJS(mensagens=[]) {
  return async (url,opcoes)=>{
    if(!String(url).includes('emailjs')) throw new Error('URL inesperada: '+url)
    mensagens.push(JSON.parse(opcoes.body))
    return new Response('OK',{status:200})
  }
}

test('verificação do destinatário impede segundo envio sem código correcto',async()=>{
  const fetchAnterior=globalThis.fetch;const mensagens=[];globalThis.fetch=mockEmailJS(mensagens)
  try {
    const {env,planos}=ambiente();const p=perfil()
    const resposta=await worker.fetch(pedido('/api/planos','POST',p),env)
    assert.equal(resposta.status,201)
    const criado=await resposta.json()
    assert.equal(criado.estado,'aguarda_verificacao')
    assert.equal(mensagens.length,1)
    const codigo=mensagens[0].template_params.codigo
    assert.match(codigo,/^\d{6}$/)
    const chave=`/api/planos/${criado.id}`
    await planos.get(criado.id).obj.alarm()
    assert.equal(mensagens.length,1,'não envia plano antes de confirmação')
    const negado=await worker.fetch(pedido(chave+'/verificar','POST',{codigo:'abcdef'},criado.token),env)
    assert.equal(negado.status,422)
    const errado=await worker.fetch(pedido(chave+'/verificar','POST',{codigo:codigo==='123456'?'654321':'123456'},criado.token),env)
    assert.equal(errado.status,422)
    const certo=await worker.fetch(pedido(chave+'/verificar','POST',{codigo},criado.token),env)
    assert.equal(certo.status,200)
    assert.equal((await certo.json()).estado,'pendente')
    assert.equal((await planos.get(criado.id).state.storage.get('job')).emailVerificado,true)
    const estado=await worker.fetch(pedido(chave,'GET',undefined,criado.token),env)
    assert.equal((await estado.json()).verificacaoNecessaria,false)
    const job=await planos.get(criado.id).state.storage.get('job')
    job.agendadoPara=Date.now()-1
    await planos.get(criado.id).state.storage.put('job',job)
    await planos.get(criado.id).obj.alarm()
    assert.equal(mensagens.length,2,'envia o plano apenas após confirmar o destinatário')
    assert.equal((await planos.get(criado.id).state.storage.get('job')).estado,'enviado')
  } finally {globalThis.fetch=fetchAnterior}
})

test('código de verificação bloqueia após cinco tentativas erradas',async()=>{
  const fetchAnterior=globalThis.fetch;globalThis.fetch=mockEmailJS()
  try {
    const {env}=ambiente(),p=perfil()
    const criado=await (await worker.fetch(pedido('/api/planos','POST',p),env)).json()
    for(let i=0;i<5;i++)assert.equal((await worker.fetch(pedido(`/api/planos/${criado.id}/verificar`,'POST',{codigo:'000000'},criado.token),env)).status,422)
    const certo=await interno.codigoPara(env,criado.id,'verificacao')
    assert.equal((await worker.fetch(pedido(`/api/planos/${criado.id}/verificar`,'POST',{codigo:certo},criado.token),env)).status,429)
  }finally{globalThis.fetch=fetchAnterior}
})

test('recuperação por e-mail não revela existência, usa código e permite eliminar',async()=>{
  const fetchAnterior=globalThis.fetch;const mensagens=[];globalThis.fetch=mockEmailJS(mensagens)
  try {
    const {env}=ambiente(),p=perfil()
    const criado=await (await worker.fetch(pedido('/api/planos','POST',p),env)).json()
    const caminho=`/api/planos/${criado.id}`
    const falso=await worker.fetch(pedido(caminho+'/recuperar','POST',{email:'nao@exemplo.org'}),env)
    assert.equal(falso.status,202)
    assert.equal(mensagens.length,1)
    const pedidoCodigo=await worker.fetch(pedido(caminho+'/recuperar','POST',{email:p.email}),env)
    assert.equal(pedidoCodigo.status,202)
    assert.equal(mensagens.length,2)
    const codigo=mensagens[1].template_params.codigo_recuperacao
    assert.match(codigo,/^\d{6}$/)
    assert.equal((await worker.fetch(pedido(caminho+'/recuperar/validar','POST',{email:p.email,codigo:'111111'}),env)).status,401)
    const ok=await worker.fetch(pedido(caminho+'/recuperar/validar','POST',{email:p.email,codigo}),env)
    assert.equal(ok.status,200)
    const recuperado=await ok.json()
    assert.equal(recuperado.token,criado.token)
    assert.equal((await worker.fetch(pedido(caminho,'DELETE',undefined,recuperado.token),env)).status,200)
    assert.equal((await worker.fetch(pedido(caminho,'GET',undefined,criado.token),env)).status,404)
  }finally{globalThis.fetch=fetchAnterior}
})

test('recuperação limita pedidos repetidos sem enviar spam',async()=>{
  const fetchAnterior=globalThis.fetch;const mensagens=[];globalThis.fetch=mockEmailJS(mensagens)
  try {
    const {env}=ambiente();const p=perfil()
    const criado=await (await worker.fetch(pedido('/api/planos','POST',p),env)).json()
    for(let i=0;i<5;i++)assert.equal((await worker.fetch(pedido(`/api/planos/${criado.id}/recuperar`,'POST',{email:p.email}),env)).status,202)
    assert.equal(mensagens.length,2)
  }finally{globalThis.fetch=fetchAnterior}
})

test('Turnstile é obrigatório quando o segredo está activo e valida resposta',async()=>{
  const fetchAnterior=globalThis.fetch;const mensagens=[]
  globalThis.fetch=async(url,opts)=>{
    if(String(url).includes('turnstile')){assert.equal(String(opts.body).includes('remoteip='),true);return Response.json({success:true,action:'enviar_plano'})}
    return mockEmailJS(mensagens)(url,opts)
  }
  try{
    const {env}=ambiente({TURNSTILE_SECRET:'segredo-turnstile'})
    assert.equal((await worker.fetch(pedido('/api/planos','POST',perfil()),env)).status,403)
    const p={...perfil(),turnstileToken:'token-ficticio-valido'}
    assert.equal((await worker.fetch(pedido('/api/planos','POST',p),env)).status,201)
    assert.equal(mensagens.length,1)
  }finally{globalThis.fetch=fetchAnterior}
})

test('limite diário mantém reservas mesmo quando o intervalo curto já passou',async()=>{
  const estado=estadoSimulado(),gate=new LimiteEnvios(estado),antigo=Date.now
  let agora=1763726400000
  Date.now=()=>agora
  try{
    for(let i=0;i<4;i++){
      const r=await gate.fetch(new Request('https://interno/reservar',{method:'POST',body:JSON.stringify({reserva:crypto.randomUUID(),limite:4})}))
      assert.equal(r.status,200)
      agora+=100000
    }
    const id=crypto.randomUUID()
    assert.equal((await gate.fetch(new Request('https://interno/reservar',{method:'POST',body:JSON.stringify({reserva:id,limite:4})}))).status,429)
    agora+=24*3600*1000
    assert.equal((await gate.fetch(new Request('https://interno/reservar',{method:'POST',body:JSON.stringify({reserva:id,limite:4})}))).status,200)
  }finally{Date.now=antigo}
})

test('modelo HTML escapa nomes e objectivos, sem injecção de HTML',()=>{
  const p=perfil();p.nome='<img src=x onerror=alert(1)>'
  const job={id:crypto.randomUUID(),pedido:p,plano:gerarPlano(p)}
  const html=mensagemHTML('confirmacao',job,{codigo:'123456'})
  assert.ok(!html.includes('<img src=x onerror'))
  assert.match(html,/&lt;img/)
})

function assinaturaSvix(secret,id,ts,raw) {
  return crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign'])
    .then(chave=>crypto.subtle.sign('HMAC',chave,new TextEncoder().encode(`${id}.${ts}.${raw}`)))
    .then(bytes=>btoa(String.fromCharCode(...new Uint8Array(bytes))))
}
async function webhook(evento,secret,alterar=false,tempo=Math.floor(Date.now()/1000)) {
  const id='msg_'+crypto.randomUUID().replace(/-/g,'')
  const raw=JSON.stringify(evento)
  const sig=await assinaturaSvix(secret,id,String(tempo),raw)
  return new Request('https://rumo.exemplo.org/api/webhooks/resend',{
    method:'POST',headers:{'svix-id':id,'svix-timestamp':String(tempo),'svix-signature':'v1,'+(alterar?'incorrecta':sig)},body:raw})
}

test('Resend: eventos assinados verificam entrega, falsificação é rejeitada',async()=>{
  const fetchAnterior=globalThis.fetch;const enviados=[]
  globalThis.fetch=async(url,opts)=>{
    assert.match(String(url),/api.resend.com/)
    enviados.push(JSON.parse(opts.body))
    return Response.json({id:crypto.randomUUID()})
  }
  try{
    const key='chave-teste-webhook';const secret='whsec_'+btoa(key)
    const {env,planos}=ambiente({EMAIL_PROVIDER:'resend',RESEND_API_KEY:'resend_test',
      RESEND_FROM:'RumoCerto <naoresponder@exemplo.org>',RESEND_WEBHOOK_SECRET:secret,REQUIRE_EMAIL_VERIFICATION:'false'})
    const p=perfil(),resposta=await worker.fetch(pedido('/api/planos','POST',p),env)
    assert.equal(resposta.status,201)
    const criado=await resposta.json()
    const obj=planos.get(criado.id)
    let job=await obj.state.storage.get('job')
    assert.equal(job.fornecedor,'resend')
    assert.deepEqual(enviados[0].tags,[{name:'pedido',value:criado.id},{name:'fase',value:'confirmacao'}])
    job.agendadoPara=Date.now()-1;await obj.state.storage.put('job',job)
    await obj.obj.alarm()
    job=await obj.state.storage.get('job')
    assert.equal(job.estado,'enviado')
    const evento={type:'email.delivered',data:{email_id:job.providerIdPlano,
      tags:{pedido:criado.id,fase:'entrega'}}}
    assert.equal((await worker.fetch(await webhook(evento,key,true),env)).status,401)
    assert.equal((await (await worker.fetch(pedido(`/api/planos/${criado.id}`,'GET',undefined,criado.token),env)).json()).estado,'enviado')
    const certo=await worker.fetch(await webhook(evento,key),env)
    assert.equal(certo.status,200)
    const estado=(await (await worker.fetch(pedido(`/api/planos/${criado.id}`,'GET',undefined,criado.token),env)).json())
    assert.equal(estado.estado,'entregue')
    assert.ok(estado.entregaConfirmada)
    assert.equal((await worker.fetch(await webhook(evento,key,false,Math.floor(Date.now()/1000)-600),env)).status,401)
  }finally{globalThis.fetch=fetchAnterior}
})

test('Resend: falhas transitórias são repetidas com chave idempotente',async()=>{
  const fetchAnterior=globalThis.fetch;const chamadas=[]
  globalThis.fetch=async(url,opcoes)=>{
    chamadas.push(opcoes.headers['Idempotency-Key'])
    if(chamadas.length===1)return new Response('Temporariamente indisponível',{status:503})
    return Response.json({id:crypto.randomUUID()})
  }
  try{
    const {env,planos}=ambiente({EMAIL_PROVIDER:'resend',RESEND_API_KEY:'resend_test',
      RESEND_FROM:'naoresponder@exemplo.org',REQUIRE_EMAIL_VERIFICATION:'false'})
    const p=perfil()
    const r=await worker.fetch(pedido('/api/planos','POST',p),env)
    assert.equal(r.status,202)
    const criado=await r.json()
    assert.equal((await planos.get(criado.id).state.storage.get('job')).estado,'por_confirmar')
    await planos.get(criado.id).obj.alarm()
    assert.equal((await planos.get(criado.id).state.storage.get('job')).estado,'pendente')
    assert.deepEqual(chamadas,[`rumocerto/${criado.id}/confirmacao`,`rumocerto/${criado.id}/confirmacao`])
  }finally{globalThis.fetch=fetchAnterior}
})

test('integração IA rejeita alterações incompletas e adapta 20 actividades válidas',()=>{
  const p=perfil(),base=gerarPlano(p)
  assert.equal(integrarSugestoesIA(base,{diagnostico:'Curto',estrategia:'Curto',semanas:[]}),base)
  const resposta={diagnostico:'O perfil precisa de tarefas pequenas verificáveis.',
    estrategia:'Propor actividades de baixo consumo de dados e com exemplos locais.',
    semanas:base.semanas.map(s=>({tarefas:s.tarefas.map((x,i)=>`Exercício personalizado ${s.numero}.${i}: ${x}`),
      entregavel:`Entrega personalizada da semana ${s.numero}`}))}
  const final=integrarSugestoesIA(base,resposta)
  assert.equal(final.metodo,'Plano personalizado com IA e revisão das actividades')
  assert.equal(final.semanas.flatMap(s=>s.tarefas).length,20)
  assert.ok(final.semanas[0].tarefas[0].startsWith('Exercício personalizado'))
  assert.deepEqual(final.semanas.map(s=>s.minutosPorTarefa),base.semanas.map(s=>s.minutosPorTarefa))
})

test('PDF básico e Unicode sem fonte fornecida não descarregam fontes externas',async()=>{
  const fetchAnterior=globalThis.fetch
  globalThis.fetch=async()=>{throw new Error('Não devia consultar a Internet')}
  try{
    const p=perfil(),pdf=await gerarPdfUnicode(p,gerarPlano(p))
    assert.equal(new TextDecoder('latin1').decode(pdf.slice(0,8)),'%PDF-1.4')
  }finally{globalThis.fetch=fetchAnterior}
})

test('assinatura Svix inválida não pode alterar o estado',async()=>{
  const key='chave-webhook-teste',sec='whsec_'+btoa(key)
  const obj={type:'email.delivered',data:{email_id:crypto.randomUUID(),tags:{pedido:crypto.randomUUID(),fase:'entrega'}}}
  const r=await verificarWebhookResend(await webhook(obj,key,true),sec)
  assert.equal(r,null)
})


test('personalização pública exige anti-bot e adapta as 20 tarefas sem receber e-mail', async()=>{
  const fetchAnterior=globalThis.fetch
  let geminiChamadas=0
  globalThis.fetch=async(url,opts)=>{
    if(String(url).includes('turnstile'))return Response.json({success:true,action:'enviar_plano'})
    if(String(url).includes('generativelanguage')){
      geminiChamadas++
      const entrada=perfil()
      const base=gerarPlano(entrada)
      const plan={diagnostico:'O objectivo exige treino contínuo em actividades práticas.',
        estrategia:'Executar exercícios ajustados ao acesso limitado à Internet.',
        semanas:base.semanas.map((semana,i)=>({tarefas:semana.tarefas.map((x,j)=>`Tarefa IA ${i+1}.${j+1}: ${x}`),
          entregavel:`Relatório personalizado para a semana número ${i+1}`}))}
      return Response.json({candidates:[{content:{parts:[{text:JSON.stringify(plan)}]}}]})
    }
    throw new Error('Não podia enviar emails')
  }
  try{
    const {env}=ambiente({GEMINI_API_KEY:'chave-gemini',TURNSTILE_SECRET:'turnstile-sec'})
    const p={...perfil(),usarIA:true,turnstileToken:'token-verificado-para-teste'}
    const r=await worker.fetch(pedido('/api/planos/personalizar','POST',p),env)
    assert.equal(r.status,200)
    const dados=await r.json()
    assert.equal(dados.personalizado,true)
    assert.equal(dados.plano.semanas.length,4)
    assert.equal(dados.plano.semanas.flatMap(s=>s.tarefas).length,20)
    assert.ok(geminiChamadas===1)
    const r2=await worker.fetch(pedido('/api/planos/personalizar','POST',p),env)
    assert.equal(r2.status,429,'a mesma origem deve respeitar limites de API')
  }finally{globalThis.fetch=fetchAnterior}
})

test('expiração da verificação impede o segundo e-mail e permite eliminar os dados',async()=>{
  const fetchAnterior=globalThis.fetch;const mensagens=[];globalThis.fetch=mockEmailJS(mensagens)
  try{
    const {env,planos}=ambiente(),p=perfil()
    const recebido=await (await worker.fetch(pedido('/api/planos','POST',p),env)).json()
    const state=planos.get(recebido.id).state
    const job=await state.storage.get('job')
    job.confirmacaoLimite=Date.now()-1
    await state.storage.put('job',job)
    await planos.get(recebido.id).obj.alarm()
    assert.equal((await state.storage.get('job')).estado,'falhou')
    assert.equal(mensagens.length,1)
    assert.equal((await worker.fetch(pedido(`/api/planos/${recebido.id}`,'DELETE',undefined,recebido.token),env)).status,200)
  }finally{globalThis.fetch=fetchAnterior}
})

test('código de recuperação expirado não recupera token',async()=>{
  const fetchAnterior=globalThis.fetch;const mensagens=[];globalThis.fetch=mockEmailJS(mensagens)
  try{
    const {env,planos}=ambiente(),p=perfil()
    const recebido=await (await worker.fetch(pedido('/api/planos','POST',p),env)).json()
    await worker.fetch(pedido(`/api/planos/${recebido.id}/recuperar`,'POST',{email:p.email}),env)
    const codigo=mensagens.at(-1).template_params.codigo_recuperacao
    const state=planos.get(recebido.id).state,job=await state.storage.get('job')
    job.recuperacao.expira=Date.now()-1
    await state.storage.put('job',job)
    assert.equal((await worker.fetch(pedido(`/api/planos/${recebido.id}/recuperar/validar`,'POST',{email:p.email,codigo}),env)).status,401)
  }finally{globalThis.fetch=fetchAnterior}
})
