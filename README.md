# RumoCerto MZ 🇲🇿
**Categoria:** Plataforma de desenvolvimento pessoal e orientação profissional  
**País:** Moçambique

---

## 1. Sobre o projeto

O **RumoCerto MZ** é uma plataforma digital desenvolvida para apoiar estudantes, recém-formados e pessoas que procuram desenvolver as suas competências profissionais e melhorar as suas oportunidades de carreira em Moçambique.

A plataforma permite que cada utilizador apresente o seu perfil, indique os seus objectivos profissionais, identifique as suas principais dificuldades e informe a disponibilidade de tempo e as condições de acesso à Internet.

Com base nessas informações, o sistema gera um **plano personalizado de desenvolvimento profissional de 30 dias**, dividido em quatro semanas, com tarefas práticas, objectivos, resultados esperados e indicadores de progresso.

O projecto procura tornar a orientação profissional mais acessível, prática e adaptada à realidade moçambicana, considerando diferentes áreas de formação, níveis de disponibilidade e condições de conectividade.

O RumoCerto MZ não é uma plataforma de recrutamento nem garante emprego. O seu propósito é ajudar os utilizadores a organizar os seus objectivos, desenvolver competências e acompanhar a sua evolução.

## 2. Principais funcionalidades

### 2.1. Página inicial

Apresenta a plataforma, a sua finalidade e as principais funcionalidades, permitindo ao utilizador conhecer o serviço e iniciar a criação do seu plano.

### 2.2. Criação de perfil

O utilizador fornece informações necessárias para a personalização do plano, incluindo:

- Área profissional;
- Situação actual;
- Disponibilidade semanal;
- Condições de acesso à Internet;
- Objectivos profissionais;
- Competências existentes;
- Principais dificuldades.

Os dados são validados antes de serem utilizados na geração do plano.

### 2.3. Plano de desenvolvimento de 30 dias

O sistema utiliza as informações do perfil para construir um plano de desenvolvimento profissional personalizado.

O plano está dividido em quatro semanas:

1. **Definir o ponto de partida:** estabelecer objectivos e identificar competências prioritárias.
2. **Aprender e praticar:** desenvolver conhecimentos através de actividades orientadas.
3. **Criar uma evidência:** aplicar os conhecimentos na produção de um resultado concreto.
4. **Rever e avançar:** avaliar os resultados e estabelecer a próxima meta.

Cada semana apresenta tarefas, tempo sugerido, resultados esperados e critérios de acompanhamento.

O sistema também possui orientações específicas para diferentes áreas profissionais, tornando as actividades mais relevantes para o perfil do utilizador.

### 2.4. Acompanhamento do progresso

Permite acompanhar a execução das actividades do plano.

O sistema apresenta indicadores relacionados com:

- Número total de tarefas;
- Tarefas concluídas;
- Percentagem de progresso;
- Evolução ao longo do plano.

### 2.5. Indicadores

A plataforma apresenta indicadores para ajudar o utilizador a compreender o contexto do desenvolvimento profissional.

Os indicadores são complementares à orientação individual e não representam previsões de emprego ou resultados garantidos.

### 2.6. Exportação em PDF

O plano de desenvolvimento pode ser exportado para PDF, permitindo ao utilizador guardar, consultar e acompanhar as actividades fora da plataforma.

O documento inclui o diagnóstico, a estratégia, as tarefas semanais, os resultados esperados e os avisos relevantes.

### 2.7. Personalização e persistência

A aplicação possui módulos dedicados à gestão dos dados, preferências e informações necessárias ao funcionamento da plataforma.

A persistência e a recuperação dos dados são tratadas por módulos próprios, permitindo separar essas responsabilidades da interface.

### 2.8. Comunicação por e-mail

O backend inclui funcionalidades de comunicação por e-mail, com modelos HTML destinados a diferentes situações:

- Confirmação;
- Recuperação;
- Plano de desenvolvimento.

---

## 3. Tecnologias utilizadas

O RumoCerto MZ utiliza tecnologias JavaScript modernas, separando a interface, a lógica partilhada e os serviços de backend.

| Tecnologia | Utilização |
|---|---|
| HTML5 | Estrutura da aplicação |
| CSS3 | Estilização e responsividade |
| JavaScript | Lógica da aplicação |
| Vue 3 | Desenvolvimento da interface |
| Vite | Ferramenta de desenvolvimento e build |
| Cloudflare Workers | Execução do backend |
| Wrangler | Configuração e desenvolvimento do Worker |
| Node.js | Ambiente de execução e ferramentas |
| npm | Gestão de dependências |
| GitHub Actions | Automação de publicação |
| PDF | Geração de documentos exportáveis |

