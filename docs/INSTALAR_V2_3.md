# RumoCerto MZ v2.3 — Guia de instalação e publicação

## 1. O que muda
Actualização única: PDF profissional, 12 percursos gratuitos, duração semanal, Gemini opcional por consentimento, dois modelos de e-mail com marca, testes e documentação. Mantém o site Vue, dados do Banco Mundial, EmailJS, Cloudflare Worker, KV e Cron.

## 2. Instalação segura no Mac

Descarrega o pacote `RumoCerto_MZ_Atualizacao_Completa_v2_3.zip` e guarda-o em **Downloads**. Depois:

```bash
cd "$HOME/Downloads"
unzip -o RumoCerto_MZ_Atualizacao_Completa_v2_3.zip -d RumoCerto_v2_3
cd RumoCerto_v2_3
bash APLICAR_ACTUALIZACAO_V2_3_NO_MAC.sh
```

O script verifica a pasta antiga, guarda uma cópia de segurança dos ficheiros alterados, **não substitui** `.env.local`, `backend/.dev.vars`, `.git`, `node_modules` ou `backend/wrangler.toml` e executa `npm test`. Se as dependências estiverem disponíveis, também tenta `npm run build`. Caso necessário, dentro do projecto executa `npm install` e volta a testar. Se o script não encontrar o projecto, passa o caminho da pasta como argumento (entre aspas).

## 3. Confirmação local

```bash
cd "$HOME/Documents/KANE/KANE_WORKSPACE/2S_2026/PROG_WEB2/PRJ_FINAL/rumocerto-mz-final"
npm install
npm test
npm run build
npm run dev
```

Abre `http://localhost:5173/#/plano`, cria prévias com **Vue.js, Python, portefólio e entrevista**, compara as semanas e descarrega o PDF. Repara na opção «Usar IA Gemini», que agora está desligada por defeito.

## 4. Ordem de deploy — não inverter

**Primeiro o backend**, porque a versão v2.3 do formulário envia o novo campo `usarIA` e o Worker passa a respeitar essa escolha:

```bash
cd "$HOME/Documents/KANE/KANE_WORKSPACE/2S_2026/PROG_WEB2/PRJ_FINAL/rumocerto-mz-final/backend"
npx wrangler deploy
curl -i https://rumocerto-mz-api.k3n4.workers.dev/api/saude
```

Os Secrets de produção permanecem os mesmos. Confirma que o KV e o Cron continuam activos. Não corras o cron manualmente durante o teste de produção.

**Depois o frontend**, de preferência usando branch e pull request no GitHub Desktop:

1. Cria uma branch `melhoria/v2-3-planos-pdf-email` a partir de `main`.
2. Faz commit da actualização e **Push origin**.
3. Abre Pull Request para `main`, revê ficheiros e verifica GitHub Actions.
4. Faz merge do PR quando os testes estiverem verdes. O GitHub Pages volta a publicar automaticamente.
5. Confirma que o repositório GitHub tem `VITE_WORKER_URL` igual a `https://rumocerto-mz-api.k3n4.workers.dev` em **Settings → Secrets and variables → Actions → Variables**.

> O docente exige branches e pull requests dos membros do grupo. Cada membro deve realizar o seu próprio commit/PR, não basta uma branch criada por uma única pessoa.

## 5. Actualizar a estética dos e-mails

Abre `docs/emailjs/INSTRUCOES.md`, copia os dois ficheiros HTML para os templates existentes na conta EmailJS e mantém os respectivos Template IDs. O EmailJS é um serviço separado: o `git push` não actualiza templates remotamente.

## 6. Teste integrado sem custos (respeita quotas)

1. Cria um pedido com a opção de IA **desligada**. Confirma o e-mail imediato e o e-mail seguinte após cerca de 5–7 minutos.
2. Abre o PDF no telemóvel, confirma quatro semanas, tarefas com minutos, fontes e ausência de terceira página quase vazia.
3. Cria novo pedido com IA ligada (respeita o bloqueio de 90 segundos por IP). Verifica no PDF se o método é `IA Gemini` ou `Percurso educativo gratuito (sem IA)`.
4. Se a IA não funcionar, abre uma janela no Terminal dentro de `backend` e executa `npx wrangler tail`; procura somente códigos como `limite_gratuito`, `acesso_negado`, `modelo_indisponivel`, `formato_invalido`. **Não coloques a API key em prints.**
5. Não garantimos que a quota gratuita Gemini esteja disponível para todos os projectos. O percurso de regras é a alternativa gratuita.

## 7. Reversão se houver problema

O script guarda uma pasta `backup-v2_3-AAAAMMDD-HHMMSS` **ao lado do projecto**. Para voltar atrás, copia para o projecto os ficheiros da cópia de segurança (mantendo os caminhos internos) e executa novamente `npm test`. Se já fizeste deploy, reverte o commit via GitHub Desktop ou Git e publica novamente o Worker da versão anterior. Os dados do KV não são eliminados por este procedimento.

## 8. Privacidade e nota académica

Nunca partilhes os links privados de PDF nem as chaves EmailJS/Gemini. Antes da avaliação, confirma a rotação das credenciais anteriormente mostradas em capturas. Consulta `docs/SEGURANCA_PRIVACIDADE.md` e `docs/ENTREGA_ISUTC_V2_3.md`.
