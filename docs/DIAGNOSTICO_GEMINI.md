# Diagnóstico seguro do Gemini (sem expor chaves)

O Gemini é **opcional**. O utilizador deve marcar a opção no formulário; o servidor nunca envia o e-mail do utilizador ao Gemini.

O backend classifica falhas sem registar os dados pessoais ou a chave API:

| Código | Interpretação possível | Acção |
|---|---|---|
| `nao_solicitada` | Utilizador não activou a IA | Normal, usar percurso de regras |
| `sem_chave` | `GEMINI_API_KEY` não foi configurada | Confirmar o Secret no Cloudflare, sem o divulgar |
| `acesso_negado` | HTTP 401/403: chave/permissões/região/projecto | Rever Google AI Studio e permissões |
| `modelo_indisponivel` | HTTP 404 | Confirmar nome do modelo e disponibilidade |
| `limite_gratuito` | HTTP 429 | Esperar quota renovar; continuar com o plano de regras |
| `servico_indisponivel` | Erros 5xx | Problema temporário do fornecedor |
| `resposta_vazia`, `json_invalido`, `formato_invalido` | Conteúdo ausente/fora do formato exigido | Plano de regras é usado em segurança |
| `tempo_excedido` | Tempo máximo de pedido atingido | Repetir em outro momento, sem bloquear os e-mails |

Comandos úteis (sem imprimir chaves):

```bash
cd backend
npx wrangler secret list
npx wrangler tail
```

Configuração opcional do modelo: `GEMINI_MODEL=gemini-2.5-flash` como Secret/variável do Worker (a versão usa esse modelo por defeito). A chamada pede JSON e limita thinking em modelos 2.5 Flash para reduzir uso de tokens. Não garante quota disponível nem utilização gratuita ilimitada.
