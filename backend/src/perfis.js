/** Percursos gratuitos determinísticos para orientar sem consumir quotas de IA. */
const perfil = (nome, titulo, focos, tarefas, entregaveis, recursos = []) => ({ nome, titulo, focos, tarefas, entregaveis, recursos })

const PERFIS = {
  vue: perfil('Vue.js', 'Aprender Vue.js com um projecto demonstrável',
    ['Fundamentos de JavaScript e Vue 3','Componentes e formulários','Rotas e dados','Testes e apresentação'], [
    ['Rever funções e arrays com dois exercícios de JavaScript.', 'Criar um projecto Vue 3 e identificar App.vue e main.js.', 'Construir um componente com interpolação e v-bind.', 'Praticar v-if, v-for e v-model num pequeno formulário.'],
    ['Separar a interface em três componentes com props.', 'Enviar um evento de um componente filho ao componente pai.', 'Criar e validar um formulário acessível.', 'Utilizar ref e computed para actualizar o ecrã.'],
    ['Definir um catálogo simples de recursos de estudo.', 'Criar duas páginas ligadas por Vue Router.', 'Ler dados de um ficheiro JSON local ou de uma API pública.', 'Tratar carregamento, lista vazia e erro sem bloquear a página.'],
    ['Testar formulário e rotas em ecrã móvel.', 'Corrigir pelo menos dois problemas observados.', 'Escrever um README com instruções claras.', 'Fazer demonstração de três minutos e recolher feedback.'],
  ], ['Protótipo Vue com exemplos de directivas','Formulário com três componentes','Mini-aplicação com duas rotas e dados','Projecto documentado e apresentado'],
  ['Vue 3: https://vuejs.org/guide/introduction.html','Vue Router: https://router.vuejs.org/','JavaScript: https://developer.mozilla.org/pt-BR/docs/Web/JavaScript']),
  web: perfil('Desenvolvimento Web','Criar uma aplicação Web útil',
    ['Objectivo e estrutura','Interface responsiva','Interacções e dados','Publicação e avaliação'], [
    ['Escolher um problema local que possa ser resolvido com uma página Web.', 'Desenhar no papel o ecrã inicial e o fluxo do utilizador.', 'Criar o HTML semântico da página principal.', 'Escrever uma lista de requisitos básicos com prioridade.'],
    ['Definir estilos CSS para telemóveis antes de computadores.', 'Criar uma navegação simples e acessível.', 'Melhorar etiquetas e contraste dos campos.', 'Testar tamanhos de ecrã diferentes no navegador.'],
    ['Criar um formulário com validação em JavaScript.', 'Guardar preferências não sensíveis no navegador.', 'Mostrar uma lista de dados locais em JSON.', 'Apresentar estados de erro e vazio ao utilizador.'],
    ['Executar testes manuais de navegação e formulário.', 'Corrigir três defeitos encontrados.', 'Criar README com objectivo e tecnologias.', 'Publicar uma demonstração sem dados pessoais.'],
  ], ['Página HTML e mapa de navegação','Interface responsiva testada','Protótipo interactivo com dados','Demonstração Web com README'],
  ['MDN Web Docs: https://developer.mozilla.org/pt-BR/docs/Web']),
  python: perfil('Python','Aprender Python com exercícios verificáveis',
    ['Fundamentos','Colecções e funções','Mini-projecto','Revisão e portefólio'], [
    ['Preparar Python ou um ambiente educativo gratuito.', 'Criar exercícios com variáveis e condições.', 'Resolver três problemas com ciclos.', 'Guardar resultados e erros num caderno de estudo.'],
    ['Praticar listas, dicionários e funções.', 'Ler um ficheiro CSV simples de dados fictícios.', 'Adicionar tratamento de erros ao programa.', 'Explicar por escrito a lógica de dois exercícios.'],
    ['Escolher um problema pequeno de organização de dados.', 'Desenhar entradas, processamento e saídas.', 'Implementar uma primeira versão em Python.', 'Testar com três conjuntos de dados fictícios.'],
    ['Corrigir erros identificados nos testes.', 'Organizar ficheiros e criar README.', 'Apresentar uma demonstração de três minutos.', 'Definir uma competência para estudar no mês seguinte.'],
  ], ['Colecção de exercícios básicos','Funções e leitura de CSV','Script funcional com dados fictícios','Mini-projecto documentado'],
  ['Tutorial Python: https://docs.python.org/3/tutorial/']),
  redes: perfil('Redes informáticas','Demonstrar competências práticas em redes',
    ['Conceitos de rede','Endereçamento e diagnóstico','Topologia e serviços','Demonstração e documentação'], [
    ['Identificar dispositivos e funções de uma rede local.', 'Desenhar a topologia de uma rede doméstica sem divulgar senhas.', 'Rever IPv4, máscara, gateway e DNS.', 'Criar um glossário com dez conceitos de rede.'],
    ['Resolver exercícios de sub-redes IPv4.', 'Praticar ping e traceroute em ambiente autorizado.', 'Registar sintomas de três falhas comuns de conectividade.', 'Propor um roteiro de diagnóstico seguro.'],
    ['Simular uma rede de dois computadores e um router.', 'Configurar endereços numa ferramenta de simulação gratuita.', 'Testar resolução de nomes e comunicação entre máquinas.', 'Guardar uma captura da topologia e resultados.'],
    ['Documentar configuração sem credenciais.', 'Comparar resultados esperados e observados.', 'Apresentar a simulação a um colega.', 'Definir próximos exercícios de redes.'],
  ], ['Topologia e glossário','Ficha de sub-redes e diagnóstico','Simulação validada','Relatório breve de demonstração'],
  ['Referências de redes: https://www.cloudflare.com/learning/network-layer/']),
  dados: perfil('Dados e folhas de cálculo','Construir um painel simples com dados',
    ['Definir uma pergunta','Preparar os dados','Analisar e visualizar','Rever conclusões'], [
    ['Escolher uma pergunta concreta relacionada com a tua área.', 'Identificar um dataset público ou criar dados de exemplo fictícios.', 'Definir colunas, unidades e fonte.', 'Registar os limites dos dados disponíveis.'],
    ['Limpar valores em branco e duplicados numa folha de cálculo.', 'Organizar uma tabela com nomes de colunas claros.', 'Calcular totais e percentagens sem inventar valores.', 'Guardar uma cópia com indicação da origem.'],
    ['Criar dois gráficos legíveis.', 'Explicar em linguagem simples o que cada gráfico mostra.', 'Verificar se títulos e unidades estão correctos.', 'Montar uma página-resumo com três observações.'],
    ['Rever cálculos e fórmulas.', 'Pedir revisão de uma pessoa.', 'Corrigir conclusões que ultrapassem os dados.', 'Preparar o ficheiro final e uma explicação oral.'],
  ], ['Pergunta e dicionário de dados','Tabela limpa com fórmulas','Painel de dois gráficos','Relatório curto com limitações'],
  ['Dados de Moçambique: https://data.worldbank.org/country/mozambique','LibreOffice: https://www.libreoffice.org/']),
  portfolio: perfil('Portefólio e CV','Criar um portefólio profissional verificável',
    ['Seleccionar evidências','Construir CV e apresentação','Organizar portefólio','Rever e preparar partilha'], [
    ['Escolher três competências relevantes para a área de interesse.', 'Reunir projectos, trabalhos e certificados próprios.', 'Escrever a descrição de duas experiências reais, incluindo actividades académicas.', 'Definir que dados pessoais não serão publicados.'],
    ['Criar CV de uma página com informação verdadeira.', 'Escrever apresentação profissional de 70 a 100 palavras.', 'Pedir a um colega para verificar clareza e ortografia.', 'Exportar o CV em PDF leve.'],
    ['Organizar duas a quatro evidências com contexto e resultados.', 'Criar um portefólio simples em PDF ou site gratuito.', 'Explicar o teu contributo em cada projecto.', 'Rever acessibilidade e tamanho dos ficheiros.'],
    ['Testar se documentos abrem num telemóvel.', 'Retirar dados sensíveis e corrigir erros.', 'Ensaiar apresentação de dois minutos.', 'Definir um novo projecto para acrescentar ao portefólio.'],
  ], ['Inventário de competências e evidências','CV e apresentação curta','Portefólio com dois trabalhos reais','Portefólio revisto e apresentação'],
  ['Guia de carreira ILO: https://www.ilo.org/']),
  entrevista: perfil('Preparação para entrevistas','Preparar entrevistas de emprego ou estágio',
    ['Mapear competências','Respostas com exemplos','Simulação de entrevista','Melhorias e continuidade'], [
    ['Pesquisar o perfil da função pretendida sem assumir vagas abertas.', 'Listar cinco competências pessoais e técnicas com exemplos.', 'Preparar uma apresentação de um minuto.', 'Anotar perguntas relevantes para fazer ao recrutador.'],
    ['Responder por escrito a cinco perguntas frequentes.', 'Usar exemplos verdadeiros no formato situação-acção-resultado.', 'Preparar uma explicação de um projecto académico.', 'Identificar respostas que precisam de mais clareza.'],
    ['Fazer uma entrevista simulada com colega.', 'Praticar comunicação clara e escuta activa.', 'Registar comentários e melhorar duas respostas.', 'Preparar documentos que possam ser solicitados sem os divulgar.'],
    ['Repetir a entrevista simulada.', 'Comparar evolução com o primeiro ensaio.', 'Rever critérios de segurança contra anúncios falsos.', 'Criar plano de preparação para uma oportunidade real verificada.'],
  ], ['Mapa de competências e apresentação','Respostas escritas com exemplos','Primeira simulação e feedback','Roteiro final de entrevista'],
  ['Orientação de emprego OIT: https://www.ilo.org/']),
  negocio: perfil('Negócio e empreendedorismo','Validar uma ideia de negócio de baixo custo',
    ['Problema e público','Proposta de valor e custos','Teste pequeno e seguro','Ajustes e próximos passos'], [
    ['Definir uma necessidade observada na comunidade.', 'Descrever o público-alvo sem recolher dados sensíveis.', 'Listar três alternativas existentes.', 'Formular a proposta de valor numa frase.'],
    ['Desenhar um modelo simples de funcionamento.', 'Estimar materiais, tempo e despesas em MT com pressupostos explícitos.', 'Distinguir preço, custo e margem com exemplo fictício.', 'Criar uma ficha de controlo de gastos.'],
    ['Preparar amostra, protótipo ou demonstração de baixo custo.', 'Pedir opinião voluntária a duas pessoas.', 'Registar comentários sem nomes ou contactos.', 'Rever preços estimados e limitações.'],
    ['Actualizar proposta após feedback.', 'Preparar uma apresentação de dois minutos.', 'Listar riscos operacionais e legais a verificar.', 'Definir um teste futuro antes de investir dinheiro.'],
  ], ['Descrição da ideia e público','Tabela de custos e proposta de valor','Protótipo e síntese de feedback','Plano de validação e riscos'],
  ['Recursos de empreendedorismo OIT: https://www.ilo.org/']),
  gestao: perfil('Gestão','Melhorar um processo de organização ou gestão',
    ['Seleccionar um processo','Medir e organizar','Propor uma solução','Avaliar o protótipo'], [
    ['Escolher uma actividade de gestão que conheças.', 'Desenhar os passos e responsabilidades actuais.', 'Identificar uma dificuldade específica.', 'Definir dois indicadores simples de melhoria.'],
    ['Criar uma folha de cálculo com dados fictícios.', 'Aplicar fórmulas para totais e controlo de gastos.', 'Preparar um quadro semanal de tarefas.', 'Rever riscos de erros de introdução de dados.'],
    ['Propor novo fluxo com menos passos desnecessários.', 'Criar um modelo de formulário ou relatório.', 'Simular o processo com dados de exemplo.', 'Registar tempos e limitações observados.'],
    ['Comparar indicadores antes e depois da simulação.', 'Corrigir modelos com base no feedback.', 'Apresentar proposta em cinco diapositivos.', 'Planear como testar com pessoas autorizadas.'],
  ], ['Mapa de processo e métricas','Folha de cálculo com fórmulas','Protótipo administrativo','Proposta e avaliação'],
  ['LibreOffice: https://www.libreoffice.org/']),
  educacao: perfil('Educação','Criar uma aula e materiais de aprendizagem',
    ['Objectivos pedagógicos','Actividades e materiais','Ensaio e avaliação','Revisão e apresentação'], [
    ['Escolher um tema adequado ao nível de ensino.', 'Definir dois objectivos observáveis.', 'Verificar conteúdos em material curricular confiável.', 'Elaborar uma sequência de introdução, prática e conclusão.'],
    ['Criar plano de aula de 20 a 30 minutos.', 'Preparar um exercício com instruções simples.', 'Criar um material acessível para uso offline.', 'Construir perguntas de verificação da aprendizagem.'],
    ['Ensaiar a explicação com um colega.', 'Medir duração e identificar dificuldades.', 'Rever linguagem e exemplos para o público.', 'Anotar comentários sem dados pessoais.'],
    ['Corrigir o plano e os materiais.', 'Criar versão final em PDF leve.', 'Preparar uma apresentação de cinco minutos.', 'Definir como avaliar resultados numa aula futura.'],
  ], ['Objectivos e sequência didáctica','Plano de aula e exercício','Ensaio com feedback','Conjunto de materiais revisto']),
  saude: perfil('Literacia em saúde','Produzir comunicação educativa responsável em saúde',
    ['Tema e fontes verificáveis','Organização da mensagem','Material educativo','Revisão técnica'], [
    ['Escolher um tema de saúde pública sem dar diagnósticos.', 'Consultar fontes oficiais como OMS ou Ministério da Saúde.', 'Definir público e duas mensagens essenciais.', 'Registar referência e data das fontes.'],
    ['Resumir informações factuais em linguagem simples.', 'Distinguir prevenção e sinais que exigem apoio profissional.', 'Evitar recomendações individuais de tratamento.', 'Rever termos ambíguos com fontes confiáveis.'],
    ['Criar um folheto de uma página.', 'Verificar legibilidade e acessibilidade em telemóvel.', 'Incluir contactos de serviços apenas se forem confirmados.', 'Recolher comentários sobre clareza sem recolher dados clínicos.'],
    ['Solicitar revisão de profissional/orientador quando possível.', 'Corrigir erros e indicar limitações.', 'Publicar apenas informação não personalizada.', 'Documentar fontes e plano de actualização.'],
  ], ['Tema e bibliografia','Mensagens com fontes','Folheto educativo','Folheto revisto e fontes'],
  ['OMS: https://www.who.int/','Ministério da Saúde de Moçambique: https://www.misau.gov.mz/']),
  design: perfil('Comunicação e design','Criar uma peça visual para o portefólio',
    ['Briefing e referências','Primeiros conceitos','Peça final','Testes e apresentação'], [
    ['Definir público e mensagem de uma peça de comunicação.', 'Criar um briefing de uma página.', 'Recolher referências próprias ou de uso permitido.', 'Desenhar dois esboços com estilos distintos.'],
    ['Escolher paleta e tipografia acessíveis.', 'Produzir dois conceitos num editor gratuito.', 'Testar legibilidade em telemóvel.', 'Seleccionar conceito com justificativa.'],
    ['Criar a peça final com materiais de uso autorizado.', 'Exportar versão digital leve.', 'Documentar escolhas de cor e composição.', 'Criar uma apresentação com antes/depois.'],
    ['Pedir feedback a duas pessoas.', 'Corrigir contraste, alinhamentos e ortografia.', 'Preparar ficha de projecto para portefólio.', 'Definir uma peça complementar para o futuro.'],
  ], ['Briefing e dois esboços','Duas propostas comparadas','Peça final e ficha técnica','Peça revista e apresentação'],
  ['Inkscape: https://inkscape.org/','GIMP: https://www.gimp.org/']),
}

