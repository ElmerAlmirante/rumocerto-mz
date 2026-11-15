import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { construirPlanoBase, gerarPlanoComDiagnostico, classificarFalhaIA } from '../src/planner.js'
import { escolherPerfil, NOMES_PERFIS } from '../src/perfis.js'
import { criarPDF } from '../src/pdf.js'
const p=(objetivo,area='Tecnologia e engenharia',outras={})=>({nome:'Estudante',area,situacao:'Estudante',objetivo,disponibilidade:'3 a 5 horas por semana',internet:'Acesso limitado a dados móveis',competencias:'Conhecimentos básicos',dificuldade:'Tempo limitado',...outras})
const casos=[
  ['Aprender Vue.js e criar componentes','Tecnologia e engenharia','Vue.js'],
  ['Construir um site com HTML','Tecnologia e engenharia','Desenvolvimento Web'],
  ['Aprender Python para pequenos projectos','Tecnologia e engenharia','Python'],
  ['Praticar redes e Cisco Packet Tracer','Tecnologia e engenharia','Redes informáticas'],
  ['Criar dashboard de dados no Excel','Tecnologia e engenharia','Dados e folhas de cálculo'],
  ['Criar um portefólio profissional','Outra área','Portefólio e CV'],
  ['Preparar entrevista para estágio','Outra área','Preparação para entrevistas'],
  ['Abrir um pequeno negócio','Outra área','Negócio e empreendedorismo'],
  ['Melhorar a gestão de uma loja','Administração e gestão','Gestão'],
  ['Desenvolver material pedagógico','Educação','Educação'],
  ['Criar um folheto educativo sobre saúde','Saúde','Literacia em saúde'],
  ['Criar um cartaz de design','Comunicação e artes','Comunicação e design'],
]
test('motor gratuito reconhece 12 percursos concretos sem IA',()=>{
  assert.ok(NOMES_PERFIS.length>=12)
  for(const [objetivo,area,nome] of casos){
    const perfil=escolherPerfil(p(objetivo,area))
    assert.equal(perfil?.nome,nome,objetivo)
    const plano=construirPlanoBase(p(objetivo,area))
    assert.equal(plano.semanas.length,4)
    assert.ok(plano.semanas.every(s=>s.tarefas.length===5 && s.entregavel && s.metrica))
    assert.ok(plano.semanas.some(s=>s.tarefas.some(t=>/\(\d+ min\)/.test(t))))
    assert.match(plano.metodo,/sem IA/)
  }
})
test('durações semanais adaptam-se às quatro disponibilidades',()=>{
  for(const [disp,minimo,maximo] of [
    ['Até 2 horas por semana',1,120],['3 a 5 horas por semana',180,300],['6 a 10 horas por semana',360,600],['Mais de 10 horas por semana',601,900],
  ]){
    const plano=construirPlanoBase(p('Aprender Python com exercícios','Tecnologia e engenharia',{disponibilidade:disp}))
    for(const s of plano.semanas){
      const total=s.tarefas.reduce((n,t)=>n+Number(t.match(/^\((\d+) min\)/)?.[1]||0),0)
      assert.ok(total>=minimo && total<=maximo,`${disp}: ${total}`)
    }
  }
})
test('Gemini é opt-in e não deve ser chamado quando pessoa não autoriza',async()=>{
  let chamado=false
  const resultado=await gerarPlanoComDiagnostico(p('Aprender Vue.js com exercícios','Tecnologia e engenharia',{usarIA:false}),{GEMINI_API_KEY:'teste'},async()=>{chamado=true;throw Error('Não devia chamar')})
  assert.equal(chamado,false)
  assert.equal(resultado.estadoIA,'nao_solicitada')
  assert.match(resultado.plano.metodo,/sem IA/)
})
test('Gemini sem chave e com limite gratuito preserva o plano',async()=>{
  assert.equal((await gerarPlanoComDiagnostico(p('Aprender Vue.js com projectos'),{})).estadoIA,'sem_chave')
  const old=console.warn;console.warn=()=>{}
  try{
    const r=await gerarPlanoComDiagnostico(p('Aprender Vue.js com projectos'),{GEMINI_API_KEY:'teste'},async()=>({ok:false,status:429}))
    assert.equal(r.estadoIA,'limite_gratuito')
    assert.equal(r.plano.semanas.length,4)
    assert.equal(classificarFalhaIA(403),'acesso_negado')
    assert.equal(classificarFalhaIA(404),'modelo_indisponivel')
  }finally{console.warn=old}
})
test('requisição Gemini usa JSON e limita pensamento para 2.5 Flash',async()=>{
  let opts
  const base=p('Aprender Vue.js com projecto')
  const exemplo=construirPlanoBase(base)
  const sem=exemplo.semanas.map(s=>({titulo:s.titulo,foco:s.foco,tarefas:s.tarefas.slice(0,4),entregavel:s.entregavel,metrica:s.metrica}))
  const result=await gerarPlanoComDiagnostico(base,{GEMINI_API_KEY:'teste'},async(url,options)=>{
    assert.match(url,/gemini-2\.5-flash:generateContent/)
    opts=JSON.parse(options.body)
    return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:JSON.stringify({titulo:'Plano de teste',diagnostico:'Orientação',estrategia:'Praticar',semanas:sem})}]}}]})}
  })
  assert.equal(result.estadoIA,'sucesso')
  assert.match(result.plano.metodo,/Gemini/)
  assert.equal(opts.generationConfig.thinkingConfig.thinkingBudget,0)
  assert.equal(opts.generationConfig.responseMimeType,'application/json')
  assert.ok(result.plano.semanas.every(s=>s.tarefas.every(t=>/^\(\d+ min\)/.test(t))))
})
test('PDF mantém páginas com conteúdo e quatro semanas',()=>{
  for(const [objetivo,area] of casos){
    const bytes=criarPDF(p(objetivo,area),construirPlanoBase(p(objetivo,area)),{date:new Date('2026-11-13T00:00:00Z')})
    const texto=new TextDecoder('latin1').decode(bytes)
    const n=(texto.match(/\/Type \/Page\b/g)||[]).length
    assert.ok(n>=2 && n<=5,`${objetivo}: ${n} páginas`)
    assert.equal((texto.match(/SEMANA 0[1-4]/g)||[]).length,4)
    assert.equal((texto.match(/Elabora.{0,8}o:/g)||[]).length,n,'Rodapé presente em todas as páginas')
    assert.ok(bytes.length>5000)
  }
})
test('templates EmailJS possuem URLs e nomes de variáveis compatíveis',()=>{
  const a=readFileSync(new URL('../../docs/emailjs/01_confirmacao.html',import.meta.url),'utf8')
  const b=readFileSync(new URL('../../docs/emailjs/02_plano.html',import.meta.url),'utf8')
  assert.match(a,/{{to_email}}|{{nome}}/)
  assert.match(a,/{{objetivo}}/)
  assert.match(b,/href="{{link_pdf}}"/)
  assert.match(b,/{{titulo_plano}}/)
  assert.doesNotMatch(a+b,/{{{/)
})
