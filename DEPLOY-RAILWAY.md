# Publicar no Railway (sobe o banco junto)

O Railway hospeda o app **e** o Postgres no mesmo lugar. No primeiro deploy ele cria
as tabelas e a administradora sozinho. Sem Docker, sem banco na sua máquina.

## Passo a passo

### 1. Coloque o código no GitHub
Na pasta `kais`, no terminal:

```bash
git init
git add .
git commit -m "Kais"
```

Crie um repositório vazio no GitHub (github.com → New repository) e siga as duas
linhas que ele mostra para enviar (`git remote add origin ...` e `git push -u origin main`).

> Não usa GitHub? Alternativa por CLI: instale o Railway CLI, rode `railway login`,
> `railway init` e `railway up` de dentro da pasta. Mas o caminho pelo GitHub é o mais simples.

### 2. Crie o projeto no Railway
- Acesse https://railway.app e entre com o GitHub.
- **New Project → Deploy from GitHub repo →** escolha o repositório do Kais.
- O Railway detecta o Next.js e começa a buildar. (Vai falhar por falta de banco — normal, siga.)

### 3. Adicione o Postgres
- Dentro do projeto: **New → Database → Add PostgreSQL.**

### 4. Ligue o banco ao app (2 variáveis)
No serviço do **app** (não no banco), aba **Variables**, adicione:

| Variável | Valor |
|---|---|
| `DATABASE_URL` | clique em referenciar → `${{ Postgres.DATABASE_URL }}` |
| `AUTH_SECRET` | qualquer texto longo e aleatório (ex.: cole um punhado de caracteres) |

Opcional, para já criar o seu login em vez do padrão:

| Variável | Valor |
|---|---|
| `ADMIN_EMAIL` | seu-email@exemplo.com |
| `ADMIN_SENHA` | uma senha forte (≥ 8 caracteres) |
| `ADMIN_NOME` | Katarina |

### 5. Faça o deploy
- Salve as variáveis; o Railway re-builda automaticamente. Se não, **Deploy**.
- Quando ficar verde, o app gera as tabelas e cria a administradora no start.

### 6. Abra e entre
- No serviço do app → **Settings → Networking → Generate Domain** para ter uma URL pública.
- Acesse a URL. Login:
  - se você definiu `ADMIN_EMAIL`/`ADMIN_SENHA`: use os seus;
  - senão, o padrão: **admin@kais.local / kais12345** (troque depois).

## O que roda sozinho no deploy
`npm run start:prod` = `prisma db push` (cria as tabelas a partir do schema) +
`seed:admin` (cria a 1ª administradora, uma única vez) + `next start`. É idempotente:
re-deploys não duplicam nada.

## Vercel?
Dá para usar a Vercel, mas ela **não hospeda banco** — você precisaria de um Postgres
externo (ex.: Neon) e colar a `DATABASE_URL` dele nas variáveis da Vercel. Por isso o
Railway é mais simples para começar: um lugar só.

## Cron de recorrências
Depois de no ar, no serviço do app o Railway permite agendar. Ou use o `vercel.json`
se migrar para a Vercel. Não é obrigatório para o app funcionar.
