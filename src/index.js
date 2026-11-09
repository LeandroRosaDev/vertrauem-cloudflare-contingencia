/**
 * VERTRAUEM — Cloudflare Workers (Plano Free)
 * Proxy transparente com página de indisponibilidade hospedada na borda.
 *
 * A execução no domínio de produção exige uma Worker Route apontando
 * para o mesmo hostname do servidor de origem (DNS com proxy ativo).
 */
import paginaIndisponivel from './indisponibilidade.html';

// Erros tipicamente associados a falhas na origem ou na conectividade.
const ERROS_DE_INDISPONIBILIDADE = new Set([
  502, 503, 504, 520, 521, 522, 523, 524, 525, 526, 530,
]);

const CABECALHOS_SEM_CACHE = {
  'Cache-Control': 'no-store, max-age=0',
  'X-Robots-Tag': 'noindex, nofollow',
};

function exibirIndisponibilidade() {
  return new Response(paginaIndisponivel, {
    status: 503,
    headers: {
      ...CABECALHOS_SEM_CACHE,
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
      'Retry-After': '60',
    },
  });
}

function ehNavegacaoHTML(request) {
  if (request.method !== 'GET') return false;
  return (request.headers.get('Accept') || '').includes('text/html');
}

function ehAmbienteDeVisualizacao(hostname) {
  return hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.endsWith('.workers.dev');
}

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // Exibe sempre a página em workers.dev e no ambiente local,
    // sem tentar conectar a um servidor de origem inexistente.
    if (ehAmbienteDeVisualizacao(url.hostname)) {
      return exibirIndisponibilidade();
    }

    const ehPagina = ehNavegacaoHTML(request);

    try {
      // Em uma Worker Route, fetch(request) acessa a origem do DNS,
      // sem executar recursivamente a própria Route.
      const respostaDaOrigem = await fetch(request);

      if (ehPagina && ERROS_DE_INDISPONIBILIDADE.has(respostaDaOrigem.status)) {
        return exibirIndisponibilidade();
      }

      // Preserva todas as respostas normais e os erros de APIs/assets.
      return respostaDaOrigem;
    } catch (erro) {
      console.error('Falha na comunicação com o host de origem:', erro);

      if (ehPagina) {
        return exibirIndisponibilidade();
      }

      // Para APIs, imagens e outros recursos não retorna HTML inesperado.
      return new Response('Serviço temporariamente indisponível.', {
        status: 503,
        headers: {
          ...CABECALHOS_SEM_CACHE,
          'Content-Type': 'text/plain; charset=utf-8',
          'Retry-After': '60',
        },
      });
    }
  },
};
