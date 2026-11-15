# RumoCerto MZ — Retoques finais v2.4

## Alterações
- PDF: título de semana sem duplicar «Semana N» quando o Gemini devolve esse prefixo.
- PDF: carga horária das actividades obtida apenas da duração presente nas tarefas; data de geração formatada no fuso horário de Moçambique.
- Site: prévia gratuita com instruções correctas para pedir os e-mails, estados de pedido mais legíveis e uma indicação do tempo de actividades por semana.
- Site: os dados do PDF são congelados no momento do pedido; alterações posteriores ao formulário não alteram o documento daquele pedido.
- Site: melhorias pequenas de acessibilidade, foco da validação e apresentação móvel.
- Foram preservados os contratos dos dois templates EmailJS, a API do Worker, o agendamento e os tokens privados.

## Validação antes da entrega
1. `npm test` e `npm run build` devem passar.
2. No telemóvel, verificar formulário, mensagens, prévia e botões sem deslocação horizontal.
3. Gerar um plano com Gemini e outro sem IA, verificando as quatro semanas e o conteúdo do PDF.
4. Confirmar e-mail inicial imediatamente e e-mail final após o agendamento; não divulgar links privados de PDF em capturas públicas.
5. Confirmar a origem das estatísticas (API do Banco Mundial para Moçambique) e estados de loading, erro e dados vazios.
6. Entregar **BRD em PDF, repositório público e GitHub Pages até 21/11/2026 às 23:59** no LMS, uma entrega por grupo.
7. O enunciado exige que **cada membro** (Benjamim Junior, Elmer Almirante, Mabikane Arnaldo) faça um commit no seu branch e um PR para `main`, revisto por outro membro. Um PR deste acabamento não substitui os PRs individuais dos colegas.
8. Nunca enviar `.env.local`, `backend/.dev.vars`, chaves Gemini/EmailJS ou tokens de PDF para GitHub.
