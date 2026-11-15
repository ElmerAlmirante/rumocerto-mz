import { marcaJpegBase64 } from './logo.js'
/** Gerador de PDF sem dependências e sem serviços pagos; Helvetica/WinAnsi (português). */
function ansi(s) {
  return String(s ?? '').replace(/[\u2013\u2014]/g,'-').replace(/[\u2018\u2019]/g,"'").replace(/[\u201c\u201d]/g,'"').replace(/\u2022/g,'-').replace(/[\u{1F300}-\u{1FAFF}]/gu,'').replace(/[^\x20-\x7e\xA0-\xFF\n]/g,'?')
}
function safeText(s) { return ansi(s).replaceAll('\\','\\\\').replaceAll('(','\\(').replaceAll(')','\\)') }
function bytes(s) { return Uint8Array.from([...s].map(c=>c.charCodeAt(0)&255)) }
/**
 * Paginação com rodapé informativo fixo: evita páginas criadas apenas
 * pelo método de elaboração e pela fonte dos dados nacionais.
 * Preserva a geração 100% gratuita no Cloudflare Worker.
 */
export function criarPDF(request, plano, options={}) {
  const date = options.date || new Date()
  const paginas = []
  let cmds = []
  let y = 687
  let pageNum = 0
  const LIMITE_CONTEUDO = 96
  const ESQUERDA = 49
  const DIREITA = 547
  const textoFonte = 'Fonte dos indicadores: data.worldbank.org/indicator/SL.UEM.1524.ZS?locations=MZ'

  function texto(s,x,yy,size=10,bold=false,color='0.12 0.20 0.29') {
    cmds.push(color+' rg BT /'+(bold?'FB':'F')+' '+size+' Tf 1 0 0 1 '+x+' '+yy+' Tm ('+safeText(s)+') Tj ET')
  }
  function rect(x,yy,w,h,cor) { cmds.push(cor+' rg '+x+' '+yy+' '+w+' '+h+' re f') }
  function traco(x1,yy,x2,yy2) {cmds.push('0.80 0.90 0.90 RG 0.7 w '+x1+' '+yy+' m '+x2+' '+yy2+' l S')}

  // Estimativa conservadora da largura das letras em Helvetica (pontos).
  // Também quebra palavras muito longas para não saírem da página.
  function largura(s,size,bold=false) {
    let u=0
    for(const c of s) {
      if(c===' ') u+=0.28
      else if('.,:;!|ilItfj'.includes(c)) u+=0.29
      else if('MW@%#'.includes(c)) u+=0.86
      else if(/[A-ZÁÉÍÓÚÀÂÊÔÃÕÇ]/.test(c)) u+=0.66
      else u+=0.53
    }
    return u*size*(bold?1.07:1)
  }
  function quebrarLargura(s,maxWidth,size=10,bold=false) {
    const words=ansi(s).replace(/\s+/g,' ').trim().split(' ').filter(Boolean)
    const lines=[]; let line=''
    for(let word of words) {
      const candidate=line?line+' '+word:word
      if(largura(candidate,size,bold)<=maxWidth) {line=candidate;continue}
      if(line){lines.push(line);line=''}
      while(word && largura(word,size,bold)>maxWidth) {
        let part=''
        while(word && largura(part+word[0],size,bold)<=maxWidth) {part+=word[0];word=word.slice(1)}
        if(!part){part=word[0];word=word.slice(1)}
        lines.push(part)
      }
      line=word
    }
    if(line)lines.push(line)
    return lines.length?lines:['']
  }
  function iniciar() {
    if(cmds.length) paginas.push(cmds.join('\n'))
    cmds=[]; pageNum++; y=687
    rect(0,751,595,91,'0.055 0.18 0.27')
    rect(0,744,595,7,'0.06 0.65 0.53')
    texto('RumoCerto MZ',48,793,24,true,'1 1 1')
    texto('Plano de desenvolvimento profissional | Grupo 8 - ISUTC',48,770,10,false,'0.75 0.95 0.89')
    texto('PLANO EDUCATIVO  |  30 DIAS  |  GRATUITO',48,719,9,true,'0.06 0.57 0.47')
    cmds.push('q 63 0 0 63 486 765 cm /ImLogo Do Q')

    // Nota metodológica e fonte permanecem sempre no rodapé e nunca
    // iniciam uma página adicional. Informação clara para o docente.
    rect(0,0,595,80,'0.89 0.94 0.95')
    traco(0,80,595,80)
    texto('Elaboração: '+(plano.metodo||'Orientação educativa'),ESQUERDA,61,8,false,'0.12 0.31 0.39')
    texto(textoFonte,ESQUERDA,47,7.6,false,'0.12 0.31 0.39')
    texto('RumoCerto MZ | Orientação - sem promessa de emprego',ESQUERDA,23,8)
    texto('Página '+pageNum,520,23,8)
  }
  function garantir(necessario) { if(y-necessario<LIMITE_CONTEUDO)iniciar() }
  function linha(s,opts={}) {
    const sz=opts.size||10
    const lh=opts.lineHeight||14
    const indent=opts.indent||0
    const parts=quebrarLargura(s,DIREITA-(ESQUERDA+indent),sz,Boolean(opts.bold))
    for(const part of parts) {
      garantir(lh)
      texto(part,ESQUERDA+indent,y,sz,Boolean(opts.bold),opts.color||'0.12 0.20 0.29')
      y-=lh
    }
    y-=opts.after||0
  }
  function titulo(s) {
    const parts=quebrarLargura(s,DIREITA-ESQUERDA,13,true)
    garantir(parts.length*18+29)
    y-=6
    for(const part of parts){texto(part,ESQUERDA,y,13,true,'0.05 0.51 0.45');y-=18}
    traco(ESQUERDA,y+4,DIREITA,y+4)
    y-=8
  }
  function semana(s) {
    // O Gemini pode devolver "Semana 1: ..."; o prefixo já é impresso por nós.
    const tituloLimpo=String(s.titulo||'Actividades da semana')
      .replace(/^\s*semana\s*0*[1-4]\s*[:\-–—|]\s*/i,'').trim() || 'Actividades da semana'
    const heading='SEMANA '+String(s.numero).padStart(2,'0')+'  |  '+tituloLimpo
    const headingLines=quebrarLargura(heading,470,12,true)
    const minutos=s.tarefas.reduce((total,t)=>total+Number(String(t).match(/^\s*\((\d+)\s*min\)/i)?.[1]||0),0)
    // Não deixar o título da semana isolado no final da página.
    garantir(headingLines.length*17+46)
    y-=2
    rect(ESQUERDA,y-(headingLines.length*17+9),498,headingLines.length*17+19,'0.92 0.97 0.96')
    rect(ESQUERDA,y-(headingLines.length*17+9),4,headingLines.length*17+19,'0.06 0.65 0.53')
    for(const part of headingLines) { texto(part,ESQUERDA+12,y-3,12,true,'0.05 0.39 0.38');y-=17 }
    y-=17
    linha(s.foco,{size:9.5,after:5,color:'0.25 0.36 0.45'})
    // Duração estimada apenas a partir dos valores realmente presentes nas tarefas.
    if(minutos>0)linha('Tempo sugerido para as actividades: '+minutos+' minutos (ajusta ao teu ritmo).',
      {size:8.5,after:5,color:'0.25 0.43 0.46'})
    for(const [i,t] of s.tarefas.entries()) {
      const sz=9.5, lh=13
      const parts=quebrarLargura(t,459,sz,false)
      // Se esta for a última tarefa, colocá-la junto da evidência e da métrica.
      const margemFinal=i===s.tarefas.length-1?53:3
      garantir(parts.length*lh+margemFinal)
      texto(String(i+1)+'.',ESQUERDA+7,y,sz,true,'0.05 0.51 0.45')
      for(const part of parts){texto(part,ESQUERDA+29,y,sz);y-=lh}
      y-=1
    }
    garantir(37) // manter a evidência e o critério de avaliação juntos
    linha('Evidência: '+s.entregavel,{size:9.5,bold:true,after:2})
    linha('Como medir: '+s.metrica,{size:9.5,after:8})
  }

  iniciar()
  titulo(plano.titulo)
  linha('Data de geração: '+new Intl.DateTimeFormat('pt-PT',{dateStyle:'medium',timeZone:'Africa/Maputo'}).format(date),{size:9,after:7})
  linha('Área: '+request.area+'  |  Situação: '+request.situacao,{bold:true,after:4})
  linha('Objectivo: '+request.objetivo,{after:5})
  linha('Disponibilidade: '+request.disponibilidade+'  |  Internet: '+request.internet,{after:5})
  if(request.dificuldade)linha('Dificuldade a considerar: '+request.dificuldade,{after:5})
  titulo('Diagnóstico e estratégia')
  linha(plano.diagnostico,{after:5})
  linha(plano.estrategia,{after:10})
  for(const s of plano.semanas) semana(s)
  titulo('Recursos e cuidados')
  for(const t of [...plano.recursos,...plano.avisos])linha('- '+t,{size:9.5,lineHeight:13,after:5})
  paginas.push(cmds.join('\n'))
  const objects=[]
  function add(obj){objects.push(obj);return objects.length}
  const catalog=add(''); const pagesId=add('');const fontRegular=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');const fontBold=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>')
  const jpeg = atob(marcaJpegBase64)
  const imgId = add('<< /Type /XObject /Subtype /Image /Width 180 /Height 180 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length '+jpeg.length+' >>\nstream\n'+jpeg+'\nendstream')
  const pageIds=[]
  for(const str of paginas){const content=add('<< /Length '+bytes(str).length+' >>\nstream\n'+str+'\nendstream');const page=add('<< /Type /Page /Parent '+pagesId+' 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F '+fontRegular+' 0 R /FB '+fontBold+' 0 R >> /XObject << /ImLogo '+imgId+' 0 R >> >> /Contents '+content+' 0 R >>');pageIds.push(page)}
  objects[catalog-1]='<< /Type /Catalog /Pages '+pagesId+' 0 R >>'
  objects[pagesId-1]='<< /Type /Pages /Count '+pageIds.length+' /Kids ['+pageIds.map(n=>n+' 0 R').join(' ')+'] >>'
  let document='%PDF-1.4\n%âãÏÓ\n';const offsets=[0]
  for(let i=0;i<objects.length;i++){offsets.push(bytes(document).length);document+=(i+1)+' 0 obj\n'+objects[i]+'\nendobj\n'}
  const xref=bytes(document).length
  document+='xref\n0 '+(objects.length+1)+'\n0000000000 65535 f \n'
  for(const n of offsets.slice(1))document+=String(n).padStart(10,'0')+' 00000 n \n'
  document+='trailer\n<< /Size '+(objects.length+1)+' /Root '+catalog+' 0 R >>\nstartxref\n'+xref+'\n%%EOF\n'
  return bytes(document)
}
export function pdfBase64(pdfBytes){let str='';for(let i=0;i<pdfBytes.length;i+=16384)str+=String.fromCharCode(...pdfBytes.subarray(i,i+16384));return btoa(str)}
