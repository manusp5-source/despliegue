# Deployment and technical decisions

> ## The active kit is [`dokploy/`](dokploy/)
>
> A client is onboarded with:
>
> ```bash
> node dokploy/alta-cliente.mjs --cliente="..." --dominio=... --pack=recepcion
> ```
>
> The previous stack —Caddy on top of `UnicornIA-CRM`— **was retired on
> 08/17/2026** and now lives in [`obsoleto/`](obsoleto/), with the reasoning
> written up in its `LEEME.md`: `UnicornIA-CRM` is retired (DEC-021) and Caddy
> is replaced by Dokploy (DEC-022).
>
> **The rest of this document describes that retired stack.** It's kept
> because the reasoning is still valid —why three layers of observability, why
> TypeScript and not LangGraph, why one installation per client— but **the
> commands and services no longer apply**. To deploy, go to `dokploy/`; this
> is reading material, not something to run.

How this gets up and running in a clinic, what's used to monitor it, and why
it's written the way it's written.

---

## Table of contents

1. [Where the workflows run](#1-where-the-workflows-run)
2. [Observability: what each tool looks at](#2-observability)
3. [Why TypeScript and not Python/LangChain/LangGraph](#3-why-typescript-and-not-python)
4. [The deployment, service by service](#4-the-deployment)

---

## 1. Where the workflows run

**So far, nowhere.** That's the honest answer.

The 14 workflows are JSON files in `clinicas-web/automatizaciones/workflows/`.
Nobody has imported them yet. There was no n8n at all in this project's
Docker setup — only Postgres, Redis and MinIO, which are the CRM's
dependencies.

With this compose, n8n becomes just another service in the stack and the
workflows are mounted at `/workflows` inside the container, ready to import
from the UI.

**What's still unverified**, and can only be seen by importing them: whether
n8n interprets the expressions correctly, whether the Gmail, Drive and Google
Places credentials are valid, and whether the triggers fire on schedule.
Budget half a morning the first time.

What **is** verified is the contract: every call a workflow will make exists
in the CRM, accepts what's sent to it, and returns the keys the `Code` node
will read (`npx tsx scripts/simular-workflows.ts`, 27/27). That's what
actually breaks an integration: a workflow with the right URL but the wrong
field name imports without complaint, activates, and fails silently for
weeks.

---

## 2. Observability

Three layers that each look at something different. They don't overlap.

| Layer | Answers | Where |
|------|-----------|-------|
| **n8n history** | Did the workflow run, and did it go well? | `n8n.tuclinica.es` |
| **CRM audit log** | Who touched what data, and when? | Panel → Admin |
| **Langfuse** | What did the model tell the patient, and why? | `logs.tuclinica.es` |

### Why all three, and not just n8n

n8n's history says a workflow finished green. It doesn't say what the model
wrote. And when a clinic asks —**and they will ask**— *"what did your
assistant tell this patient?"*, "it came back green" isn't an answer.

Langfuse stores every call to the model: the exact prompt, the response, the
cost, and how long it took. It serves three distinct purposes:

- **Debugging.** When triage misclassifies an email, you can see the text
  that came in and the category that came out, instead of guessing.
- **Controlling spend.** Every run has its cost. Without this, the OpenAI
  bill is just a number at the end of the month with no breakdown.
- **Proving compliance.** Being able to show that the clinical guardrail
  fired and referred the patient, with a timestamp, is the proof that the
  system did what you say it does.

### Self-hosted, not on Langfuse's cloud

Patient messages pass through here. It's health data processing, and sending
it to a third party outside the clinic's installation would open a GDPR
conversation that doesn't need to happen. The container runs in the same
stack, against the same Postgres, and the data never leaves.

### What's still missing

The AI-powered workflows (24/7 reception, triage, team assistant) don't yet
send traces to Langfuse. The Langfuse `callback` needs to be added to the
model nodes. It's an afternoon's work and doesn't block the deployment.

---

## 3. Why TypeScript and not Python

The right question isn't "which language is better?" but **"what breaks if I
pick the other one?"**. Here:

### The CRM: TypeScript, and there wasn't much debate

| Reason | Detail |
|--------|---------|
| **It's a web application, not a model** | 95% of the code is forms, tables, calendars and permissions. Python adds nothing there and forces you to maintain two languages: one for the backend and JavaScript for the browser regardless |
| **One language end to end** | The `Reminder` type is the same in the database, in the API, and on screen. With FastAPI + React it has to be redefined twice and kept in sync by hand |
| **Prisma** | The schema is the source of truth and generates the types. When `EXPIRED` was added to the enum, the compiler flagged every place that needed to handle it. SQLAlchemy doesn't give you that |
| **One person** | Working solo, two languages means double the dependencies, double the CI, and double the things that break on upgrade |

### So then, why not LangChain or LangGraph?

This part deserves an explanation, because there **is** an agent talking to
patients.

**Because the AI portion of this product is tiny, on purpose.**

Look at what the system actually does:

- An appointment reminder is a template with a date. No model involved.
- Filling open slots is sorting candidates by four criteria. It's a pure
  40-line function, tested with 34 cases. A model would do it worse and
  you wouldn't know why it picked who it picked.
- Budget follow-up is three messages sent at 3, 10 and 30 days.
- The clinical guardrail is a **word list**. Deliberately. An LLM classifier
  would be more elegant and less reliable, and here a false negative means a
  system giving an opinion on a patient's symptom.

LangGraph solves agent graphs with state, cycles and complex decisions. This
product doesn't have that: it has **one** conversational agent, with
conversation memory and a deterministic guardrail in front of it. Bringing in
LangGraph for that means adding a large dependency, another language and
another runtime to solve a problem you don't have.

**And where an agent actually is needed, there's already something better
suited for the job: n8n.**

| | LangGraph | n8n |
|---|---|---|
| Who can touch it | whoever knows Python | you, and eventually the clinic |
| Seeing why it failed | reading traces | looking at the red node |
| Adding "notify via Telegram" | writing code | dragging a node |
| Sellable as a product | can't be shown on screen | **shown right on screen** |

That last point isn't minor: you can open n8n in front of the doctor and
**show them the diagram** of what their system does. A LangGraph graph can't
be shown that way.

### When I'd change my mind

It would be dishonest to say TypeScript always wins. I'd switch to Python if:

- The clinic needed a model **trained or fine-tuned** on its own data.
- The assistant's RAG grew to thousands of documents requiring serious
  re-ranking and evaluation — there the Python ecosystem is years ahead.
- An agent with **many steps and backtracking** appeared (for example, an
  agent that negotiates a phased treatment plan). That would genuinely call
  for LangGraph.

None of the three applies today. The first probably never will in a
4-chair clinic.

### The summary in one sentence

> This product isn't an AI application with a CRM bolted on. It's a CRM that
> uses AI in two very specific places, and those two places are better served
> by a workflow that can be shown on screen than by a framework that can't.

---

## 4. The deployment

### The services

| Service | What for | Exposed |
|----------|----------|----------|
| `proxy` (Caddy) | Automatic TLS and the single entry point | **80, 443** |
| `crm` | The application | no |
| `n8n` | The 14 workflows | no |
| `langfuse` | AI traces | no |
| `db` (Postgres 16) | CRM, n8n and Langfuse data | no |
| `redis` | Job queue | no |
| `minio` | X-rays, consent forms | no |

Only the proxy has published ports. Everything else talks over Docker's
internal network, so `n8n` calls the CRM at `http://crm:3000` without going
out to the internet and back.

### Three databases on a single Postgres

The CRM's database, `n8n`'s and `langfuse`'s, created by `init-db.sh`. They
share a server but not a database: if n8n's history grows out of control or a
Langfuse migration goes wrong, it doesn't take down the patient data, which
is the only thing that's truly unrecoverable.

**This is no longer how it's done.** The `dokploy/` kit gives each
application its own Postgres, and not for the fun of it: the chatbot and the
assistant require `pgvector/pgvector:pg16` and the CRM requires exactly
`postgres:16`, because its backend bundles `pg_dump` 16 for backups and
server and client have to match. See
[`dokploy/README.md`](dokploy/README.md) → "Resources per server."

### Getting it running

```bash
cd despliegue
cp .env.example .env       # fill in domains and secrets
docker compose up -d --build
docker compose logs -f crm # wait until it's healthy

# schema and initial user
docker compose exec crm npx prisma db push
docker compose exec crm npx tsx prisma/seed.ts
```

Then, in n8n: import the workflows from `/workflows`, assign the
`REEMPLAZAR_CON_*` credentials, and **activate only the heartbeat**. Wait ten
minutes and check that green runs appear every five.

### Backups

The only thing that's unrecoverable is Postgres. MinIO is worth backing up,
Redis doesn't matter.

```bash
docker compose exec -T db pg_dump -U $POSTGRES_USER "$POSTGRES_DB" | gzip > backup-$(date +%F).sql.gz
```

(In the active stack the CRM handles its own backups from Settings › Backups,
and that's where a restore needs to be tested before handoff.)

Put it on a daily cron job off the server. **A backup that lives on the same
machine as the database isn't a backup.**

### Schema changes in production

`db push` is used, not `migrate dev`. In this project `migrate dev` asks to
reset the database (see `DEC-D02` in the decisions log), and in a clinic that
means losing patient history. Before any change: dump the database, and
compare the row counts before and after.

### Before selling to a second clinic

**One installation per clinic.** No model carries an `organizationId`, so two
clinics on the same stack would see each other's data. This is documented as
`DEC-D06` and is the product's biggest outstanding debt.

Until then, a stack is spun up per client by changing the compose's `name:`
and the domains.
