<script setup>
import { computed, ref, nextTick, onMounted, onUnmounted } from 'vue'
import { usePlano } from '../composables/usePlano.js'
import { AREAS, SITUACOES, DISPONIBILIDADES, INTERNET, validarPerfil, gerarPlano } from '../../shared/planner.js'
import { gerarPdf } from '../../shared/pdf.js'
import { VERSAO_PROTOCOLO } from '../../shared/versao.js'
const {perfil,perfilDoPlano,plano,desactualizado,guardarPlano,limpar}=usePlano()
const passo=ref(1),email=ref(''),consentimento=ref(false),website=ref(''),erro=ref({}),mensagem=ref(''),estado=ref('parado'),pedido=ref(null),token=ref(''),planoRemoto=ref(null)
const api=String(import.meta.env.VITE_WORKER_URL || '').replace(/\/$/,'')
const situacaoServico=ref(api ? 'a_verificar' : 'indisponivel')
const enviarDisponivel=computed(()=>situacaoServico.value==='disponivel')
const iaDisponivel=ref(false), iaCarregando=ref(false), verificando=ref(false), recuperando=ref(false)
const verificacaoNecessaria=ref(false), codigoEmail=ref('')
const recuperacaoId=ref(''), recuperacaoEmail=ref(''), codigoRecuperacao=ref(''), recuperarFase=ref(1)
const siteKey=String(import.meta.env.VITE_TURNSTILE_SITE_KEY || '')
const captchaElemento=ref(null), captchaToken=ref('')
let captchaId=null
async function iniciarTurnstile(){
  if(!siteKey||captchaId!==null)return
  await nextTick()
  if(!captchaElemento.value)return
  if(!window.turnstile){
    if(!document.getElementById('rumocerto-turnstile')){
      const script=document.createElement('script')
      script.id='rumocerto-turnstile';script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
      script.async=true;script.defer=true;document.head.appendChild(script)
    }
    for(let i=0;i<40&&!window.turnstile;i++)await new Promise(r=>setTimeout(r,150))
  }
  if(window.turnstile&&captchaElemento.value&&captchaId===null){
    captchaId=window.turnstile.render(captchaElemento.value,{sitekey:siteKey,action:'enviar_plano',
      callback:valor=>{captchaToken.value=valor},'expired-callback':()=>{captchaToken.value=''},
      'error-callback':()=>{captchaToken.value=''}})
  }
}
function limparCaptcha(){
  captchaToken.value=''
  if(captchaId!==null && window.turnstile)window.turnstile.reset(captchaId)
}

