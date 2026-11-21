import http from 'node:http'
import assert from 'node:assert/strict'
import {randomUUID,webcrypto} from 'node:crypto'
import worker,{PlanoJob,LimiteEnvios} from '../backend/worker.js'
import {AREAS,SITUACOES,DISPONIBILIDADES,INTERNET} from '../shared/planner.js'
if(!globalThis.crypto)globalThis.crypto=webcrypto
const logs=[];const check=(t,ok)=>{logs.push({teste:t,passou:ok});assert.ok(ok,t);console.log((ok?'✓ ':'✗ ')+t)}
const state=()=>{const map=new Map();let seq=Promise.resolve();return {storage:{get:async k=>structuredClone(map.get(k)),put:async(k,v)=>map.set(k,structuredClone(v)),setAlarm:async()=>{},deleteAll:async()=>map.clear()},blockConcurrencyWhile:fn=>{const r=seq.then(fn);seq=r.catch(()=>{});return r}}}
const whsecret='chave-interna-de-teste-resend'
const env={EMAIL_PROVIDER:'resend',RESEND_API_KEY:'TESTE_SEM_ENVIO_REAL',RESEND_FROM:'RumoCerto <noreply@exemplo.org>',RESEND_WEBHOOK_SECRET:'whsec_'+btoa(whsecret),DOWNLOAD_SECRET:'chave-ficticia-de-64-caracteres-somente-teste-rumocerto-2026-123',RATE_SALT:'sal-ficticio-para-proteger-limites-rumocerto-2026',PUBLIC_WORKER_URL:'https://rumo.exemplo.org',ALLOWED_ORIGINS:'https://k6n9.github.io',REQUIRE_EMAIL_VERIFICATION:'false'}
const planos=new Map(),limites=new Map();env.PLANOS={idFromName:x=>x,get(id){if(!planos.has(id)){const st=state(),obj=new PlanoJob(st,env);planos.set(id,{state:st,obj,fetch:(u,options)=>obj.fetch(new Request(u,options))})}return planos.get(id)}};env.LIMITES={idFromName:x=>x,get(id){if(!limites.has(id)){const obj=new LimiteEnvios(state());limites.set(id,{fetch:(u,options)=>obj.fetch(new Request(u,options))})}return limites.get(id)}}
const previousFetch=globalThis.fetch;const sent=[]
globalThis.fetch=async(url,opts)=>{if(String(url).startsWith('https://api.resend.com/')){const id=randomUUID();sent.push({id,body:JSON.parse(opts.body),headers:opts.headers});return Response.json({id})}return previousFetch(url,opts)}
const server=http.createServer(async(req,res)=>{try{const chunks=[];for await(const ch of req)chunks.push(ch);const request=new Request('https://rumo.exemplo.org'+req.url,{method:req.method,headers:req.headers,...(req.method==='GET'?{}:{body:Buffer.concat(chunks)})});const response=await worker.fetch(request,env);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()))}catch(e){res.statusCode=500;res.end(String(e))}})
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port
const request=(path,{method='GET',body,token,origin='https://k6n9.github.io',headers={}}={})=>previousFetch(base+path,{method,headers:{Origin:origin,'CF-Connecting-IP':'203.0.113.150',...(body!==undefined?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{}),...headers},...(body!==undefined?{body:typeof body==='string'?body:JSON.stringify(body)}:{})})
async function signedEvent(event,valid=true){const id='msg_'+randomUUID().replace(/-/g,''),ts=String(Math.floor(Date.now()/1000)),raw=JSON.stringify(event);const key=await webcrypto.subtle.importKey('raw',new TextEncoder().encode(whsecret),{name:'HMAC',hash:'SHA-256'},false,['sign']);const sig=Buffer.from(await webcrypto.subtle.sign('HMAC',key,new TextEncoder().encode(id+'.'+ts+'.'+raw))).toString('base64');return request('/api/webhooks/resend',{method:'POST',body:raw,origin:'',headers:{'Content-Type':'application/json','svix-id':id,'svix-timestamp':ts,'svix-signature':'v1,'+(valid?sig:'incorrecta')}})}
try{
 const p={submissaoId:randomUUID(),nome:'João Exemplo',area:AREAS[0],situacao:SITUACOES[0],objetivo:'Preparar plano de procura de estágio profissional',disponibilidade:DISPONIBILIDADES[0],internet:INTERNET[0],competencias:'Comunicação',dificuldade:'Poucos recursos',usarIA:false,consentimento:true,email:'joao@exemplo.org',website:''}
 const created=await request('/api/planos',{method:'POST',body:p});const job=await created.json();check('Resend: pedido criado por HTTP e envio 1 aceite',created.status===201&&sent.length===1&&sent[0].body.to[0]===p.email)
 const st=planos.get(job.id).state;const actual=await st.storage.get('job');actual.agendadoPara=Date.now()-1;await st.storage.put('job',actual);await planos.get(job.id).obj.alarm()
 check('Resend: mensagem final submetida com ID e idempotência',sent.length===2&&sent[1].headers['Idempotency-Key']===`rumocerto/${job.id}/entrega`)
 const event={type:'email.delivered',data:{email_id:sent[1].id,tags:{pedido:job.id,fase:'entrega'}}}
 const invalid=await signedEvent(event,false);check('Webhook falsificado é recusado',invalid.status===401)
 const before=await (await request(`/api/planos/${job.id}`,{token:job.token})).json();check('Sem evento legítimo, estado não indica entrega',before.estado==='enviado')
 const delivered=await signedEvent(event,true);check('Webhook de entrega com assinatura real HMAC aceite',delivered.status===200)
 const after=await (await request(`/api/planos/${job.id}`,{token:job.token})).json();check('Após webhook válido, estado passa a entregue',after.estado==='entregue'&&Boolean(after.entregaConfirmada))
 const wrongId={type:'email.bounced',data:{email_id:randomUUID(),tags:{pedido:job.id,fase:'entrega'}}}
 const wrong=await signedEvent(wrongId,true);const stateAfter=(await (await request(`/api/planos/${job.id}`,{token:job.token})).json());check('Webhook de e-mail alheio não altera o pedido',wrong.status===200&&stateAfter.estado==='entregue')
 const bounce={type:'email.bounced',data:{email_id:sent[1].id,tags:{pedido:job.id,fase:'entrega'}}}
 const bounced=await signedEvent(bounce,true);const changed=await (await request(`/api/planos/${job.id}`,{token:job.token})).json();check('Evento assinado de devolução marca estado devolvido',bounced.status===200&&changed.estado==='devolvido')
}finally{await new Promise(resolve=>server.close(resolve));globalThis.fetch=previousFetch;console.log(`Resumo Resend: ${logs.filter(x=>x.passou).length}/${logs.length} verificações.`)}
