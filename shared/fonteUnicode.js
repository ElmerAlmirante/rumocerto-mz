function u16(v, p) { return v.getUint16(p, false) }
function i16(v, p) { return v.getInt16(p, false) }
function u32(v, p) { return v.getUint32(p, false) }
function nomeTabela(v, p) {
  return String.fromCharCode(v.getUint8(p), v.getUint8(p + 1), v.getUint8(p + 2), v.getUint8(p + 3))
}

export function carregarFonteTTF(buffer) {
  const dados = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
  if (dados.byteLength < 100) throw new Error('Fonte inválida')
  const v = new DataView(dados.buffer, dados.byteOffset, dados.byteLength)
  const tabelas = new Map()
  for (let i = 0, quantidade = u16(v, 4); i < quantidade; i++) {
    const p = 12 + i * 16
    if (p + 16 > dados.byteLength) throw new Error('Tabela da fonte incompleta')
    const offset = u32(v, p + 8)
    const tamanho = u32(v, p + 12)
    if (offset + tamanho > dados.byteLength) throw new Error('Fonte truncada')
    tabelas.set(nomeTabela(v, p), offset)
  }
  for (const tag of ['head', 'hhea', 'hmtx', 'maxp', 'cmap']) {
    if (!tabelas.has(tag)) throw new Error(`A fonte não contém ${tag}`)
  }
  const head = tabelas.get('head')
  const unidades = u16(v, head + 18)
  const hhea = tabelas.get('hhea')
  const numMetricas = u16(v, hhea + 34)
  const hmtx = tabelas.get('hmtx')
  const cmapOffset = tabelas.get('cmap')
  const numSubtabelas = u16(v, cmapOffset + 2)
  let subtabela = 0
  let formato = 0
  let prioridade = -1
  for (let i = 0; i < numSubtabelas; i++) {
    const p = cmapOffset + 4 + i * 8
    const plataforma = u16(v, p)
    const encoding = u16(v, p + 2)
    const offset = cmapOffset + u32(v, p + 4)
    const tipo = u16(v, offset)
    const rank = tipo === 12 && plataforma === 3 && encoding === 10 ? 4 :
      tipo === 12 ? 3 : tipo === 4 && plataforma === 3 ? 2 : tipo === 4 ? 1 : 0
    if (rank > prioridade) { prioridade = rank; subtabela = offset; formato = tipo }
  }
  if (prioridade < 1) throw new Error('A fonte não tem mapa Unicode')
  let grupos = []
  if (formato === 12) {
    const quantidade = u32(v, subtabela + 12)
    for (let i = 0; i < quantidade; i++) {
      const p = subtabela + 16 + i * 12
      grupos.push([u32(v, p), u32(v, p + 4), u32(v, p + 8)])
    }
  }
  const segmentos = formato === 4 ? u16(v, subtabela + 6) / 2 : 0
  const fim = subtabela + 14
  const inicio = fim + 2 * segmentos + 2
  const delta = inicio + 2 * segmentos
  const intervalo = delta + 2 * segmentos
  function glifo(cp) {
    if (formato === 12) {
      let a = 0, b = grupos.length - 1
      while (a <= b) {
        const m = (a + b) >> 1
        const [de, ate, id] = grupos[m]
        if (cp < de) b = m - 1
        else if (cp > ate) a = m + 1
        else return id + cp - de
      }
      return 0
    }
    if (cp > 0xffff) return 0
    for (let i = 0; i < segmentos; i++) {
      if (cp > u16(v, fim + 2 * i)) continue
      if (cp < u16(v, inicio + 2 * i)) return 0
      const deslocamento = u16(v, intervalo + 2 * i)
      if (!deslocamento) return (cp + i16(v, delta + 2 * i)) & 65535
      const p = intervalo + 2 * i + deslocamento + 2 * (cp - u16(v, inicio + 2 * i))
      const id = u16(v, p)
      return id ? (id + i16(v, delta + 2 * i)) & 65535 : 0
    }
    return 0
  }
  function avancar(gid) {
    return u16(v, hmtx + Math.min(gid, numMetricas - 1) * 4) * 1000 / unidades
  }
  return {
    dados, glifo, avancar,
    ascendente: i16(v, hhea + 4) * 1000 / unidades,
    descendente: i16(v, hhea + 6) * 1000 / unidades,
    caixa: [36, 38, 40, 42].map(p => i16(v, head + p) * 1000 / unidades),
    usados: new Map()
  }
}