const descricaoServico=computed(()=>({a_verificar:'A verificar o serviço de e-mail…',disponivel:'Envio configurado. A recepção depende do serviço de correio.',indisponivel:'Serviço de e-mail indisponível. O plano permanece disponível em PDF.'})[situacaoServico.value])
const CHAVE_SUBMISSAO='rumocerto:submissao:v34'
async function identificarSubmissao(dados){
  const texto=JSON.stringify({nome:dados.nome,area:dados.area,situacao:dados.situacao,objetivo:dados.objetivo,disponibilidade:dados.disponibilidade,internet:dados.internet,competencias:dados.competencias,dificuldade:dados.dificuldade,usarIA:dados.usarIA,email:dados.email})
  const bruto=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(texto))
  const assinatura=[...new Uint8Array(bruto)].map(b=>b.toString(16).padStart(2,'0')).join('')
  let existente=null
  try{existente=JSON.parse(localStorage.getItem(CHAVE_SUBMISSAO)||'null')}catch{}
  if(existente?.assinatura===assinatura && /^[0-9a-f-]{36}$/i.test(existente?.id||'') && Date.now()-existente.criadoEm<7*24*60*60*1000)return existente.id
  const id=crypto.randomUUID()
  try{localStorage.setItem(CHAVE_SUBMISSAO,JSON.stringify({id,assinatura,criadoEm:Date.now()}))}catch{}
  return id
}
const passos = [{ numero: 1, titulo: 'Perfil' }, { numero: 2, titulo: 'Objectivo' }, { numero: 3, titulo: 'Plano' }]
let timer=null
const loading=computed(()=>estado.value==='enviando')
const cancelando=ref(false)
const podeCancelar=computed(()=>Boolean(pedido.value?.id && token.value))
const estadoLegivel=computed(()=>({por_confirmar:'Pedido a aguardar confirmação',a_confirmar:'A enviar a confirmação',aguarda_verificacao:'Confirme o código recebido no e-mail',pendente:'Endereço confirmado; entrega agendada',enviando:'A enviar a mensagem final',enviado:'Mensagem aceite pelo fornecedor',entregue:'Entrega confirmada pelo servidor do destinatário',devolvido:'Entrega rejeitada pelo destinatário',falhou:'O serviço não concluiu o envio',incerto:'Resultado do envio por confirmar'})[pedido.value?.estado]||'Em processamento')
async function consultarComPrazo(url, opcoes = {}, milissegundos = 15000) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), milissegundos)
  try {
    return await fetch(url, { ...opcoes, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}
function validarEtapa(n){
  const e=validarPerfil(perfil.value)
  const chaves=n===1?['area','situacao']:n===2?['objetivo','disponibilidade','internet','competencias','dificuldade']:[]
  erro.value=Object.fromEntries(Object.entries(e).filter(([k])=>chaves.includes(k)))
  return !Object.keys(erro.value).length
}
async function avancar(){if(!validarEtapa(passo.value)){await nextTick();document.querySelector('[aria-invalid="true"]')?.focus();return}passo.value=Math.min(3,passo.value+1);mensagem.value='';await nextTick();iniciarTurnstile();window.scrollTo({top:0,behavior:'smooth'})}
function voltar(){passo.value=Math.max(1,passo.value-1);erro.value={};mensagem.value=''}
function criarPrevia(){
  const e=validarPerfil(perfil.value)
  if(Object.keys(e).length){erro.value=e;passo.value=e.area||e.situacao?1:2;mensagem.value='Revise os campos assinalados antes de gerar o plano.';return}
  try{const result=gerarPlano(perfil.value);guardarPlano(result);estado.value='previa';mensagem.value='Plano criado. Consulte as actividades ou descarregue o documento em PDF.';return true}
  catch(ex){estado.value='erro';mensagem.value=ex.message;return false}
}
async function descarregar(){
  if(!plano.value)return
  const pdf=gerarPdf(perfilDoPlano.value||perfil.value,plano.value)
  const url=URL.createObjectURL(new Blob([pdf],{type:'application/pdf'}))
  const a=document.createElement('a')
  a.href=url;a.download='RumoCerto_MZ_Plano_30_Dias.pdf';a.click()
  setTimeout(()=>URL.revokeObjectURL(url),3000)
}
async function verificarServico(){
  if (!api) { situacaoServico.value='indisponivel';return false }
  situacaoServico.value='a_verificar'
  try {
    const r=await consultarComPrazo(api+'/api/saude',{},9000)
    const servico=await r.json()
    verificacaoNecessaria.value=servico.verificacaoNecessaria===true
    iaDisponivel.value=servico.personalizacaoDisponivel===true
    situacaoServico.value=r.ok && servico.ok && servico.envioDisponivel && servico.versao===VERSAO_PROTOCOLO && !(servico.turnstileNecessario&&!siteKey) ? 'disponivel' : 'indisponivel'
  } catch { situacaoServico.value='indisponivel' }
  return situacaoServico.value==='disponivel'
}
function mensagemEstadoEnvio(res){
  if(res.estado==='incerto')return res.faseIncerta==='confirmacao' ?
    'Não foi possível confirmar a aceitação da mensagem inicial. Verifique a caixa de entrada e a pasta de spam. O pedido não será reenviado automaticamente.' :
    'Não foi possível confirmar a aceitação da mensagem final. Verifique a caixa de entrada e a pasta de spam antes de efectuar outro pedido.'
  if(res.estado==='falhou')return 'O envio não foi concluído. O plano e o PDF continuam disponíveis neste dispositivo.'
  if(res.estado==='entregue')return 'O fornecedor confirmou a entrega ao servidor do destinatário. A colocação na caixa de entrada depende do serviço de correio.'
  if(res.estado==='devolvido')return 'A entrega foi recusada. Verifique o endereço e contacte o apoio do fornecedor.'
  if(res.estado==='aguarda_verificacao')return 'Foi enviado um código de seis dígitos. Introduza-o abaixo para autorizar o envio do plano. Sem confirmação, não será enviado o segundo e-mail.'
  if(res.estado==='enviado')return 'A mensagem foi aceite pelo serviço de e-mail. Confirme a recepção na caixa de entrada ou na pasta de spam.'
  if(res.estado==='por_confirmar' || res.estado==='a_confirmar')return 'Pedido registado. A confirmação está em processamento. Não é necessário enviar novamente.'
  return res.recuperado ? 'O pedido já se encontrava registado. Não foram geradas mensagens adicionais.' :
    'A confirmação foi aceite pelo serviço de e-mail. A mensagem final está prevista para cerca de 30 segundos após a confirmação do e-mail.'
}
async function pedirPorEmail(){
  if(loading.value||cancelando.value)return
  const dados={...perfil.value,email:email.value.trim(),consentimento:consentimento.value,website:website.value,turnstileToken:captchaToken.value}
  const e=validarPerfil(dados,{exigirEmail:true})
  erro.value=e
  if(Object.keys(e).length){
    estado.value='erro'
    mensagem.value='Revise os campos assinalados. O progresso guardado foi preservado.'
    if(e.area||e.situacao||e.nome)passo.value=1
    else if(e.objetivo||e.disponibilidade||e.internet||e.competencias||e.dificuldade)passo.value=2
    await nextTick();document.querySelector('[aria-invalid="true"]')?.focus()
    return
  }
  estado.value='enviando';mensagem.value='A verificar o serviço de e-mail…'
  if(!await verificarServico()){mensagem.value=descricaoServico.value;estado.value='erro';return}
  dados.submissaoId=await identificarSubmissao(dados)
  try{
    mensagem.value='A enviar o pedido…'
    const r=await consultarComPrazo(api+'/api/planos',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(dados)},30000)
    const resposta=await r.json();if(!r.ok)throw new Error(resposta.aguardarSegundos ?
      `${resposta.erro || 'Aguarde antes de enviar outro pedido.'} Tente dentro de ${resposta.aguardarSegundos} segundos.` :
      resposta.erro||'Pedido não aceite pelo servidor')
    if(!resposta.plano || !Array.isArray(resposta.plano.semanas) || resposta.plano.semanas.length!==4)throw new Error('A resposta do servidor contém um plano incompleto. O progresso guardado foi preservado.')
    if (!plano.value) guardarPlano(resposta.plano)
    else if (plano.value.diagnostico !== resposta.plano.diagnostico || plano.value.estrategia !== resposta.plano.estrategia || plano.value.metodo !== resposta.plano.metodo || JSON.stringify(plano.value.semanas.map(s=>s.tarefas)) !== JSON.stringify(resposta.plano.semanas.map(s=>s.tarefas))) planoRemoto.value=resposta.plano
    pedido.value={id:resposta.id,agendadoPara:resposta.agendadoPara,estado:resposta.estado,verificacaoNecessaria:resposta.verificacaoNecessaria,fornecedor:resposta.fornecedor};token.value=resposta.token
    limparCaptcha()
    guardarPedidoPendente()
    estado.value=['incerto','falhou'].includes(resposta.estado)?'erro':resposta.estado==='enviado'?'concluido':r.status===202?'enviando_confirmacao':'agendado'
    mensagem.value=mensagemEstadoEnvio(resposta)
    if(timer)clearInterval(timer);if(!['entregue','devolvido','incerto','falhou'].includes(resposta.estado) && !(resposta.estado==='enviado'&&resposta.fornecedor!=='resend')){timer=setInterval(actualizarEstado,30000)}
  }catch(ex){estado.value='erro';mensagem.value=ex.name==='AbortError'?'O serviço não respondeu dentro do prazo. O plano permanece disponível neste dispositivo. Verifique o e-mail antes de repetir o pedido.':ex.message}
}
const CHAVE_PEDIDO='rumocerto:pedido:pendente'
function guardarPedidoPendente(){
  try { if(pedido.value?.id && token.value) sessionStorage.setItem(CHAVE_PEDIDO,JSON.stringify({pedido:pedido.value,token:token.value})) } catch {}
}
function removerPedidoPendente(){try{sessionStorage.removeItem(CHAVE_PEDIDO)}catch{}}
async function actualizarEstado(){
  if(!pedido.value?.id||!api||!token.value)return
  try{
    const r=await consultarComPrazo(`${api}/api/planos/${pedido.value.id}`,{headers:{Authorization:`Bearer ${token.value}`}},12000)
    if(r.status===404||r.status===401){clearInterval(timer);removerPedidoPendente();pedido.value=null;token.value='';mensagem.value='O pedido anterior expirou. O plano permanece disponível neste navegador.';return}
    if(!r.ok)return
    const res=await r.json()
    pedido.value.estado=res.estado
    pedido.value.faseIncerta=res.faseIncerta
    pedido.value.verificacaoNecessaria=res.verificacaoNecessaria
    pedido.value.fornecedor=res.fornecedor
    if(res.estado==='enviado' && res.fornecedor==='resend' && !pedido.value.acompanhamentoAte)pedido.value.acompanhamentoAte=Date.now()+15*60*1000
    guardarPedidoPendente()
    if(['enviado','entregue','devolvido','falhou','incerto'].includes(res.estado)){
      if(res.estado!=='enviado'||res.fornecedor!=='resend'||Date.now()>pedido.value.acompanhamentoAte)clearInterval(timer)
      estado.value=['enviado','entregue'].includes(res.estado)?'concluido':'erro'
      mensagem.value=mensagemEstadoEnvio(res)
    }
  }catch{}
}
async function confirmarCodigoEmail(){
  if(!pedido.value?.id||!token.value||verificando.value)return
  if(!/^\d{6}$/.test(codigoEmail.value)){mensagem.value='O código deve ter seis algarismos.';return}
  verificando.value=true
  try{
    const r=await consultarComPrazo(`${api}/api/planos/${pedido.value.id}/verificar`,{
      method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token.value}`},
      body:JSON.stringify({codigo:codigoEmail.value})},12000)
    const res=await r.json()
    if(!r.ok)throw new Error(res.erro||'Não foi possível confirmar o endereço.')
    pedido.value={...pedido.value,...res};codigoEmail.value='';guardarPedidoPendente()
    mensagem.value='Endereço confirmado. O plano será enviado cerca de 30 segundos após esta confirmação.'
    if(timer)clearInterval(timer);timer=setInterval(actualizarEstado,30000)
  }catch(e){mensagem.value=e.message}finally{verificando.value=false}
}
async function iniciarRecuperacao(){
  if(recuperando.value || !api)return
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(recuperacaoId.value)){
    mensagem.value='Indique o identificador do pedido recebido no e-mail.';return
  }
  recuperando.value=true
  try{
    const r=await consultarComPrazo(`${api}/api/planos/${recuperacaoId.value}/recuperar`,{
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:recuperacaoEmail.value.trim()})})
    const res=await r.json()
    if(!r.ok)throw new Error(res.erro||'Não foi possível pedir a recuperação.')
    recuperarFase.value=2;mensagem.value='Se o pedido existir, receberá um código de recuperação. Verifique também o spam.'
  }catch(e){mensagem.value=e.message}finally{recuperando.value=false}
}
async function concluirRecuperacao(){
  if(recuperando.value||!/^\d{6}$/.test(codigoRecuperacao.value))return
  recuperando.value=true
  try{
    const r=await consultarComPrazo(`${api}/api/planos/${recuperacaoId.value}/recuperar/validar`,{
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:recuperacaoEmail.value.trim(),codigo:codigoRecuperacao.value})})
    const res=await r.json()
    if(!r.ok)throw new Error(res.erro||'Código inválido ou expirado.')
    pedido.value={id:res.id,estado:res.estado,agendadoPara:res.agendadoPara,verificacaoNecessaria:res.verificacaoNecessaria,fornecedor:res.fornecedor}
    token.value=res.token;guardarPedidoPendente();recuperarFase.value=1;codigoRecuperacao.value=''
    if(!plano.value && res.plano)guardarPlano(res.plano)
    mensagem.value='Acesso recuperado. Pode consultar o pedido ou solicitar a eliminação dos dados.'
    if(timer)clearInterval(timer);timer=setInterval(actualizarEstado,30000)
  }catch(e){mensagem.value=e.message}finally{recuperando.value=false}
}
async function personalizarComIA(){
  if(iaCarregando.value||!api||!siteKey||!captchaToken.value)return
  if(!validarEtapa(2)){mensagem.value='Revise as informações do perfil antes de personalizar.';return}
  if(!window.confirm('Enviar o seu perfil profissional (sem endereço de e-mail) ao serviço Gemini para personalizar as actividades?'))return
  iaCarregando.value=true
  try{
    const r=await consultarComPrazo(`${api}/api/planos/personalizar`,{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({...perfil.value,usarIA:true,turnstileToken:captchaToken.value})},25000)
    const res=await r.json()
    if(!r.ok)throw new Error(res.erro||'Não foi possível personalizar o plano.')
    if(!res.plano || res.plano.semanas?.length!==4)throw new Error('Resposta incompleta.')
    if(plano.value && !window.confirm('Substituir as tarefas do plano actual? O progresso será reiniciado se as tarefas forem diferentes.'))return
    guardarPlano(res.plano)
    mensagem.value=res.personalizado?'As 20 actividades foram adaptadas ao perfil.':'Foi utilizado o plano local porque a IA não devolveu uma resposta válida.'
  }catch(e){mensagem.value=e.message}
  finally{iaCarregando.value=false;limparCaptcha()}
}
async function cancelarPedidoRemoto(){
  if(!podeCancelar.value || cancelando.value)return
  if(!window.confirm('Cancelar o pedido e eliminar os dados associados no servidor? Uma mensagem já em processamento ainda pode chegar.'))return
  cancelando.value=true
  try{
    const r=await consultarComPrazo(`${api}/api/planos/${pedido.value.id}`,{
      method:'DELETE',headers:{Authorization:`Bearer ${token.value}`}},12000)
    const res=await r.json()
    if(!r.ok)throw new Error(res.erro||'Não foi possível cancelar o pedido no servidor.')
    pedido.value=null;token.value='';removerPedidoPendente();clearInterval(timer)
    try{localStorage.removeItem(CHAVE_SUBMISSAO)}catch{}
    mensagem.value='Os dados do pedido foram eliminados do servidor e a ligação do PDF foi revogada. Uma mensagem já aceite pelo serviço de correio ainda pode chegar.'
    estado.value='cancelado'
  }catch(e){mensagem.value=`Não foi possível confirmar a eliminação remota: ${e.message}`;estado.value='erro'}
  finally{cancelando.value=false}
}
function novoPedido(){
  if(pedido.value?.estado!=='falhou')return
  try{localStorage.removeItem(CHAVE_SUBMISSAO)}catch{}
  pedido.value=null;token.value='';removerPedidoPendente();clearInterval(timer)
  mensagem.value='Pode submeter um novo pedido depois do período de segurança de 90 segundos.'
  estado.value='parado'
}
function adoptarPlanoRemoto(){
  if(!planoRemoto.value)return
  const confirmar= !plano.value || window.confirm('Deseja substituir o plano actual pela versão recebida por e-mail? Se as actividades forem diferentes, o progresso será reiniciado.')
  if(!confirmar)return
  guardarPlano(planoRemoto.value)
  planoRemoto.value=null
  mensagem.value='O plano recebido por e-mail está disponível para acompanhamento.'
}
function apagarLocal(){
  if(window.confirm('Eliminar o perfil, o plano e o progresso guardados neste dispositivo? Pedidos já enviados ao servidor não são eliminados.')){
    limpar();passo.value=1;email.value='';consentimento.value=false;website.value='';erro.value={};mensagem.value='Dados locais eliminados. Os pedidos no servidor, se existirem, não são eliminados por esta acção.';estado.value='parado';pedido.value=null;token.value='';planoRemoto.value=null;removerPedidoPendente();try{localStorage.removeItem(CHAVE_SUBMISSAO)}catch{}clearInterval(timer)
  }
}
onMounted(()=>{
  verificarServico()
  try{
    const salvo=JSON.parse(sessionStorage.getItem(CHAVE_PEDIDO)||'null')
    if(salvo?.pedido?.id && /^[0-9a-f]{48}$/.test(salvo?.token||'')){
      pedido.value=salvo.pedido;token.value=salvo.token
      passo.value=3;nextTick().then(iniciarTurnstile);actualizarEstado()
      timer=setInterval(actualizarEstado,30000)
    }
  }catch{}
})
onUnmounted(()=>clearInterval(timer))
</script>

<template>
  <div class="container inner-page plan-page">
    <div class="page-heading plan-heading">
      <span class="eyebrow">DESENVOLVIMENTO PROFISSIONAL</span>
      <h1>Plano de desenvolvimento personalizado</h1>
      <p>Organize um objectivo profissional em quatro semanas de actividades, através de três etapas.</p>
    </div>

    <div class="wizard-layout">
      <section class="wizard-card" aria-labelledby="formulario-titulo">
        <div class="stepper" aria-label="Etapas da criação">
          <div v-for="s in passos" :key="s.numero" class="stepper-item" :class="{ 'step-current': passo === s.numero, 'step-complete': passo > s.numero }" :aria-current="passo === s.numero ? 'step' : undefined">
            <span>{{ passo > s.numero ? '✓' : s.numero }}</span><strong>{{ s.titulo }}</strong>
          </div>
        </div>

        <form @submit.prevent="pedirPorEmail" novalidate>
          <div v-if="passo === 1">
            <div class="form-heading"><span class="eyebrow">PASSO 01 · PERFIL</span><h2 id="formulario-titulo">Informações do perfil</h2><p>Indique a área profissional e a situação actual.</p></div>
            <div class="field"><label for="nome">Nome de preferência <span>(opcional)</span></label><input id="nome" v-model.trim="perfil.nome" :aria-invalid="Boolean(erro.nome)" maxlength="90" autocomplete="off" placeholder="Ex.: Ana" /><small v-if="erro.nome" class="error-text">{{ erro.nome }}</small></div>
            <div class="field"><label for="area">Área profissional *</label><select id="area" v-model="perfil.area" :aria-invalid="Boolean(erro.area)"><option value="">Seleccione uma área</option><option v-for="a in AREAS" :key="a">{{ a }}</option></select><small v-if="erro.area" class="error-text">{{ erro.area }}</small></div>
            <div class="field"><label for="situacao">Situação actual *</label><select id="situacao" v-model="perfil.situacao" :aria-invalid="Boolean(erro.situacao)"><option value="">Seleccione a situação actual</option><option v-for="s in SITUACOES" :key="s">{{ s }}</option></select><small v-if="erro.situacao" class="error-text">{{ erro.situacao }}</small></div>
            <button type="button" class="btn btn-primary full-button" @click="avancar">Continuar <span aria-hidden="true">↗</span></button>
          </div>

          <div v-else-if="passo === 2">
            <div class="form-heading"><span class="eyebrow">PASSO 02 · OBJECTIVO</span><h2 id="formulario-titulo">Definição do objectivo</h2><p>Descreva o resultado pretendido e indique a disponibilidade semanal.</p></div>
            <div class="field"><label for="objetivo">Objectivo para os próximos 30 dias *</label><textarea id="objetivo" v-model.trim="perfil.objetivo" maxlength="450" rows="3" placeholder="Ex.: Preparar um portefólio para candidaturas de estágio." :aria-invalid="Boolean(erro.objetivo)" /><small v-if="erro.objetivo" class="error-text">{{ erro.objetivo }}</small><small class="field-hint">{{ perfil.objetivo.length }}/450 caracteres</small></div>
            <div class="field-grid"><div class="field"><label for="disponibilidade">Tempo por semana *</label><select id="disponibilidade" v-model="perfil.disponibilidade" :aria-invalid="Boolean(erro.disponibilidade)"><option v-for="x in DISPONIBILIDADES" :key="x">{{ x }}</option></select></div><div class="field"><label for="internet">Acesso à Internet *</label><select id="internet" v-model="perfil.internet" :aria-invalid="Boolean(erro.internet)"><option v-for="x in INTERNET" :key="x">{{ x }}</option></select></div></div>
            <details class="form-disclosure"><summary>Informações adicionais <span>(opcional)</span></summary><div class="form-disclosure-content"><div class="field"><label for="competencias">Competências existentes</label><textarea id="competencias" v-model.trim="perfil.competencias" :aria-invalid="Boolean(erro.competencias)" maxlength="300" rows="2" placeholder="Ex.: JavaScript básico, trabalhar em equipa…" /><small v-if="erro.competencias" class="error-text">{{ erro.competencias }}</small></div><div class="field"><label for="dificuldade">Maior dificuldade</label><textarea id="dificuldade" v-model.trim="perfil.dificuldade" :aria-invalid="Boolean(erro.dificuldade)" maxlength="450" rows="2" placeholder="Ex.: Pouco tempo livre ou Internet limitada." /><small v-if="erro.dificuldade" class="error-text">{{ erro.dificuldade }}</small></div></div></details>
            <div class="wizard-actions"><button type="button" class="btn btn-outline" @click="voltar">← Voltar</button><button type="button" class="btn btn-primary" @click="avancar">Continuar ↗</button></div>
          </div>

          <div v-else>
            <div class="form-heading"><span class="eyebrow">PASSO 03 · CONFIRMAÇÃO</span><h2 id="formulario-titulo">Revisão e criação do plano</h2><p>Revise as informações antes de gerar o plano. Não é necessário criar uma conta.</p></div>
            <div class="review-box"><div><small>ÁREA</small><strong>{{ perfil.area }}</strong></div><div><small>OBJECTIVO</small><strong>{{ perfil.objetivo }}</strong></div><div><small>TEMPO</small><strong>{{ perfil.disponibilidade }}</strong></div></div>
            <button class="btn btn-primary full-button" type="button" @click="criarPrevia">Gerar plano ↗</button>
            <p v-if="siteKey && iaDisponivel" class="form-helper">Pode também solicitar uma versão com tarefas revistas por IA, independentemente do envio por e-mail.</p>
            <button v-if="siteKey && iaDisponivel" class="btn btn-outline full-button" type="button" :disabled="iaCarregando || !captchaToken" @click="personalizarComIA">{{ iaCarregando ? 'A personalizar…' : 'Personalizar as tarefas com IA' }}</button>
            <p class="form-helper">O plano inicial é criado no navegador, sem recurso a serviços externos. A IA, quando escolhida, utiliza um serviço externo.</p>
            <div v-if="siteKey" class="captcha-box"><div ref="captchaElemento" aria-label="Protecção contra envios automáticos"></div><small>Verificação de segurança necessária para serviços externos.</small></div>
            <details class="optional-panel"><summary>Solicitar envio por e-mail <span aria-hidden="true">⌄</span></summary><div class="optional-panel-content"><p>O envio é opcional. Receberá um código para confirmar o endereço e autorizar o envio posterior de uma ligação privada para o PDF.</p><div class="hp-field" aria-hidden="true"><label for="website">Não preencher<input id="website" v-model="website" type="text" autocomplete="off" tabindex="-1" /></label></div><div class="field"><label for="email">Endereço de e-mail</label><input id="email" v-model.trim="email" type="email" placeholder="nome@exemplo.com" autocomplete="email" :aria-invalid="Boolean(erro.email)" /><small v-if="erro.email" class="error-text">{{ erro.email }}</small></div><label class="choice-label"><input v-model="perfil.usarIA" type="checkbox" /><span><strong>Personalização com IA Gemini (opcional)</strong><small>Se esta opção for activada, a área, a situação, o objectivo, as competências e as dificuldades poderão ser enviados à Google. O endereço de e-mail não é partilhado com a IA. Se o serviço estiver indisponível, será utilizada a geração de plano sem IA.</small></span></label><label class="choice-label choice-consent"><input v-model="consentimento" type="checkbox" :aria-invalid="Boolean(erro.consentimento)" /><span>Autorizo o tratamento dos meus dados para receber o código de confirmação e o plano por e-mail. Sei que este plano não garante emprego.</span></label><small v-if="erro.consentimento" class="error-text">{{ erro.consentimento }}</small><p class="integration-notice" role="status">{{ descricaoServico }}</p><button type="submit" class="btn btn-outline full-button" :disabled="loading || !enviarDisponivel || (siteKey && !captchaToken)">{{ loading ? 'A enviar…' : 'Confirmar pedido de envio' }}</button></div></details>
            <div class="wizard-actions final-actions"><button type="button" class="text-button" @click="voltar">← Rever informações</button><button type="button" class="text-button danger" @click="apagarLocal">Limpar dados locais</button></div>
          </div>
          <div v-if="planoRemoto" class="remote-choice" role="status"><strong>A versão recebida por e-mail apresenta actividades diferentes.</strong><p>O plano actual foi preservado. É possível adoptar a versão recebida mediante confirmação.</p><button type="button" class="btn btn-outline" @click="adoptarPlanoRemoto">Adoptar plano recebido</button></div><p v-if="mensagem" class="feedback" :class="{ 'feedback-error': estado === 'erro' }" :role="estado === 'erro' ? 'alert' : 'status'">{{ mensagem }}</p>
          <div v-if="pedido?.estado === 'aguarda_verificacao' && token" class="sent-status" role="group" aria-label="Confirmar endereço de e-mail">
            <strong>Confirmar endereço</strong><p>Introduza o código de seis algarismos enviado para o seu e-mail. O envio final só será agendado depois desta confirmação.</p>
            <div class="field"><label for="codigo-email">Código recebido</label><input id="codigo-email" v-model.trim="codigoEmail" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="000000" /></div>
            <button type="button" class="btn btn-primary" :disabled="verificando || !/^\d{6}$/.test(codigoEmail)" @click="confirmarCodigoEmail">{{ verificando ? 'A confirmar…' : 'Confirmar código' }}</button>
          </div>
          <details v-if="api && !pedido" class="optional-panel" aria-label="Recuperar acesso ao pedido">
            <summary>Recuperar um pedido antigo <span aria-hidden="true">⌄</span></summary>
            <div class="optional-panel-content"><p>Se perdeu o acesso, use o identificador presente no primeiro e-mail e o endereço que indicou no pedido.</p>
              <div class="field"><label for="recuperar-id">Identificador do pedido</label><input id="recuperar-id" v-model.trim="recuperacaoId" autocomplete="off" placeholder="xxxxxxxx-xxxx-4xxx-xxxx-xxxxxxxxxxxx" /></div>
              <div class="field"><label for="recuperar-email">E-mail do pedido</label><input id="recuperar-email" v-model.trim="recuperacaoEmail" type="email" autocomplete="email" /></div>
              <button v-if="recuperarFase===1" type="button" class="btn btn-outline" :disabled="recuperando" @click="iniciarRecuperacao">Solicitar código de recuperação</button>
              <template v-else><div class="field"><label for="codigo-recuperacao">Código de recuperação</label><input id="codigo-recuperacao" v-model.trim="codigoRecuperacao" inputmode="numeric" autocomplete="one-time-code" maxlength="6" /></div><button type="button" class="btn btn-primary" :disabled="recuperando || !/^\d{6}$/.test(codigoRecuperacao)" @click="concluirRecuperacao">Recuperar acesso</button></template>
            </div>
          </details>
          <div v-if="pedido" class="sent-status" :class="{ 'sent-status-warning': ['incerto','falhou','devolvido'].includes(pedido.estado) }" role="status"><strong>Estado: {{ estadoLegivel }}</strong><p v-if="pedido.estado !== 'aguarda_verificacao'">Envio previsto: {{ new Date(pedido.agendadoPara).toLocaleString('pt-MZ') }}. Pode fechar o navegador após confirmar o e-mail.</p><p v-else>É necessário confirmar o código antes da entrega final.</p><div class="remote-actions"><button type="button" class="text-button" @click="actualizarEstado">Actualizar estado ↻</button><button v-if="pedido.estado === 'falhou'" type="button" class="text-button" @click="novoPedido">Preparar novo pedido</button><button v-if="podeCancelar" type="button" class="text-button danger" :disabled="cancelando" @click="cancelarPedidoRemoto">{{ cancelando ? 'A eliminar…' : 'Cancelar e eliminar pedido do servidor' }}</button></div></div>
        </form>
      </section>

      <aside class="wizard-side">
        <div class="side-top"><span class="eyebrow">ESTRUTURA DO PLANO</span><h2>Actividades <em>organizadas por etapas.</em></h2></div>
        <div class="side-benefits"><div><span aria-hidden="true">01</span><p><strong>4 semanas</strong><small>Objectivos e actividades por semana.</small></p></div><div><span aria-hidden="true">02</span><p><strong>Actividades planeadas</strong><small>Distribuição de tempo por actividade.</small></p></div><div><span aria-hidden="true">03</span><p><strong>Documento e progresso</strong><small>Descarregue o PDF e registe as tarefas concluídas.</small></p></div></div>
        <p class="side-privacy">As informações são guardadas neste navegador. O e-mail só é utilizado mediante pedido de envio.</p>
      </aside>
    </div>

    <section v-if="plano" class="plan-result" aria-labelledby="resultado-titulo">
      <p v-if="desactualizado" class="feedback feedback-error" role="status">As informações foram alteradas após a criação do plano. Gere uma nova versão para actualizar as actividades. O progresso anterior permanece guardado até à substituição.</p>
      <div class="plan-result-head"><div><span class="eyebrow">PLANO DISPONÍVEL</span><h2 id="resultado-titulo">{{ plano.titulo }}</h2><p>{{ plano.diagnostico }}</p></div><div class="plan-result-actions"><RouterLink class="btn btn-primary" to="/progresso">Acompanhar actividades ↗</RouterLink><button type="button" class="btn btn-outline" @click="descarregar">Descarregar PDF ↓</button></div></div>
      <div class="week-overview"><div v-for="s in plano.semanas" :key="s.numero" class="week-overview-item"><span>SEMANA {{ String(s.numero).padStart(2, '0') }}</span><strong>{{ s.titulo }}</strong><small>{{ s.minutosSugeridos }} minutos de actividades</small></div></div>
    </section>
  </div>
</template>
