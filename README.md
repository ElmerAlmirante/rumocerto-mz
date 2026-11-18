
# RumoCerto MZ — versão 3.6

**Projecto Final de Programação Web II · Grupo 8 · LECC31 · ISUTC · 2026**

Aplicação de orientação profissional para jovens moçambicanos. Permite consultar indicadores oficiais do Banco Mundial, criar um plano educativo de 30 dias, descarregar o documento em PDF e acompanhar as tarefas concluídas. O envio opcional por e-mail utiliza Cloudflare Workers, Durable Objects (SQLite) com alarmes e EmailJS. O Gemini pode ser utilizado para personalizar o texto do diagnóstico, com alternativa gratuita sem serviços de IA.

**Site:** https://k6n9.github.io/rumocerto-mz/  
**Repositório:** https://github.com/K6N9/rumocerto-mz

A versão deste pacote é a **3.6.0**. O site público só apresentará estas alterações depois de a versão ser integrada no branch `main` e publicada. A comunicação exige também a publicação do Worker actualizado. O frontend consulta `/api/saude` e verifica a versão do protocolo antes de enviar pedidos.

## Interface e funcionalidades

A interface da versão 3.6 organiza a criação do plano em três passos, mantém campos opcionais recolhidos, apresenta um resumo de quatro semanas e mostra tarefas e progresso por semana. A página inicial adapta-se quando já existe um plano guardado. A página inicial mostra um indicador em destaque, mantendo os restantes na página de indicadores. A tabela de dados históricos apresenta a série completa.

## Equipa

**Grupo 8 — Programação Web II | LECC31 | ISUTC | 2026**

O RumoCerto MZ foi desenvolvido pelos seguintes membros do Grupo 8 do Instituto Superior de Transportes e Comunicações (ISUTC).