const casa = s => String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
export function escolherPerfil(p) {
  const o=casa(p.objetivo), a=casa(p.area)
  if(a.includes('tecnologia') && /vue(\.js)?/.test(o)) return PERFIS.vue
  if(a.includes('tecnologia') && /python/.test(o)) return PERFIS.python
  if(a.includes('tecnologia') && /(rede|cisco|router|vlan|packet tracer)/.test(o)) return PERFIS.redes
  if(/(entrevista|primeiro emprego|estagio|recrutad)/.test(o)) return PERFIS.entrevista
  if(/(portefolio|portfolio|curricul|\bcv\b)/.test(o)) return PERFIS.portfolio
  if(/(empreend|negocio|vender|empresa|abrir.*loja|montar.*loja)/.test(o)) return PERFIS.negocio
  if(a.includes('tecnologia') && /(excel|dados|analise|dashboard|folha de calculo)/.test(o)) return PERFIS.dados
  if(a.includes('tecnologia') && /(web|site|html|javascript|front.?end|backend|program)/.test(o)) return PERFIS.web
  if(a.includes('administracao'))return PERFIS.gestao
  if(a.includes('educacao'))return PERFIS.educacao
  if(a.includes('saude'))return PERFIS.saude
  if(a.includes('comunicacao'))return PERFIS.design
  return null
}
export const NOMES_PERFIS=Object.keys(PERFIS)
