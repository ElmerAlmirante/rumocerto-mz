import { randomUUID } from 'node:crypto'

const destino = String(process.env.RUMOCERTO_TEST_EMAIL || '').trim()
const servidor = String(process.env.RUMOCERTO_WORKER_URL || '').trim().replace(/\/$/,'')
const codigo = String(process.env.RUMOCERTO_TEST_CODE || '').trim()
const id = String(process.env.RUMOCERTO_TEST_ID || '').trim()
const token = String(process.env.RUMOCERTO_TEST_TOKEN || '').trim()
const ler = async r => {const dados=await r.json().catch(()=>({}));if(!r.ok)throw new Error(`${r.status} — ${dados.erro||'Resposta inesperada'}`);return dados}
const pedidoTeste = () => ({submissaoId:randomUUID(),nome:'Teste RumoCerto',area:'Tecnologia e engenharia',
  situacao:'Estudante',objetivo:'Testar em ambiente real o correio e a recuperação de pedidos',
  disponibilidade:'3 a 5 horas por semana',internet:'Internet frequente',competencias:'',
  dificuldade:'',usarIA:false,website:'',email:destino,consentimento:true})

if(!/^https:\/\//.test(servidor)|| !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destino)){
  console.error('Defina RUMOCERTO_WORKER_URL (HTTPS) e RUMOCERTO_TEST_EMAIL (da sua responsabilidade).')
  process.exitCode=2
}else{
  try{
    const saude=await ler(await fetch(`${servidor}/api/saude`,{signal:AbortSignal.timeout(10000)}))
    if(saude.versao!=='3.8'||!saude.envioDisponivel)throw new Error('Worker 3.8 não está configurado para correio.')
    if(saude.turnstileNecessario && !id){
      throw new Error('Turnstile activo: crie o pedido no navegador e utilize RUMOCERTO_TEST_ID/TOKEN/CODE para confirmar.')
    }
    let acesso={id,token}
    if(!id){
      const r=await fetch(`${servidor}/api/planos`,{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify(pedidoTeste()),signal:AbortSignal.timeout(35000)})
      acesso=await ler(r)
      console.log(`Pedido real criado: ${acesso.id}; estado: ${acesso.estado}.`)
      console.log('Guarde o identificador e o token em local privado; o token não é mostrado neste teste.')
    }
    if(!acesso.id||!acesso.token)throw new Error('Falta ID ou token para consultar o pedido.')
    if(saude.verificacaoNecessaria){
      if(!/^\d{6}$/.test(codigo)){
        console.log('Verifique o código no primeiro e-mail; confirme-o na interface do site ou repita com RUMOCERTO_TEST_CODE=123456, RUMOCERTO_TEST_ID e RUMOCERTO_TEST_TOKEN.')
        process.exit(0)
      }
      const confirmado=await ler(await fetch(`${servidor}/api/planos/${acesso.id}/verificar`,{
        method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${acesso.token}`},
        body:JSON.stringify({codigo}),signal:AbortSignal.timeout(15000)}))
      console.log(`Código aceite; estado: ${confirmado.estado}.`)
    }
    const estado=await ler(await fetch(`${servidor}/api/planos/${acesso.id}`,{
      headers:{Authorization:`Bearer ${acesso.token}`},signal:AbortSignal.timeout(10000)}))
    console.log(`Estado actual: ${estado.estado}. Fornecedor: ${estado.fornecedor}.`)
    if(estado.estado==='entregue')console.log('O servidor do destinatário aceitou a entrega (webhook autenticado).')
    else console.log('A recepção não está confirmada. Verifique spam e inbox; consulte novamente após o prazo de envio.')
  }catch(e){console.error('Teste real não concluído:',e.message);process.exitCode=1}
}
