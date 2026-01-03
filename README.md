# 🎮 Kessler Log

> **Diário pessoal de jogos**: registre suas **jogatinas**, acompanhe **tempo por sessão**, e mantenha um histórico organizado do que você jogou e quando.

<p align="center">
  <strong>React • TypeScript • Next.js • Tailwind • Supabase • Vercel</strong>
</p>

---

## ✨ Visão geral

O **Kessler Log** é uma aplicação web feita para você guardar e consultar informações sobre suas sessões de jogo: quando jogou, por quanto tempo, e o que rolou naquela jogatina (progresso, objetivos, notas, etc.).  
A experiência é focada em **velocidade**, **praticidade** e uma UI clean com **tema escuro** por padrão.

---

## ✅ O que você consegue fazer (atual / base do projeto)

- 🔐 **Autenticação com Supabase** (controle de sessão)
- 🚪 **Gate de entrada**: redireciona automaticamente para **/login** ou **/home** conforme a sessão
- 🌓 **Tema com `next-themes`** (dark por padrão, com suporte a system)

> Observação: as funcionalidades de log/estatísticas podem ser expandidas conforme você for implementando as telas de `home`, `sessions`, dashboards etc.

---

## 🧰 Stack

- **Next.js (App Router)** + **React** + **TypeScript**
- **Tailwind CSS** (UI rápida e consistente)
- **Supabase** (Auth + Database)
- **Vercel** (deploy)
- Extras:
  - **Recharts** (gráficos/estatísticas)
  - **Framer Motion** (animações)
  - **Lucide Icons** (ícones)

---

## 🚀 Começando

### 1) Pré-requisitos
- Node.js (recomendado: versão LTS recente)
- NPM / PNPM / Yarn (use o que você preferir)

### 2) Instalação
```bash
npm install
npm run dev
```

Acesse: `http://localhost:3000`

### 3) Variáveis de ambiente

Crie um arquivo **`.env.local`** na raiz do projeto:

```bash
NEXT_PUBLIC_SUPABASE_URL="https://xxxxx.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="sua_anon_key"
```

> Você encontra esses valores no Supabase em **Project Settings → API**.

---

## 🗂️ Scripts

```bash
npm run dev      # ambiente de desenvolvimento
npm run build    # build de produção
npm run start    # roda o build
npm run lint     # lint
```

---

## 🔐 Fluxo de autenticação (como está hoje)

- Ao abrir `/`, a aplicação verifica a sessão com Supabase.
- Se existir sessão: redireciona para **`/home`**
- Se não existir: redireciona para **`/login`**

---

## 📦 Deploy (Vercel)

1. Suba o projeto em um repositório (GitHub/GitLab/Bitbucket)
2. Importe na Vercel
3. Configure as mesmas variáveis do `.env.local` em **Project → Settings → Environment Variables**
4. Deploy ✅

---

## 🧠 Ideias de evolução (roadmap)

- 📝 CRUD de **Jogos** e **Sessões**
- ⏱️ Timer/cronômetro de sessão (start/pause/finish)
- 📊 Dashboard com:
  - tempo total por jogo
  - tempo por semana/mês
  - streaks e metas
- 🔎 Filtros (por jogo, plataforma, gênero, data)
- 🏷️ Tags (ex.: “zerado”, “platina”, “co-op”, “ranked”)
- 📤 Export (CSV/JSON) e backup

---

## 🤝 Contribuindo (pra você mesmo no futuro)

- Crie features pequenas (1 PR = 1 melhoria)
- Mantenha componentes reutilizáveis (UI/Forms/Charts)
- Use rotas por domínio (`/home`, `/sessions`, `/games`, `/stats`)

---

## 📄 Licença

Uso pessoal — do jeito que você quiser. 😄
