# Aplicar os novos modelos de e-mail no EmailJS

**IMPORTANTE:** alterar HTML no GitHub **não actualiza** os modelos guardados no painel EmailJS. É necessário colar manualmente estes conteúdos uma única vez.

1. Abre https://dashboard.emailjs.com/admin/templates.
2. Primeiro modelo (`EMAILJS_TEMPLATE_CONFIRM`): abre o template de confirmação existente e guarda uma cópia de segurança do HTML actual. Em **Content → Edit Content**, usa a opção de edição de código-fonte HTML e cola `01_confirmacao.html`. Guarda.
3. Segundo modelo (`EMAILJS_TEMPLATE_PLAN`): faz o mesmo com `02_plano.html`.
4. Em **To Email**, coloca exactamente `{{to_email}}` em ambos os modelos. Usa **From Name** = `RumoCerto MZ` e **Reply To** = `rumocerto.mz@gmail.com`.
5. Assuntos: `Recebemos as tuas escolhas — RumoCerto MZ` e `O teu plano completo de 30 dias — RumoCerto MZ`.
6. Usa **Test It** para enviar para um endereço teu; confirma que o logótipo e o botão aparecem e que a ligação do PDF está funcional num envio real da aplicação.
7. Mantém os IDs actuais; não é necessário criar outro Service ou alterar os Secrets no Cloudflare.

As variáveis `{{...}}` são escapadas pelo EmailJS. Não uses `{{{...}}}` para dados fornecidos pelo utilizador, pois desactiva esse escape. Não partilhes ligações privadas de PDF nem credenciais em capturas públicas.

A imagem da marca usa um endereço HTTPS público em `https://k6n9.github.io/rumocerto-mz/branding/logo-email.png` e pode depender da permissão do destinatário para carregar imagens remotas. O texto do e-mail continua legível sem imagens.
