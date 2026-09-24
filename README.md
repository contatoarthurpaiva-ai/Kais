# Kais — Gestão financeira e precificação

Ferramenta interna (com login) para a loja de biquínis **Kais** organizar custos,
precificar peças e conjuntos, avaliar descontos, registrar vendas/recebimentos e
entender o resultado — **sem precisar saber contabilidade**. pt-BR, BRL, fuso
`America/Sao_Paulo`.

> **Quer só colocar no ar?** Veja **`DEPLOY-RAILWAY.md`** — o Railway sobe o app e o
> banco juntos e cria o login sozinho no primeiro deploy (sem Docker, sem banco local).

> **Estado (leia com atenção).** Entrega incremental e honesta. O que está
> marcado como testado foi **implementado e testado de verdade**. O que está como
> typechecado foi **escrito e passou no TypeScript**, mas **não foi executado
> contra banco/navegador aqui** (depende do seu ambiente). O restante está apenas
> **modelado**.

---

## O que já existe

### Etapa 1 — Fundação (implementada e testada)

| Item | Como conferir |
|---|---|
| Motor financeiro (`src/domain/`) — preço-alvo, piso, margem, contribuição, desconto seguro, ponto de equilíbrio, custeio por grupos de estoque, pedido, parcelas | `npm test` |
| **Custo da variante pela ficha técnica** (`bom.ts`) — soma materiais/mão de obra/outros, trata perdas (consumo adicional ou rendimento) e marca estimativas — o "De onde vem este custo?" | `npm test` |
| Testes dos critérios de aceite §11 (14 casos, números exatos) | `npm test` |
| Exemplo executável de simulação | `npm run demo` |
| Modelo de dados (`prisma/schema.prisma`, 27 models, §9) | `npm run prisma:validate` (requer rede) |

### Etapa 2 — App, login e Precificação

| Item | Estado | Como conferir |
|---|---|---|
| **Autenticação** — hash de senha (scrypt), sessão assinada (HMAC+expiração), permissões ADMIN/OPERADOR (§10) | testado | `npm test` |
| **Serviço de precificação + validação** (servidor como fonte de verdade) | testado | `npm test` |
| **App Next.js** — login, layout com menu lateral + logo, tela de Precificação (prévia automática, resultado só-leitura, "Como foi calculado") | typechecado | `npm run typecheck` / `npm run dev` |
| **Rotas de API** — `/api/pricing/simulate` (puro), `/api/auth/login` e `/logout` | typechecado | idem |
| **Bootstrap da 1ª administradora** (`scripts/create-admin.ts`) | escrito | requer banco |

### Etapa 3 — Vendas, estoque e recebíveis

| Item | Estado | Como conferir |
|---|---|---|
| **Recebíveis e reconhecimento de receita** — venda em Nx = uma venda com N recebíveis; receita na entrega vs. "em carteira"; bruto recebido ≠ líquido creditado | testado | `npm test` |
| **Liquidação e antecipação** — parcial/total, trava de recebimento excedente, antecipação sem duplicar receita | testado | `npm test` |
| **Devoluções** — reverte receita/custo/estoque; repõe só o revendável; estorno = valor recuperado | testado | `npm test` |
| **Kit** — expande em componentes, aloca desconto/frete sem perder centavos | testado | `npm test` |
| **Idempotência** — mesma chave grava uma vez | testado | `npm test` |
| **Concorrência** — última peça não vendida duas vezes (trava de reserva) | testado | `npm test` |
| **CMV e snapshot** — CMV na venda, estoque remanescente; mudança futura de taxa não altera histórico | testado | `npm test` |
| **Serviço de venda transacional** (`src/server/sales-service.ts`) — `$transaction` + baixa condicional `WHERE qty >= n` + idempotência | escrito | requer banco |

**30 testes passam** (14 motor + 7 aplicação + 9 vendas). Typecheck limpo em
todo o app, exceto os arquivos que dependem do client Prisma gerado (ver abaixo).

### Etapa 4 — Dashboard e relatórios

