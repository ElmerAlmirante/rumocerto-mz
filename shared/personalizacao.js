import { limparTexto } from './planner.js'

export function integrarSugestoesIA(base, resposta) {
  if (!resposta || typeof resposta !== 'object' || !Array.isArray(resposta.semanas) || resposta.semanas.length !== 4 ||
    typeof resposta.diagnostico !== 'string' || typeof resposta.estrategia !== 'string') return base
  const semanas=[]
  for (let i=0;i<4;i++) {
    const entrada=resposta.semanas[i]
    if (!entrada || !Array.isArray(entrada.tarefas) || entrada.tarefas.length !== base.semanas[i].tarefas.length ||
      typeof entrada.entregavel !== 'string') return base
    if (!entrada.tarefas.every(t => typeof t === 'string' && t.trim().length >= 12 && t.length <= 180) ||
      entrada.entregavel.trim().length < 8 || entrada.entregavel.length > 160) return base
    semanas.push({...base.semanas[i], tarefas:entrada.tarefas.map(t=>limparTexto(t,180)),
      entregavel:limparTexto(entrada.entregavel,160)})
  }
  if (resposta.diagnostico.trim().length < 12 || resposta.estrategia.trim().length < 12) return base
  return {...base, diagnostico:limparTexto(resposta.diagnostico,600),
    estrategia:limparTexto(resposta.estrategia,600),semanas,
    metodo:'Plano personalizado com IA e revisão das actividades'}
}