| Nº | Nome completo | Conta GitHub |
|:---:|---|---|
| 1 | **Benjamim Junior** | [@benjamimjunior](https://github.com/benjamimjunior) |
| 2 | **Elmer Almirante** | [@ElmerAlmirante](https://github.com/ElmerAlmirante) |
| 3 | **Mabikane Arnaldo** | [@K6N9](https://github.com/K6N9) |

### Colaboração no projecto

O desenvolvimento do RumoCerto MZ é realizado de forma colaborativa através do GitHub. Cada membro utiliza a sua conta pessoal para contribuir para o código, a documentação, os testes e as melhorias da plataforma.

As contribuições são organizadas através de branches individuais, commits e Pull Requests, permitindo manter o histórico das alterações e identificar a participação de cada membro.

**Repositório oficial:** [K6N9/rumocerto-mz](https://github.com/K6N9/rumocerto-mz)

## Tecnologias

Vue 3, Composition API, Vue Router, Vite, JavaScript, CSS responsivo, API do Banco Mundial, Cloudflare Workers, Durable Objects com SQLite, alarmes e EmailJS. A interface e o BRD estão escritos em português.

Os indicadores são obtidos através de `fetch` à API pública do Banco Mundial para Moçambique (`country/MOZ`):

- `SL.UEM.1524.ZS` — desemprego juvenil total;
- `SL.UEM.1524.FE.ZS` — mulheres;
- `SL.UEM.1524.MA.ZS` — homens.

A origem, o ano e a população representada são identificados junto dos gráficos. As séries representam estimativas da OIT para a força de trabalho dos 15 aos 24 anos e não previsões individuais.

## Executar localmente

```bash
npm ci
npm run dev
```

Testes automatizados e compilação:

```bash
npm test
npm run build
```

## Variáveis de ambiente

No frontend, `VITE_WORKER_URL` aponta para o endereço HTTPS do Worker de produção. A publicação no GitHub Pages usa esta variável configurada em `Settings → Secrets and variables → Actions → Variables`.

No Cloudflare Worker, as variáveis `EMAILJS_SERVICE_ID`, `EMAILJS_PUBLIC_KEY`, `EMAILJS_TEMPLATE_CONFIRM`, `EMAILJS_TEMPLATE_PLAN`, `EMAILJS_PRIVATE_KEY`, `PUBLIC_WORKER_URL`, `ALLOWED_ORIGINS`, `RATE_SALT` e `DOWNLOAD_SECRET` são configuradas no serviço. `DOWNLOAD_SECRET` deve ter pelo menos 24 caracteres aleatórios e não deve ser exposto. `GEMINI_API_KEY` é opcional; `GEMINI_MODEL` pode ser configurado como `gemini-3.5-flash-lite`. **As chaves privadas nunca devem ficar em ficheiros públicos, no frontend ou no histórico Git.** Os ficheiros `.env.example` e `backend/.dev.vars.example` indicam apenas nomes e parâmetros públicos.

O EmailJS disponibiliza dois modelos: confirmação de pedido e entrega de ligação privada para PDF. A mensagem final é processada por um alarme de Durable Object cerca de cinco minutos depois, e não inclui anexo. A interface consulta o estado de configuração do serviço e informa quando o envio não está disponível, sem impedir o PDF local. Um estado «incerto» não é reenviado automaticamente; o utilizador é informado de que deve confirmar a recepção. O gerador PDF usa uma fonte TrueType Unicode incorporada directamente no PDF, obtida por HTTPS do projecto DejaVu alojado no repositório Prawn. Preserva acentos, o euro, marcas de conclusão e os caracteres cobertos pela fonte. A fonte não é incluída separadamente neste repositório. Quando não é possível obter a fonte, o sistema mantém a geração em modo de compatibilidade WinAnsi e identifica os caracteres não suportados por `[U+XXXX]`. Alguns pictogramas e alfabetos não cobertos pela fonte também usam esta representação. O pedido da fonte não transmite dados do utilizador.

## Estrutura

`src/` inclui páginas Vue, componentes e composables; `shared/` contém as regras de plano, indicadores e PDF; `backend/` contém o Worker e a configuração dos Durable Objects; `tests/` contém testes automatizados.

## Segurança e privacidade

O utilizador autoriza expressamente os e-mails. Os dados do perfil, o plano e o progresso são guardados no navegador, excepto os dados enviados ao Worker quando se pede o envio. Pedidos externos são armazenados temporariamente em Durable Objects durante até sete dias. O acesso ao PDF utiliza uma assinatura HMAC e o estado do pedido é protegido por um token. A opção de personalização com Gemini é voluntária e identificada no formulário. A plataforma não recolhe números de documento nem promete oportunidades de emprego.

O sistema inclui validação no frontend e no Worker, limitação de pedidos por IP e e-mail com libertação coordenada de reservas rejeitadas, protecção CORS e verificação de compatibilidade entre frontend e backend. A submissão utiliza um identificador persistente, evitando novos e-mails ao repetir um pedido já registado. O segundo e-mail só é tentado uma vez por pedido; em caso de resposta incerta do fornecedor, a entrega pode falhar sem repetição automática. Os alarmes recuperam pedidos interrompidos antes da confirmação e eliminam os registos após o prazo de retenção. Os testes automatizados simulam o fornecedor de e-mail; a recepção efectiva das duas mensagens deve ser verificada em produção antes da defesa. A publicação e a existência de contribuições individuais também devem ser confirmadas no GitHub.

## Fontes

- Afrobarometer, comunicado de 23 de Junho de 2026: https://www.afrobarometer.org/articles/os-jovens-mocambicanos-enfrentam-dificuldades-para-encontrar-emprego-afirmando-que-sao-prejudicados-pela-falta-de-formacao-e-de-experiencia-profissional/
- Banco Mundial, indicador de desemprego juvenil para Moçambique: https://data.worldbank.org/indicator/SL.UEM.1524.ZS?locations=MOZ
- Documentação da API do Banco Mundial: https://datahelpdesk.worldbank.org/knowledgebase/articles/889392
- Vue: https://vuejs.org/
- Cloudflare Workers: https://developers.cloudflare.com/workers/
- EmailJS: https://www.emailjs.com/docs/
- Gemini API, modelos disponíveis: https://ai.google.dev/gemini-api/docs/models
- Fonte DejaVu Sans (TrueType): https://github.com/prawnpdf/prawn/blob/master/data/fonts/DejaVuSans.ttf

## Colaboração e integridade académica

O trabalho deve ser original e explicado pelos seus autores. Cada membro deve utilizar a sua própria conta GitHub, criar um branch e submeter um commit por pull request revisto por outro membro. Os registos desses contributos não podem ser simulados.

A equipa utilizou ChatGPT como apoio à estruturação, revisão e desenvolvimento do protótipo. Gemini é uma funcionalidade opcional da aplicação, não uma fonte dos indicadores oficiais. A equipa é responsável por validar o código, as fontes e todos os resultados apresentados.
