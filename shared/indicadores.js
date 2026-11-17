export const indicadores = Object.freeze([
  { codigo: 'SL.UEM.1524.ZS', titulo: 'Desemprego juvenil', etiqueta: 'Total', descricao: 'Percentagem de desempregados na força de trabalho dos 15–24 anos, ambos os sexos.' },
  { codigo: 'SL.UEM.1524.FE.ZS', titulo: 'Desemprego juvenil', etiqueta: 'Mulheres', descricao: 'Percentagem de desempregadas na força de trabalho feminina dos 15–24 anos.' },
  { codigo: 'SL.UEM.1524.MA.ZS', titulo: 'Desemprego juvenil', etiqueta: 'Homens', descricao: 'Percentagem de desempregados na força de trabalho masculina dos 15–24 anos.' }
])
export const consultarIndicador = codigo => indicadores.find(i => i.codigo === codigo) || null
export function normalizarSerieBancoMundial(resposta) {
  if (!Array.isArray(resposta) || !Array.isArray(resposta[1])) throw new Error('Formato inesperado da API')
  return resposta[1].filter(p => p && p.value !== null && p.value !== undefined && Number.isFinite(Number(p.value)))
    .map(p => ({ ano: Number(p.date), valor: Number(p.value) }))
    .filter(p => Number.isInteger(p.ano) && p.ano >= 1960)
    .sort((a, b) => a.ano - b.ano)
}
export const formatarTaxa = valor => Number.isFinite(valor) ? new Intl.NumberFormat('pt-MZ', { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(valor) + '%' : '—'
export function criarCSV(serie) { return '\uFEFFano;taxa_percentagem\n' + serie.map(p => `${p.ano};${String(p.valor).replace('.', ',')}`).join('\n') }
