const CAMPOS = ['area', 'situacao', 'objetivo', 'disponibilidade', 'internet', 'competencias', 'dificuldade']

export function assinaturaPerfil(perfil) {
  return JSON.stringify(CAMPOS.map(campo => String(perfil?.[campo] || '').trim()))
}

export function substituirPlano(estado, novoPlano, perfil) {
  const novaAssinatura = assinaturaPerfil(perfil)
  const estruturaIgual = Boolean(estado.plano && JSON.stringify(estado.plano.semanas?.map(s => s.tarefas)) === JSON.stringify(novoPlano?.semanas?.map(s => s.tarefas)))
  const manter = Boolean(estado.plano && novaAssinatura === estado.assinatura && estruturaIgual)
  return {
    ...estado,
    plano: novoPlano,
    perfilDoPlano: { ...perfil },
    assinatura: novaAssinatura,
    concluidas: manter ? [...estado.concluidas] : []
  }
}