| Item | Estado | Como conferir |
|---|---|---|
| **Consolidação sem dupla contagem** — receita reconhecida vs. em carteira; bruto recebido vs. líquido creditado; resultado gerencial = (receita − devoluções) − CMV − variáveis − fixas | testado | `npm test` |
| **Invariantes de caixa** — transferências/aportes não elevam faturamento; pró-labore não recontado; compra ≠ CMV | testado | `npm test` |
| **Contas a pagar/receber** — em aberto, vencidas, fixas por competência | testado | `npm test` |
| **Exportação CSV protegida** — neutraliza fórmulas (`=`, `+`, `-`, `@`), escapa separadores, BOM p/ Excel | testado | `npm test` |
| **Rota `/api/reports/export`** (só ADMIN) | typechecado | `npm run typecheck` |
| **Dashboard `/visao-geral`** — cartões consolidados pelo motor | escrito | requer banco |

**43 testes passam** (14 motor + 6 ficha técnica + 7 aplicação + 9 vendas + 7 relatórios). Typecheck
limpo em todo o app, exceto os arquivos que dependem do client Prisma gerado.

### Etapa 5 — Implantação e operação (artefatos)

| Item | Estado | Observação |
|---|---|---|
| **CI (GitHub Actions)** — `npm ci` → `prisma generate` → typecheck → 37 testes | pronto | `.github/workflows/ci.yml` |
| **Cron de recorrências** idempotente (`/api/cron/recurrences`) | escrito | agendado em `vercel.json`; gera previsão, nunca pagamento fictício |
| **Health check** (`/api/health`) | typechecado | sem banco |
| **Deploy Vercel + Railway** | documentado | passo a passo abaixo |
| **Docker (opção all-in-one Railway)** — Next standalone | pronto | `Dockerfile` |
| **Backup + restauração** (`scripts/backup.sh` / `restore.sh`) | pronto | `pg_dump -Fc` + retenção; restaure sempre em banco de teste |

> **O que só se conclui no seu ambiente.** Não pude fazer deploy real, subir
> Postgres nem rodar `prisma migrate` aqui (sem rede/infra no sandbox). Os
> artefatos acima são reais e revisáveis; o deploy, as migrations e o **teste de
> restauração do backup** precisam ser executados por você. Não afirmo que há
> backup só porque existe banco — o backup só existe depois de rodar o script e
> **validar a restauração**.

### Deploy (recomendado: Next na Vercel + Postgres no Railway)

1. **Railway:** crie um Postgres; copie a `DATABASE_URL`.
2. **Vercel:** importe o repositório; defina `DATABASE_URL`, `AUTH_SECRET`,
   `CRON_SECRET` e `UPLOADS_*` nas variáveis de ambiente.
3. **Migrations:** rode `npx prisma migrate deploy` (localmente apontando para o
   Railway, ou como comando de release).
4. **1ª administradora:** `ADMIN_EMAIL=... ADMIN_SENHA=... npm run create-admin`.
5. **Cron:** o `vercel.json` já agenda `/api/cron/recurrences` diariamente; a Vercel
   injeta `Authorization: Bearer $CRON_SECRET`.
6. **Uploads:** aponte `UPLOADS_*` para um bucket persistente (não o /tmp do deploy).
7. **Backups:** agende `scripts/backup.sh` e teste `scripts/restore.sh` num banco
   de teste periodicamente.

*Alternativa all-in-one:* app + Postgres no Railway usando o `Dockerfile`.

### Telas do app (completas — DB-facing)

Todas ligadas aos motores já testados, via **Server Actions** do Next. Rodam após
`prisma generate`/`migrate`. Transpilam sem erro de sintaxe (checado com esbuild),
mas ficam fora do meu typecheck porque dependem do client Prisma gerado:

| Tela | O que faz |
|---|---|
| **Visão geral** | dashboard consolidado (receita, caixa, contribuição, resultado) |
| **Precificação** | simulação guiada (prévia automática, "Como foi calculado") |
| **Produtos e custos** | produto/variante + ficha técnica → custo calculado (`computeVariantCost`) |
| **Estoque** | materiais, compras e grupos com custo médio por grupo |
| **Vendas** | registra venda via `confirmSale` (baixa de estoque + recebíveis + idempotência) |
| **Financeiro** | categorias, gastos (a pagar/pagar), contas |
| **Configurações** | dados da loja, metas de margem, taxas, **upload de logo** (PNG/JPEG/WebP validado) |
| **Primeiros passos** | onboarding retomável com pendências |
- **Etapa 5** — Testes de integração, deploy Vercel/Railway, uploads persistentes,
  recorrências idempotentes, backups + restauração testada — §9/§10.

