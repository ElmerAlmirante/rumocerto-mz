import http from 'node:http'
import assert from 'node:assert/strict'
import { randomUUID, webcrypto } from 'node:crypto'
import worker, { PlanoJob, LimiteEnvios } from '../backend/worker.js'
import { AREAS, SITUACOES, DISPONIBILIDADES, INTERNET } from '../shared/planner.js'
if (!globalThis.crypto) globalThis.crypto=webcrypto
const log=[]
function check(desc,condition,detail='') {log.push({resultado: condition?'PASSOU':'FALHOU', teste:desc, detalhe:detail});assert.ok(condition,desc+' '+detail);console.log(`${condition?'✓':'✗'} ${desc}${detail?' — '+detail:''}`)}
function estado() {
 const dados=new Map();let alarm=null;let sequence=Promise.resolve()
 return {storage:{get:async k=>structuredClone(dados.get(k)),put:async(k,v)=>{dados.set(k,structuredClone(v))},deleteAll:async()=>dados.clear(),setAlarm:async a=>{alarm=a},getAlarm:async()=>alarm},blockConcurrencyWhile:fn=>{const p=sequence.then(fn);sequence=p.catch(()=>{});return p}}
}
const env={
 ALLOWED_ORIGINS:'https://k6n9.github.io',PUBLIC_WORKER_URL:'https://rumo.exemplo.org',
 EMAIL_PROVIDER:'emailjs',EMAILJS_SERVICE_ID:'service_teste',EMAILJS_PUBLIC_KEY:'publica_teste',EMAILJS_TEMPLATE_CONFIRM:'confirmacao',EMAILJS_TEMPLATE_PLAN:'plano',EMAILJS_TEMPLATE_RECOVERY:'recuperacao',
 DOWNLOAD_SECRET:'chave-ficticia-de-64-caracteres-somente-teste-rumocerto-2026-123',RATE_SALT:'sal-ficticio-para-proteger-limites-rumocerto-2026',REQUIRE_EMAIL_VERIFICATION:'true'
}
const planos=new Map(),limites=new Map()
env.PLANOS={idFromName:x=>x,get(id){if(!planos.has(id)){const state=estado(),obj=new PlanoJob(state,env);planos.set(id,{state,obj,fetch:(u,init)=>obj.fetch(new Request(u,init))})}return planos.get(id)}}
env.LIMITES={idFromName:x=>x,get(id){if(!limites.has(id)){const obj=new LimiteEnvios(estado());limites.set(id,{fetch:(u,init)=>obj.fetch(new Request(u,init))})}return limites.get(id)}}
const providerCalls=[]
const realFetch=globalThis.fetch
let providerError=null
globalThis.fetch=async(url,options={})=>{
 if(String(url).includes('api.emailjs.com')) {
   if(providerError) return new Response(providerError.body,{status:providerError.status})
   const obj=JSON.parse(options.body)
   providerCalls.push(obj)
   return new Response('OK', {status:200})
 }
 return realFetch(url,options)
}
const server=http.createServer(async(req,res)=>{
  try{
    const buffers=[];for await(const chunk of req)buffers.push(chunk)
    const headers={...req.headers}
    const webRequest=new Request('https://rumo.exemplo.org'+req.url,{method:req.method,headers, ...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(buffers)}:{})})
    const response=await worker.fetch(webRequest,env)
    res.writeHead(response.status,Object.fromEntries(response.headers))
    res.end(Buffer.from(await response.arrayBuffer()))
  }catch(e){console.error('ERRO SERVIDOR',e);res.statusCode=500;res.end(String(e))}
})
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
const port=server.address().port
const base=`http://127.0.0.1:${port}`
const send=async(path,{method='GET',body,token,origin='https://k6n9.github.io',ip='203.0.113.11',headers={}}={})=>realFetch(base+path,{method,headers:{Origin:origin,'CF-Connecting-IP':ip,...(body!==undefined?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{}),...headers},...(body!==undefined?{body:typeof body==='string'?body:JSON.stringify(body)}:{})})
const p=()=>({submissaoId:randomUUID(),nome:'Lina Teste',area:AREAS[0],situacao:SITUACOES[0],objetivo:'Preparar um portefólio com programação e apresentações académicas',disponibilidade:DISPONIBILIDADES[1],internet:INTERNET[0],competencias:'Tenho noções de JavaScript',dificuldade:'Internet instável',usarIA:false,consentimento:true,email:'lina@exemplo.org',website:''})
try{
 const h=await send('/api/saude');const jh=await h.json()
 check('API responde por HTTP real',h.status===200&&jh.versao==='3.8',`HTTP ${h.status}, protocolo ${jh.versao}`)
 check('CORS autoriza domínio esperado',h.headers.get('access-control-allow-origin')==='https://k6n9.github.io')
 const bad=await send('/api/saude',{origin:'https://site-falso.invalid'})
 check('Origem externa é bloqueada',bad.status===403,`HTTP ${bad.status}`)
 const dados=p();const r=await send('/api/planos',{method:'POST',body:dados})
 const criado=await r.json();check('Pedido fictício criado',r.status===201&&criado.estado==='aguarda_verificacao',`HTTP ${r.status}; estado ${criado.estado}`)
 check('Primeiro e-mail aceite pelo fornecedor de teste',providerCalls.length===1&&providerCalls[0].template_id==='confirmacao')
 const noAuth=await send(`/api/planos/${criado.id}`)
 check('Estado privado exige autorização',noAuth.status===401,`HTTP ${noAuth.status}`)
 await planos.get(criado.id).obj.alarm()
 check('Nenhum segundo envio sem confirmação',providerCalls.length===1)
 const errado=await send(`/api/planos/${criado.id}/verificar`,{method:'POST',body:{codigo:'999999'},token:criado.token})
 check('Código incorrecto é rejeitado',errado.status===422,`HTTP ${errado.status}`)
 const codigo=providerCalls[0].template_params.codigo
 const verific=await send(`/api/planos/${criado.id}/verificar`,{method:'POST',body:{codigo},token:criado.token})
 check('Código válido confirma pedido',verific.status===200&&(await verific.json()).estado==='pendente')
 const jobRecord=await planos.get(criado.id).state.storage.get('job')
 jobRecord.agendadoPara=Date.now()-1
 await planos.get(criado.id).state.storage.put('job',jobRecord)
 await planos.get(criado.id).obj.alarm()
 check('Segundo e-mail aceite após confirmação',providerCalls.length===2&&providerCalls[1].template_id==='plano')
 const url=new URL(providerCalls[1].template_params.link_pdf)
 const pdf=await send(url.pathname+url.search)
 const pdfBuffer=Buffer.from(await pdf.arrayBuffer())
 check('PDF privado descarregado com assinatura',pdf.status===200&&pdfBuffer.subarray(0,8).toString()==='%PDF-1.4',`HTTP ${pdf.status}, ${pdfBuffer.length} bytes`)
 url.searchParams.set('assinatura','0'.repeat(64))
 const invalid=await send(url.pathname+url.search)
 check('Assinatura de PDF falsa é recusada',invalid.status===401,`HTTP ${invalid.status}`)
 const rate=await send('/api/planos',{method:'POST',body:p()})
 check('Envio repetido no mesmo IP limitado',rate.status===429,`HTTP ${rate.status}`)
 const otherRecovery=await send(`/api/planos/${criado.id}/recuperar`,{method:'POST',body:{email:'intruso@exemplo.org'}})
 check('Recuperação não revela existência de outro e-mail',otherRecovery.status===202&&providerCalls.length===2)
 const recovery=await send(`/api/planos/${criado.id}/recuperar`,{method:'POST',body:{email:'lina@exemplo.org'}})
 check('Recuperação do acesso inicia envio',recovery.status===202&&providerCalls.length===3&&providerCalls[2].template_id==='recuperacao')
 const rcod=providerCalls[2].template_params.codigo
 const rec=await send(`/api/planos/${criado.id}/recuperar/validar`,{method:'POST',body:{email:'lina@exemplo.org',codigo:rcod}})
 const recjson=await rec.json()
 check('Código de recuperação restaura acesso',rec.status===200&&recjson.token===criado.token)
 const del=await send(`/api/planos/${criado.id}`,{method:'DELETE',token:recjson.token})
 check('Pedido é eliminado com token recuperado',del.status===200&&(await del.json()).eliminado===true)
 const after=await send(`/api/planos/${criado.id}`,{token:recjson.token})
 check('Pedido eliminado deixa de ser consultável',after.status===404,`HTTP ${after.status}`)
 const pdfDeleted=await send(new URL(providerCalls[1].template_params.link_pdf).pathname+new URL(providerCalls[1].template_params.link_pdf).search)
 check('PDF deixa de existir após eliminação',pdfDeleted.status===404,`HTTP ${pdfDeleted.status}`)
 const invalidContent=await send('/api/planos',{method:'POST',body:p(),ip:'203.0.113.12',headers:{'Content-Type':'text/plain'}})
 check('Tipo de conteúdo inválido recusado',invalidContent.status===415,`HTTP ${invalidContent.status}`)
 const big=p();big.objetivo='x'.repeat(11000)
 const oversized=await send('/api/planos',{method:'POST',body:big,ip:'203.0.113.13'})
 check('Carga maior que 8 KB é recusada',oversized.status===413,`HTTP ${oversized.status}`)
 const notFound=await send('/rota-inexistente')
 check('Rotas desconhecidas retornam 404',notFound.status===404)
}catch(e){console.error('Teste terminou com falha:',e.stack);process.exitCode=1}
finally{
 await new Promise(resolve=>server.close(resolve));globalThis.fetch=realFetch
 console.log(`Resumo: ${log.filter(x=>x.resultado==='PASSOU').length}/${log.length} verificações aprovadas.`)
}