export function textoFonte(texto, fonte) {
  let final = ''
  for (const ch of String(texto).normalize('NFC')) {
    const cp = ch.codePointAt(0)
    if (cp === 10 || cp === 13) { final += ' '; continue }
    if (!fonte.glifo(cp)) {
      final += `[U+${cp.toString(16).toUpperCase().padStart(4, '0')}]`
    } else final += ch
  }
  return final
}

export function larguraFonte(texto, tamanho, fonte) {
  let total = 0
  for (const ch of textoFonte(texto, fonte)) total += fonte.avancar(fonte.glifo(ch.codePointAt(0)))
  return total * tamanho / 1000
}

export function textoCodificado(texto, fonte) {
  let hexadecimal = ''
  for (const ch of textoFonte(texto, fonte)) {
    const cp = ch.codePointAt(0)
    const gid = fonte.glifo(cp)
    fonte.usados.set(gid, cp)
    hexadecimal += gid.toString(16).padStart(4, '0')
  }
  return `<${hexadecimal}>`
}

function hexUnicode(cp) {
  if (cp <= 65535) return cp.toString(16).padStart(4, '0')
  const n = cp - 65536
  return ((0xd800 + (n >> 10)).toString(16).padStart(4, '0')) + ((0xdc00 + (n & 1023)).toString(16).padStart(4, '0'))
}

function textoBinario(bytes) {
  let result = ''
  for (let i = 0; i < bytes.length; i += 4096) {
    result += String.fromCharCode(...bytes.subarray(i, i + 4096))
  }
  return result
}

export function objectosFonte(fonte, adicionar) {
  const binario = textoBinario(fonte.dados)
  const referenciaArquivo = adicionar(`<< /Length ${fonte.dados.length} /Length1 ${fonte.dados.length} >>\nstream\n${binario}\nendstream`)
  const desc = adicionar(`<< /Type /FontDescriptor /FontName /RumoUnicodeFont /Flags 32 /FontBBox [${fonte.caixa.map(Math.round).join(' ')}] /ItalicAngle 0 /Ascent ${Math.round(fonte.ascendente)} /Descent ${Math.round(fonte.descendente)} /CapHeight ${Math.round(fonte.ascendente)} /StemV 85 /FontFile2 ${referenciaArquivo} 0 R >>`)
  const widths = [...fonte.usados].filter(([gid]) => gid).sort((a, b) => a[0] - b[0])
    .map(([gid]) => `${gid} [${Math.round(fonte.avancar(gid))}]`).join(' ')
  const descendente = adicionar(`<< /Type /Font /Subtype /CIDFontType2 /BaseFont /RumoUnicodeFont /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor ${desc} 0 R /CIDToGIDMap /Identity /DW 1000 /W [${widths}] >>`)
  const pares = [...fonte.usados].sort((a, b) => a[0] - b[0])
    .map(([gid, cp]) => `<${gid.toString(16).padStart(4, '0')}> <${hexUnicode(cp)}>`)
  let mapa = '/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n/CMapName /RumoUnicode def\n/CMapType 2 def\n1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n'
  for (let i = 0; i < pares.length; i += 100) {
    const bloco = pares.slice(i, i + 100)
    mapa += `${bloco.length} beginbfchar\n${bloco.join('\n')}\nendbfchar\n`
  }
  mapa += 'endcmap\nCMapName currentdict /CMap defineresource pop\nend\nend'
  const cm = adicionar(`<< /Length ${mapa.length} >>\nstream\n${mapa}\nendstream`)
  return adicionar(`<< /Type /Font /Subtype /Type0 /BaseFont /RumoUnicodeFont /Encoding /Identity-H /DescendantFonts [${descendente} 0 R] /ToUnicode ${cm} 0 R >>`)
}

export async function obterFonteUnicode() {
  throw new Error('A fonte Unicode deve ser fornecida explicitamente; não descarregamos fontes externas.')
}