---

## Rodar localmente

### Caminho rápido (Docker) — 3 comandos, login já criado

O `.env` e o `docker-compose.yml` já vêm prontos para desenvolvimento.

    docker compose up -d db     # sobe um Postgres local
    npm install
    npm run setup               # gera Prisma, cria tabelas e a 1a administradora
    npm run dev                 # http://localhost:3000

Login criado pelo setup (padrão de DEV, **troque depois**):
**admin@kais.local / kais12345** — o comando imprime isso no terminal.

Sem Docker? Crie um Postgres grátis no neon.tech ou Railway, cole a connection
string no `DATABASE_URL` do `.env` e rode `npm install && npm run setup && npm run dev`.

### Só os cálculos (sem banco)

    npm install
    npm test          # 43 testes verdes
    npm run demo      # simulação de preço no terminal
    npm run typecheck

> **Prisma e rede.** `prisma generate/validate/migrate` baixam o engine de
> `binaries.prisma.sh`, **bloqueado no ambiente onde este código foi gerado** — por
> isso não pude gerar o client aqui, e os 3 arquivos que o usam
> (`lib/db.ts`, `app/api/auth/login/route.ts`, `scripts/create-admin.ts`) ficaram
> fora do meu typecheck. No **seu** ambiente, com rede, `npm run prisma:generate`
> resolve isso e o typecheck cobre tudo.

---

## Arquitetura (§9)

- **App:** TypeScript + **Next.js** (App Router) na **Vercel**.
- **Banco:** **PostgreSQL** persistente no **Railway** (`DATABASE_URL`, TLS, pooling).
- **Domínio financeiro:** módulo puro (`src/domain/`), usado por servidor e UI.
- **Auth:** scrypt (`node:crypto`, sem dep nativa) + sessão HMAC em cookie httpOnly;
  checagem de perfil no servidor.
- **Uploads:** bucket persistente (não o /tmp do deploy).
- **Recorrências:** Cron da Vercel chamando rota protegida, idempotente.

Escolha principal recomendada: **Next.js na Vercel + Postgres no Railway**. Confirme
versões/limites na documentação oficial antes de fixar.

---

## Mapa do código

    src/domain/      motor financeiro puro (testado — §6)
    src/auth/        password (scrypt), session (HMAC), rbac (perfis) — testado
    src/server/      validation + pricing-service (fonte de verdade) — testado
    app/             Next.js: login, painel (menu+logo), precificação, api/
    lib/             db (Prisma), auth (sessão via cookie), brl (formatação)
    prisma/          schema.prisma (27 models — §9)
    scripts/         create-admin (1a administradora)
    tests/           acceptance (§11) + etapa2 (auth/serviço)
    examples/        simulacao (demo executável)

---

## Progresso

- [x] Etapa 1 — Fundação: motor + testes + modelo de dados + logo
- [x] Etapa 2 (núcleo testável) — auth + serviço de precificação
- [~] Etapa 2 (app) — telas/rotas escritas e typechecadas; falta rodar com banco
- [x] Etapa 3 (núcleo testável) — recebíveis, devoluções, idempotência, concorrência, CMV
- [~] Etapa 3 (persistência) — serviço transacional escrito; falta ligar telas e rodar com banco
- [x] Etapa 4 (núcleo testável) — consolidação sem dupla contagem + CSV protegido
- [~] Etapa 4 (app) — dashboard e rota de export escritos; falta rodar com banco
- [x] Etapa 5 (artefatos) — CI, cron, Docker, backup/restauração, guia de deploy
- [x] **Telas do app** — Visão geral, Precificação, Produtos e custos, Estoque, Vendas, Financeiro, Configurações (com upload de logo) e Primeiros passos, todas ligadas aos motores testados via Server Actions
- [ ] **Rodar no seu ambiente** — `prisma generate/migrate`, deploy e teste de restauração do backup
- [ ] Relatórios detalhados (PDF, por SKU/canal) e ordens de produção (fluxo de consumo atômico)
- [ ] Endurecimento — CSRF, rate-limit no login, gravação efetiva da auditoria
