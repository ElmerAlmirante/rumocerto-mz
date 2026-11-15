# Segurança, privacidade e limitações — RumoCerto MZ v2.3

## Dados e consentimento
- O utilizador consente explicitamente no envio dos dois e-mails.
- A IA é opcional e tem uma escolha separada, desligada por defeito. Apenas com esta escolha os campos de perfil profissional são enviados à API Gemini. O e-mail **não é incluído** no prompt.
- O backend utiliza Cloudflare KV para guardar o pedido e o plano durante **até 7 dias**, para que o PDF permaneça disponível durante o prazo comunicado. O pedido pode incluir nome, e-mail, objectivo, competências e dificuldades; por isso, não se devem inserir dados sensíveis desnecessários.
- O link do PDF contém um token pessoal. Qualquer pessoa com o link poderá aceder ao PDF até ele expirar. Não partilhar o URL em grupos nem capturas públicas.
- O botão «Limpar dados» remove os dados guardados no navegador; não elimina um pedido já enviado ao servidor. Esta distinção deve ser comunicada ao utilizador.

## Secrets e domínios
- Manter `backend/.dev.vars`, `.env.local`, `.wrangler`, chaves Gemini e EmailJS fora do Git e do frontend.
- Rotacionar quaisquer chaves expostas em capturas (especialmente EmailJS Private Key e Gemini API Key) e actualizar os Secrets do Cloudflare via Wrangler.
- Definir `ALLOWED_ORIGINS` com `https://k6n9.github.io` e, quando necessário para teste local, `http://localhost:5173`.
- As páginas GitHub Pages disponibilizam código público; apenas `VITE_WORKER_URL` pode ser configurada no build como variável não secreta.
- Alterar `.dev.vars` não altera Secrets do Worker em produção.

## Limitações reais da versão académica gratuita
- O serviço EmailJS e a API Gemini têm quotas e limites que podem mudar; o plano de regras mantém a geração gratuita sem IA.
- Cloudflare KV tem consistência eventual: a implementação reduz reenvios acidentais, **mas não garante entrega exactamente uma vez** caso ocorram erros de rede ou cron concorrentes. Para garantias fortes seria necessário um mecanismo transaccional (Durable Objects/Queue e idempotência).
- A plataforma não verifica vagas, não promete emprego nem presta aconselhamento clínico ou financeiro individual.
- Não adicionar tokens aos registos. Os novos códigos de diagnóstico Gemini mostram apenas códigos/status de erro e não o conteúdo privado do utilizador.

## Verificações antes da entrega
1. `npm test` e `npm run build` sem falhas.
2. Formulário com e sem IA, incluindo acesso móvel.
3. Dois e-mails em tempo real, sem disparar manualmente o Cron.
4. PDF descarregado noutro dispositivo.
5. Verificar ausência de segredos no histórico Git; remover do Git não apaga histórico anterior — rotacionar sempre as credenciais.
6. Cada membro do Grupo 8 deve realizar commit numa branch própria e abrir PR, conforme o enunciado da disciplina.
