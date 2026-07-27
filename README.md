<<<<<<< HEAD
# Estúdio Digital

Plataforma de atendimento com IA para estúdio de tatuagem — orquestração
via WhatsApp, qualificação de lead por extração livre de linguagem natural,
motor de precedentes visuais e painel de aprovação manual.

## Arquitetura (v1, single-tenant)

- **API**: Node.js + TypeScript + Fastify (`apps/api`)
- **Web**: React + Vite — web app do cliente + painel do estúdio (`apps/web`)
- **Banco**: Postgres + extensão `pgvector` (via Docker)
- **Fila/sessão**: Redis + BullMQ
- **Orchestrator**: dois passes por turno —
  1. Extração de slots (`claude-haiku-4-5-20251001`) → atualiza o `lead_profile`
  2. Geração da resposta conversacional (`claude-sonnet-5`) → usa o profile + checklist do que falta

## Pré-requisitos

- Node.js 20+
- Docker + Docker Compose
- Uma chave de API da Anthropic (`ANTHROPIC_API_KEY`)

## Passo a passo

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar variáveis de ambiente

```bash
cp .env.example .env
# edite .env e preencha ANTHROPIC_API_KEY no mínimo
```

### 3. Subir Postgres + Redis

```bash
npm run db:up
```

### 4. Habilitar a extensão pgvector e rodar as migrations

```bash
docker exec -it estudio-digital-db psql -U estudio -d estudio_digital -c "CREATE EXTENSION IF NOT EXISTS vector;"
npm run db:migrate
```

### 5. Validar o Orchestrator (sem WhatsApp ainda)

```bash
npm run dev:api
```

Em outro terminal:

```bash
curl -X POST http://localhost:3333/orchestrator/test \
  -H "Content-Type: application/json" \
  -d '{
    "history": [{"role":"user","content":"oi quero fazer uma tatuagem quanto é?"}],
    "profile": {"tipo":"orcamento"}
  }'
```

Isso simula exatamente o teste que fizemos em conversa — sem depender do
webhook do WhatsApp ainda.

### 6. Subir o painel web

```bash
npm run dev:web
```

### 7. Conectar o WhatsApp (quando o Orchestrator estiver validado)

1. Criar app no [Meta for Developers](https://developers.facebook.com/)
2. Configurar produto **WhatsApp** → pegar `WHATSAPP_PHONE_NUMBER_ID` e `WHATSAPP_ACCESS_TOKEN`
3. Configurar o webhook apontando para `https://SEU_DOMINIO/webhooks/whatsapp`
   (em desenvolvimento local, use `ngrok` ou similar para expor a porta 3333)
4. Definir `WHATSAPP_VERIFY_TOKEN` no `.env` — precisa bater com o token
   configurado no painel da Meta
5. Implementar a normalização do payload em `src/routes/webhook.whatsapp.ts`
   (já tem os `TODO`s marcados no arquivo)

## Escopo da v1 — o que está dentro

- WhatsApp como canal principal (Meta Cloud API direto)
- Web app sem login, com handoff via token de sessão
- Extração livre de lead (não árvore de estados fixa) + checklist server-side
- Busca de referência real (web) e motor de precedentes (acervo próprio via pgvector)
- Lead scoring determinístico (regras, sem modelo dedicado)
- Módulo de contrato/anamnese separado, com acesso mais restrito (dado sensível de saúde — LGPD)
- Programas de fidelização com resultado sempre determinístico (evita enquadramento como sorteio/SECAP)

## Fora da v1 (backlog v2)

- Instagram (exige app review da Meta)
- Geração de imagem via fine-tuning próprio (LoRA sobre o portfólio do artista)
- Mini-jogos no app
- Avatar animado de "pensando" no web app
- Multi-tenant (schema já não tem `tenant_id` — decisão consciente de manter simples até virar produto)
=======
# digital-studio
>>>>>>> origin/main
