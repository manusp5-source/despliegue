# Client onboarding kit — Dokploy

How a new installation gets set up. One client, one server, three possible
applications. The goal of this kit is for onboarding someone to take
**forty minutes and not a single secret typed by hand**.

```bash
node alta-cliente.mjs --cliente="Clínica Dental Ejemplo" --dominio=clinicaejemplo.es --pack=recepcion
```

That writes `clientes/{slug}/` with a `.env` per application —secrets already
generated, domains already filled in— and an `ALTA.md` that is that specific
client's runbook: what DNS to create, what to paste into Dokploy, and what's
left before the handoff can be signed off.

---

## The packs

| Pack | Applications | For whom | Subdomains |
|---|---|---|---|
| `recepcion` | Multichannel chatbot | Clinics. This is the product | 3 |
| `comercial` | Agendia CRM | Businesses with a B2B sales cycle | 1 |
| `completo` | Chatbot + CRM + assistant | Large client, or your own installation | 6 |

They're sold separately and installed separately. A client who starts with
`recepcion` and later wants the CRM isn't reinstalled from scratch: one more
service is added in Dokploy, with its own `.env`.

---

## Why Dokploy and not EasyPanel

The guides that ship with all three apps (`DEPLOY_EASYPANEL.md`) are written
for EasyPanel, but **it doesn't need to be installed**. The
`docker-compose.easypanel.yml` files don't publish ports, don't carry Traefik
labels, and don't declare networks: they delegate the domain and TLS to the
platform. That's exactly what Dokploy does too.

It translates like this:

| The guide says | In Dokploy |
|---|---|
| "Paste this into EasyPanel → Compose" | Create → **Compose**, pointing at the repository |
| "EasyPanel → Env" | **Environment** tab |
| "Assign the Domain to this service" | **Domains** → service + port |
| "EasyPanel manages TLS" | Traefik manages it just the same |

**The one thing you need to add:** the service that carries a domain has to
be on the `dokploy-network` network for Traefik to reach it. Check on your
instance whether Dokploy attaches it automatically when the domain is
assigned; if not, declare it as external in the compose file and add it to
the service.

---

## Before the first onboarding, once

1. **Three private repositories**, one per application: `eskailet-crm`,
   `eskailet-chatbot`, `andria`. Dokploy builds from source (the compose
   files use `build:`, not published images), so it needs access.

   **Private isn't a preference.** All three licenses prohibit publishing the
   code. A public repository would be a breach, not an oversight.

2. **Connect the Git provider** in Dokploy (GitHub App or deploy key).

3. **Turn off auto-deploy.** If it's on, any push to `main` goes live for
   every client at once. Deployment is done by hand, client by client.

---

## Onboarding, step by step

### 1 · Generate the package

```bash
node alta-cliente.mjs --cliente="Clínica Dental Ejemplo" \
                      --dominio=clinicaejemplo.es \
                      --pack=recepcion \
                      --marca="Clínica Ejemplo" \
                      --email=direccion@clinicaejemplo.es
```

`--marca` is the name the client will see inside the application. If you
don't set it, the client's name is used.

The script **never overwrites an already-onboarded client**: if the folder
exists with files in it, it stops. Regenerating the secrets of a running
installation leaves it inaccessible with no obvious way back.

### 2 · DNS

One A record per subdomain, pointing at the server's IP, per the table in
`ALTA.md`. **Before touching Dokploy.** If DNS hasn't propagated, Traefik
can't get the certificate and the deployment looks broken when it's just
waiting.

### 3 · Create the service in Dokploy

For each application in the pack: Compose → repository →
`docker-compose.easypanel.yml` → paste the `.env` into Environment → assign
domains → Deploy.

The first boot applies all migrations and seeds the admin user. On a modest
server that can take over a minute: the healthcheck's `start_period` is set
to 180s for exactly that reason. **Don't call it failed too early.**

### 4 · Initial configuration inside each app

It's in the client's `ALTA.md` and in detail in
[`entrega-cliente.md`](entrega-cliente.md). What can't be skipped:

- **Chatbot:** real API keys, webhook URLs copied into the provider's panel,
  and both agents' prompts with no `[[ RELLENAR: … ]]` placeholders left.
- **CRM:** brand and tax details (without them the quote PDFs come out
  blank) and **backups with a tested restore**.
- **Assistant:** OpenAI key.

### 5 · Handoff

Checklist in [`entrega-cliente.md`](entrega-cliente.md). Credentials go
through a password manager, never over WhatsApp or email.

---

## Resources per server

One installation per client. What each pack takes up:

| Pack | Containers | Minimum RAM | Notes |
|---|---|---|---|
| `recepcion` | 7 | 4 GB | Postgres with pgvector, Redis, API, worker, beat, panel and MCP |
| `comercial` | 3 | 2 GB | Postgres, backend and frontend |
| `completo` | 13 | 8 GB | Both of the above plus the assistant and its Postgres |

**Two warnings that aren't up for debate:**

- **The CRM backend runs on a single replica.** Rate limiting, Gmail sync,
  the backup trigger, and the Calendar queue keep state in the process's
  memory. With two replicas those jobs run twice over. If it's undersized,
  scale up CPU and RAM instead.
- **Each application has its own Postgres.** The chatbot and the assistant
  require `pgvector/pgvector:pg16`; the CRM requires exactly `postgres:16`,
  because its backend bundles `pg_dump` 16 for backups and server and client
  have to match. Don't consolidate them into a single instance to save
  memory: it saves you 200 MB and costs you your backups.

---

## The secrets, and why each has its own format

The script generates them correctly. This is for when it's time to diagnose
why something won't start:

| Secret | Format | What happens if you get it wrong |
|---|---|---|
| Postgres password | **hex**, never base64 | It travels inside the connection URL; `+` and `/` break it apart. Symptom: `password authentication failed` in a loop, with the correct password right there |
| `JWT_SECRET` | base64, 48 bytes | If it changes, everyone's session gets logged out |
| CRM `ENCRYPTION_KEY` | base64, 32 bytes | **If it's lost, the credentials stored inside the CRM are unrecoverable** |
| Chatbot `ENCRYPTION_KEY` | **Fernet** (URL-safe base64 with padding) | With plain base64 the backend won't start |
| `TRUSTED_PROXY_COUNT` | `1` with Dokploy | With `0`, rate limiting always sees Traefik's IP and throttles everyone at once |

---

## What's NOT here

`clientes/` is in `.gitignore` and isn't versioned: it holds plaintext
secrets for live production installations. The good copy lives in the
password manager.

If you lose a `.env` and the installation is still up, the secrets can be
read from Dokploy → Environment. If you lose both, the credentials stored
inside each app need to be rotated and re-entered.
