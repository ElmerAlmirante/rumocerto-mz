const versao = process.env.RUMOCERTO_TEST_VERSAO || '3.8'
const cors = process.env.RUMOCERTO_TEST_CORS || 'https://k6n9.github.io'
globalThis.fetch = async (_url, options = {}) => {
  if (options.headers?.Origin === 'https://origem-nao-autorizada.invalid') {
    return new Response('{}', { status: 403 })
  }
  return new Response(JSON.stringify({
    ok: true, versao,
    envioDisponivel: true, recuperacaoDisponivel: true,
    verificacaoNecessaria: true, turnstileNecessario: true,
    entregaVerificavel: true, fornecedor: 'resend'
  }), { status: 200, headers: {'Access-Control-Allow-Origin': cors, 'Content-Type': 'application/json'} })
}
