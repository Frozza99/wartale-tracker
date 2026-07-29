# Ledger de Ascensão — Wartale Tracker

Site que acompanha diariamente os personagens de nível 160-178 do Wartale,
usando a **API oficial** pro ranking Top Level (nível, EXP exata e % de
progresso — os mesmos números que aparecem no jogo/fórum) e o ranking
público do site pros extras (mineração, pesca, PvP).

---

## O que mudou nessa versão (importante)

Antes o site "chutava" o progresso porque só tínhamos o nível público.
Agora, com a API oficial, os dados são **exatos**: `exp`, `expPercentage`
e clã (`clanName`) vêm prontos da própria Wartale — nada estimado.

Por causa disso, **o histórico antigo foi zerado** (o formato dos dados
mudou). O site começa a contar do zero a partir da primeira coleta com a
API configurada.

---

## Passo 1 — Configurar a API oficial (obrigatório)

O site só funciona se você configurar 2 segredos no GitHub. Sem eles, a
coleta do Top Level falha (mas os outros rankings continuam funcionando).

1. No painel de documentação da API do Wartale (`Wartale API v1`), vá em
   **Environments → PRD** e copie o valor de `BaseUrl`. Se estiver
   marcado como "secret" (oculto), procure um ícone de olho 👁️ ou o
   toggle **"Show vars"** no canto superior direito da tela pra revelar.
2. Gere sua própria API key em **Authorization**, marcando a permissão
   **"Ranking"**.
3. No seu repositório do GitHub, vá em **Settings → Secrets and
   variables → Actions → New repository secret** e crie:
   - `WARTALE_API_BASE_URL` → o valor do BaseUrl de PRD (ex: `https://wartale.com`)
   - `WARTALE_API_KEY` → a sua API key
   - `DISCORD_WEBHOOK_URL` *(opcional)* → se quiser avisos no Discord quando
     alguém sobe de nível (veja o Passo 4)

---

## Passo 2 — Subir o projeto (se ainda não subiu)

1. Crie uma conta em https://github.com/signup
2. **New repository** → nome `wartale-tracker` → **Public** → **Create repository**
3. **Add file → Upload files** → arraste todos os arquivos deste projeto
   (mantendo as pastas `.github/workflows` e `data`) → **Commit changes**

Se já tinha subido antes, é só arrastar os arquivos novos de novo — o
GitHub sobrescreve os que mudaram. Os arquivos importantes dessa
atualização são: `scraper.js`, `index.html`, `sobre.html`, `class-map.json`,
`.github/workflows/update.yml` e `data/history.json` (resetado).

## Passo 3 — Ativar o site (GitHub Pages)

**Settings → Pages** → Build and deployment: **Deploy from a branch** →
Branch `main`, pasta `/ (root)` → **Save**. O link aparece no topo da
mesma página em 1-2 minutos.

## Passo 4 — Rodar a primeira coleta

**Actions → "Atualizar ranking Wartale" → Run workflow → Run workflow**.
Espere uns 30 segundos e confira se deu ✔️ verde. Se der ❌ vermelho,
clique no run pra ver o log de erro (o motivo mais comum é secret
faltando ou digitado errado).

Depois disso ele roda sozinho a cada 30 minutos.

### Configurar avisos no Discord (opcional)
1. No Discord, vá no servidor → Configurações do canal → Integrações →
   Webhooks → **Novo Webhook** → copie a URL
2. Adicione como secret `DISCORD_WEBHOOK_URL` no GitHub (Passo 1.3)
3. Pronto — toda vez que alguém subir de nível, o site posta uma
   mensagem automática no canal.

---

## Estrutura do projeto

```
wartale-tracker/
├── index.html         → o site (ranking, ficha, comparação, clãs)
├── sobre.html          → página "como funciona"
├── class-map.json      → mapa de classe (número da API → nome) — inferido, editável
├── exp-table.json       → tabela de EXP LEGADA (não usada mais pro Top Level,
│                          só serve de referência pra estimativa de "dias até 178")
├── expTable.js           → funções auxiliares (legado)
├── scraper.js             → busca API oficial (Top Level) + HTML público (mineração/pesca/pvp)
├── package.json
├── data/
│   └── history.json        → histórico diário (atualizado sozinho)
└── .github/workflows/
    └── update.yml            → agenda a coleta a cada 30 min
```

## Se algo não bater

- **`class-map.json` mostrando classe errada**: o número de classe da API
  não veio documentado com os nomes — foi inferido pela ordem dos ícones
  no site oficial. Se algum aparecer errado, edite o número certo nesse
  arquivo (ex: `"3": "Archer"` → troque `"Archer"` pelo nome certo).
- **Ranking de mineração/pesca/PvP parar de funcionar**: esses ainda vêm
  do HTML público (não achamos a doc confirmada da API pra eles). Se o
  Wartale mudar o layout dessas páginas, me manda o erro do log da aba
  Actions que eu ajusto o parser.
- **"WARTALE_API_BASE_URL e/ou WARTALE_API_KEY não configurados"** no log
  → volte no Passo 1, os secrets não foram salvos corretamente.

Qualquer erro, me manda a mensagem exata do log (aba Actions → clique no
run → clique no step que falhou) que eu resolvo com você.
