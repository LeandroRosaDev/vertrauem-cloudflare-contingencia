import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Carrega o Worker com HTML embutido para testar sem credenciais Cloudflare
// e sem instalar dependências de desenvolvimento.
const html = readFileSync(new URL('../src/indisponibilidade.html', import.meta.url), 'utf8');
const source = readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');
const script = source.replace(
  "import paginaIndisponivel from './indisponibilidade.html';",
  `const paginaIndisponivel = ${JSON.stringify(html)};`,
);
const { default: worker } = await import(`data:text/javascript,${encodeURIComponent(script)}`);
const fetchOriginal = globalThis.fetch;
after(() => { globalThis.fetch = fetchOriginal; });

const htmlRequest = (host = 'app.exemplo.com') => new Request(`https://${host}/dashboard`, {
  headers: { Accept: 'text/html,application/xhtml+xml' },
});

// Evita paralelismo entre mocks de fetch global.
test('Preview workers.dev apresenta página de manutenção', async () => {
  const resposta = await worker.fetch(htmlRequest('vertrauem-contingencia.exemplo.workers.dev'));
  assert.equal(resposta.status, 503);
  assert.match(await resposta.text(), /Voltaremos em breve/);
  assert.equal(resposta.headers.get('cache-control'), 'no-store, max-age=0');
});

test('Respostas normais da origem são preservadas', async () => {
  globalThis.fetch = async () => new Response('SITE ONLINE', { status: 200 });
  const resposta = await worker.fetch(htmlRequest());
  assert.equal(resposta.status, 200);
  assert.equal(await resposta.text(), 'SITE ONLINE');
});

test('Erro 522 em navegação HTML apresenta página de manutenção', async () => {
  globalThis.fetch = async () => new Response('Cloudflare Error', { status: 522 });
  const resposta = await worker.fetch(htmlRequest());
  assert.equal(resposta.status, 503);
  assert.match(await resposta.text(), /temporariamente indisponível/);
});

test('Erros de API não são convertidos em HTML', async () => {
  globalThis.fetch = async () => new Response('{"erro":"offline"}', {
    status: 503,
    headers: { 'Content-Type': 'application/json' },
  });
  const resposta = await worker.fetch(new Request('https://app.exemplo.com/api/clientes', {
    headers: { Accept: 'application/json' },
  }));
  assert.equal(resposta.status, 503);
  assert.equal(resposta.headers.get('content-type'), 'application/json');
  assert.equal(await resposta.text(), '{"erro":"offline"}');
});

test('404 não é interceptado', async () => {
  globalThis.fetch = async () => new Response('Não encontrado', { status: 404 });
  const resposta = await worker.fetch(htmlRequest());
  assert.equal(resposta.status, 404);
});

test('Erro de rede recebe página HTML em navegações', async () => {
  globalThis.fetch = async () => { throw new Error('conexão recusada'); };
  const logOriginal = console.error;
  console.error = () => {};
  try {
    const resposta = await worker.fetch(htmlRequest());
    assert.equal(resposta.status, 503);
    assert.match(resposta.headers.get('content-type'), /text\/html/);
  } finally {
    console.error = logOriginal;
  }
});
