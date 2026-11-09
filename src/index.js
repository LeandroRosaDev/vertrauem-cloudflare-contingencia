/**
 * VERTRAUEM — Cloudflare Workers (Plano Free)
 * Proxy transparente com página de indisponibilidade hospedada na borda.
 *
 * A execução no domínio de produção exige uma Worker Route apontando
 * para o mesmo hostname do servidor de origem (DNS com proxy ativo).
 */
import paginaManutencao from './manutencao.html';

// Erros tipicamente associados a falhas na origem ou na conectividade.
const ERROS_DE_INDISPONIBILIDADE = new Set([
  502, 503, 504, 520, 521, 522, 523, 524, 525, 526, 530,
]);

const CABECALHOS_SEM_CACHE = {
  'Cache-Control': 'no-store, max-age=0',
  'X-Robots-Tag': 'noindex, nofollow',
};

function exibirPagina(html, retryAfter) {
  return new Response(html, {
    status: 503,
    headers: {
      ...CABECALHOS_SEM_CACHE,
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
      'Retry-After': retryAfter,
    },
  });
}

// Queda da origem: mesma página de manutenção, com nova tentativa mais curta.
function exibirIndisponibilidade() {
  return exibirPagina(paginaManutencao, '60');
}

function exibirManutencao() {
  return exibirPagina(paginaManutencao, '600');
}

function respostaTextoIndisponivel(retryAfter) {
  return new Response('Serviço temporariamente indisponível.', {
    status: 503,
    headers: {
      ...CABECALHOS_SEM_CACHE,
      'Content-Type': 'text/plain; charset=utf-8',
      'Retry-After': retryAfter,
    },
  });
}

// Liga o modo manutenção pela variável MODO_MANUTENCAO ("true")
// no wrangler.jsonc ou no painel Cloudflare (Settings → Variables).
function manutencaoAtiva(env) {
  return String(env?.MODO_MANUTENCAO ?? '').toLowerCase() === 'true';
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
  async fetch(request, env) {
    const url = new URL(request.url);
    const emManutencao = manutencaoAtiva(env);

    // Exibe sempre a página em workers.dev e no ambiente local,
    // sem tentar conectar a um servidor de origem inexistente.
    if (ehAmbienteDeVisualizacao(url.hostname)) {
      return exibirManutencao();
    }

    const ehPagina = ehNavegacaoHTML(request);

    // Manutenção programada: o site fica suspenso sem consultar a origem.
    if (emManutencao) {
      return ehPagina ? exibirManutencao() : respostaTextoIndisponivel('600');
    }

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
      return respostaTextoIndisponivel('60');
    }
  },
};