---

## 4. Arquitectura do projecto

O projecto está organizado em três áreas principais:

### Frontend

Responsável pela interface visual, navegação, formulários, apresentação dos planos e acompanhamento do progresso.

Foi desenvolvido com Vue 3 e Vite.

### Backend

Responsável pelo processamento dos pedidos HTTP, operações de servidor e funcionalidades de comunicação.

É executado através de Cloudflare Workers.

### Módulos partilhados

Contêm funcionalidades utilizadas em diferentes partes da aplicação, evitando duplicação de código.

Incluem a gestão de perfis, geração de planos, indicadores, persistência e exportação PDF.

---

## 5. Estrutura de pastas

```text
rumocerto-mz/
│
├── .github/
│   └── workflows/
│       ├── deploy.yml
│       └── deploy-worker.yml
│
├── backend/
│   ├── email.js
│   ├── emailjs-modelos/
│   │   ├── confirmacao.html
│   │   ├── plano.html
│   │   └── recuperacao.html
│   ├── worker.js
│   ├── wrangler.toml
│   └── .dev.vars.example
│
├── public/
│   ├── branding/
│   │   └── simbolo.webp
│   ├── favicon-48.png
│   └── favicon.svg
│
├── scripts/
│   ├── testar-email.mjs
│   ├── testar-fluxo-http.mjs
│   ├── testar-webhook-http.mjs
│   ├── verificar-producao.mjs
│   └── verificar-vue.mjs
│
├── shared/
│   ├── estado.js
│   ├── fonteUnicode.js
│   ├── indicadores.js
│   ├── pdf.js
│   ├── perfis.js
│   ├── persistencia.js
│   ├── personalizacao.js
│   ├── planner.js
│   └── versao.js
│
├── src/
│   ├── assets/
│   │   └── styles/
│   │       ├── acabamentos.css
│   │       ├── base.css
│   │       ├── formulario.css
│   │       ├── paginas.css
│   │       └── responsivo.css
│   │
│   ├── components/
│   │   ├── AppFooter.vue
│   │   ├── AppHeader.vue
│   │   ├── EstadoDados.vue
│   │   ├── GraficoLinha.vue
│   │   ├── IndicadorCard.vue
│   │   └── WeekCard.vue
│   │
│   ├── composables/
│   │   ├── useIndicador.js
│   │   └── usePlano.js
│   │
│   ├── views/
│   │   ├── DetalheView.vue
│   │   ├── IndicadoresView.vue
│   │   ├── InicioView.vue
│   │   ├── NaoEncontradoView.vue
│   │   ├── PlanoView.vue
│   │   ├── ProgressoView.vue
│   │   └── SobreView.vue
│   │
│   ├── App.vue
│   ├── main.js
│   ├── router/
│   │   └── index.js
│   └── assets/
│       └── styles.css
│
├── tests/
│   ├── fixtures/
│   │   └── servico-publicacao-simulado.mjs
│   ├── api.test.js
│   ├── estado.test.js
│   ├── persistencia.test.js
│   ├── plano.test.js
│   ├── publicacao.test.js
│   ├── reforcos38.test.js
│   └── textos.test.js
│
├── .env.example
├── .gitignore
├── index.html
├── package.json
├── package-lock.json
└── vite.config.js
```

### Responsabilidade dos principais módulos

| Ficheiro | Responsabilidade |
|---|---|
| `src/main.js` | Inicialização da aplicação Vue |
| `src/App.vue` | Componente principal |
| `src/router/index.js` | Gestão da navegação |
| `src/views/` | Páginas da aplicação |
| `src/components/` | Componentes reutilizáveis |
| `src/composables/` | Lógica reutilizável da interface |
| `shared/perfis.js` | Validação e gestão dos perfis |
| `shared/planner.js` | Geração dos planos de 30 dias |
| `shared/indicadores.js` | Gestão dos indicadores |
| `shared/persistencia.js` | Operações de persistência |
| `shared/estado.js` | Gestão do estado |
| `shared/pdf.js` | Geração de documentos PDF |
| `backend/worker.js` | Backend e processamento dos pedidos |
| `backend/email.js` | Funcionalidades de comunicação por e-mail |
| `backend/wrangler.toml` | Configuração do Cloudflare Worker |
| `tests/` | Testes automatizados |

---

## 6. Requisitos para instalação

Antes de executar o projecto, é necessário ter instalado:

- Node.js;
- npm (incluído na instalação do Node.js);
- Git (opcional, mas recomendado);
- Visual Studio Code ou outro editor de código.

Recomenda-se utilizar uma versão LTS do Node.js compatível com as dependências do projecto.

Para verificar se o Node.js e o npm estão instalados, execute:

```bash
node -v
npm -v
```

---

## 7. Instalação do projecto

### 7.1. Clonar o repositório

Caso esteja a obter o projecto através do GitHub:

```bash
git clone URL_DO_REPOSITORIO
```

Entre na pasta:

```bash
cd rumocerto-mz
```

### 7.2. Instalar as dependências

Execute:

```bash
npm install
```

Este comando instala as dependências necessárias para executar e desenvolver a aplicação.

O ficheiro `package-lock.json` mantém o registo das versões das dependências instaladas.

### 7.3. Configurar as variáveis de ambiente

Na raiz do projecto existe o ficheiro:

```text
.env.example
```

Crie uma cópia com o nome:

```text
.env
```

Na pasta `backend`, existe também:

```text
.dev.vars.example
```

Utilize-o como referência para criar o ficheiro de variáveis locais do backend, conforme a configuração do Cloudflare Wrangler.

Preencha as variáveis necessárias de acordo com os serviços utilizados.

**Importante:** não publique ficheiros `.env` ou `.dev.vars` com credenciais, tokens ou chaves privadas no GitHub.

---

## 8. Executar o projecto localmente

### 8.1. Iniciar o frontend

Na pasta principal do projecto, execute:

```bash
npm run dev
```

O Vite iniciará o servidor de desenvolvimento e apresentará no terminal o endereço local da aplicação.

Normalmente, o endereço é:

```text
http://localhost:5173/
```

Abra o endereço apresentado no navegador.

### 8.2. Executar o backend

O backend utiliza Cloudflare Workers e Wrangler.

Para executar o Worker localmente, é necessário ter as dependências e as variáveis locais devidamente configuradas.

O comando habitual de desenvolvimento é:

```bash
npx wrangler dev
```

A configuração do Worker encontra-se em:

```text
backend/wrangler.toml
```

Execute o comando a partir da localização adequada à configuração do projecto.

**Nota:** a execução local do frontend e do backend deve respeitar os endereços e as configurações de comunicação definidos na aplicação.

---

## 9. Testes e verificação

O projecto inclui uma pasta `tests/` com testes automatizados para diferentes componentes.

Entre as áreas abrangidas estão:

- API;
- Gestão do estado;
- Persistência;
- Geração dos planos;
- Publicação;
- Validações e reforços da versão 3.8.

Existem ainda scripts auxiliares na pasta `scripts/`:

| Script | Finalidade |
|---|---|
| `testar-email.mjs` | Testes relacionados com o envio de e-mail |
| `testar-fluxo-http.mjs` | Verificação de fluxos HTTP |
| `testar-webhook-http.mjs` | Testes de integração com webhooks |
| `verificar-producao.mjs` | Verificações relacionadas com produção |
| `verificar-vue.mjs` | Verificação da aplicação Vue |

Para consultar os comandos de teste definidos no projecto:

```bash
npm run
```

Este comando apresenta os scripts disponíveis no `package.json`.

---

## 10. Publicação e implantação

O projecto contém workflows de automação através do GitHub Actions.

Os ficheiros responsáveis encontram-se em:

```text
.github/workflows/
```

- `deploy.yml`: workflow de publicação da aplicação;
- `deploy-worker.yml`: workflow de publicação do backend.

O backend utiliza Cloudflare Workers, sendo a configuração de implantação mantida em `backend/wrangler.toml`.

Antes da publicação, devem estar configurados os serviços, as variáveis de ambiente e os segredos necessários no ambiente de implantação.

As credenciais não devem ser incluídas directamente no código-fonte.

---

## 11. Fluxo de utilização da plataforma

O funcionamento geral da plataforma segue este processo:

1. O utilizador acede à página inicial.
2. Consulta as informações sobre o RumoCerto MZ.
3. Preenche os dados do seu perfil.
4. Indica os seus objectivos e dificuldades.
5. O sistema valida as informações.
6. O motor de planeamento processa os dados.
7. É gerado um plano de desenvolvimento de 30 dias.
8. O utilizador consulta as actividades de cada semana.
9. Executa as tarefas propostas.
10. Actualiza o progresso das actividades.
11. Consulta os indicadores de evolução.
12. Exporta o plano em PDF, quando necessário.

---

**RumoCerto MZ — Transformando objectivos em passos concretos para o futuro profissional de Moçambique.** 🇲🇿