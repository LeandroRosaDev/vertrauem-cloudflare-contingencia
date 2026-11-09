# VERTRAUEM | Página de contingência Cloudflare Workers

Projeto pronto para subir no **GitHub** e conectar ao **Cloudflare Workers (Free)**.

Quando um visitante acessa um domínio com uma **Worker Route** configurada:

- **Origem respondendo normalmente:** a resposta do servidor é entregue sem alterações.
- **Origem retornando 502/503/504 ou 520–526/530:** uma navegação HTML recebe a página personalizada com HTTP 503.
- **Erro de conexão na chamada à origem:** a navegação HTML recebe a página personalizada.
- **APIs e arquivos estáticos:** respostas recebidas são preservadas; em falhas de rede o Worker retorna 503 em texto simples.

O HTML e CSS são incorporados ao Worker durante a publicação. **A página não depende de sua VPS para funcionar.**

## Estrutura

```text
vertrauem-cloudflare-contingencia/
├── src/
│   ├── index.js                  # Worker / proxy transparente
│   └── manutencao.html            # HTML + CSS animado exibido em quedas e na manutenção
├── tests/
│   └── worker.test.mjs            # Testes locais sem Cloudflare
├── wrangler.jsonc                 # Configuração de publicação
├── package.json
├── .gitignore
└── README.md
```

## Publicação pelo GitHub e Cloudflare

### 1. Criar um repositório

1. Extraia o arquivo ZIP recebido.
2. No GitHub, crie um repositório, por exemplo: `vertrauem-cloudflare-contingencia`.
3. Faça upload **dos arquivos e pastas da pasta extraída** para a raiz do repositório. Não faça upload apenas do ZIP.
4. Confirme que `wrangler.jsonc` aparece **na raiz** e `src/index.js` está acessível.

### 2. Conectar ao Cloudflare

Se **já existe** o Worker `vertrauem-contingencia` criado no painel:

1. Cloudflare → **Workers & Pages** → `vertrauem-contingencia`.
2. **Settings → Builds → Connect**.
3. Autorize o GitHub e escolha o repositório e a branch `main`.
4. Confirme que o campo `name` em `wrangler.jsonc` é **idêntico** ao nome do Worker que aparece no painel.
5. Mantenha o **Build command** como `npm run build`. Esse script só valida o bundle com `wrangler deploy --dry-run` e não publica o Worker. O **Deploy command** precisa ser `npx wrangler deploy`.
6. Salve a integração. Se o deploy não começar, faça um commit no GitHub.

Se ainda não existe o Worker:

1. Cloudflare → **Workers & Pages → Create application → GitHub**.
2. Conecte seu repositório. Use `npm run build` como **Build command** e `npx wrangler deploy` como **Deploy command**.

Obs.: a interface exata do Cloudflare pode mudar. Consulte as páginas oficiais nas referências ao final.

### 3. Testar a página

Abra o endereço disponibilizado pelo Cloudflare, parecido com:

```text
https://vertrauem-contingencia.SEUSUBDOMINIO.workers.dev
```

Nesse endereço, o Worker **sempre mostra a página de contingência**, para testar o visual sem desligar sua VPS. Isso não testa a comunicação real com a origem.

### 4. Ativar em um domínio de homologação

1. Confirme que o DNS do domínio/subdomínio tem **proxy do Cloudflare ativo** (nuvem laranja).
2. Acesse o Worker → **Settings → Domains & Routes → Add → Route**.
3. Adicione uma rota correspondente a um hostname de homologação, por exemplo `homologacao.seudominio.com/*`.
4. **Não utilize Custom Domain**: a origem continua sendo seu servidor.
5. Faça testes no subdomínio antes de habilitar no sistema principal.

Se estiver funcionando corretamente, acrescente as rotas de produção, por exemplo:

```text
elivus.com.br/*
www.elivus.com.br/*
```

**Importante:** rotas são intencionalmente gerenciadas pelo painel, e não estão incluídas no `wrangler.jsonc`. Assim o projeto pode ser testado sem ativar automaticamente nenhum domínio de produção.

## Modo manutenção programada

Além da contingência automática (que já exibe `src/manutencao.html` quando a origem cai), o Worker pode **suspender o site de propósito** com a mesma página animada.

- **Ligar:** defina a variável `MODO_MANUTENCAO` como `"true"` em `wrangler.jsonc` (seção `vars`) e faça commit — ou altere em Cloudflare → Worker → **Settings → Variables and Secrets**.
- **Desligar:** volte para `"false"`.
- Com o modo ligado, a origem **não é consultada**: navegações HTML recebem a página de manutenção (HTTP 503, `Retry-After: 600`) e APIs/arquivos recebem 503 em texto simples.
- **Pré-visualizar** sem ativar: abra o endereço `https://SEU-WORKER.workers.dev`.

Obs.: se a variável for alterada pelo painel, um próximo deploy via GitHub sobrescreve com o valor do `wrangler.jsonc`.

Para mudar textos e etapas, edite os trechos marcados com `EDITAR` em `src/manutencao.html` (as etapas usam as classes `done` e `active`).

## Personalizar a página

Edite `src/manutencao.html` para alterar:

- Nome/identidade da empresa;
- Textos de aviso;
- Cores e CSS;
- Layout do cartão.

Faça commit no GitHub: o Cloudflare publicará uma nova versão automaticamente.

Se quiser mudar o nome do Worker, ajuste `name` no `wrangler.jsonc` **antes** de conectar o repositório. Para um Worker já existente, mantenha o nome cadastrado no Cloudflare.

## Testar localmente (opcional)

Requer Node.js recente:

```bash
npm test
```

Para executar o Wrangler localmente:

```bash
npm install
npm run dev
```

No endereço local mostrado pelo Wrangler, a página de manutenção será exibida automaticamente.

## Cuidados e limitações

- A rota do Worker pode ser acionada em todas as requisições ao hostname, não apenas quando houver falha. Isso consome a cota do plano Free; avalie volume de tráfego, CSS, imagens e APIs.
- A detecção de falha ocorre durante a requisição, sem monitoramento contínuo da origem.
- Se o host responder HTTP 200 com uma página de erro criada pela aplicação, este Worker **não saberá** que o aplicativo está indisponível.
- Falhas antes de o Cloudflare conseguir executar o Worker podem impedir que o fallback seja exibido.
- A resposta HTML usa HTTP 503 com `Retry-After` e não é cacheada, para que o site volte a abrir assim que a origem responder.
- Esta implementação não implementa failover para outra VPS: exibe uma página estática de contingência.
- Quando a cota do Workers Free for excedida, o comportamento dependerá da configuração de limite do Worker. Em modo fail-open, o fallback deixa de executar até a cota voltar.
- Não insira senhas, tokens ou chaves secretas nesses arquivos públicos do GitHub.

## Fontes oficiais

- [Workers — configuração Wrangler](https://developers.cloudflare.com/workers/wrangler/configuration/)
- [Workers — Routes](https://developers.cloudflare.com/workers/configuration/routing/routes/)
- [Workers — Git integration](https://developers.cloudflare.com/workers/ci-cd/builds/)
