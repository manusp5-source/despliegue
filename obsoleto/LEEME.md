# Retired stack — Caddy + UnicornIA-CRM

**Don't run anything from this folder.** It's kept for the reasoning, not
the commands.

Retired on August 17, 2026, Wave 4 of the umbrella refactor. What's in here
had already been marked obsolete in the parent folder's `README.md` since
August 15; this just makes it effective by moving the files, so nobody runs
a `docker compose up` out of habit against a retired project.

## What's here

| File | What it was |
|---|---|
| `docker-compose.yml` | The full stack for a clinic: `crm`, `n8n`, `langfuse`, `db`, `redis`, `minio` and `proxy` |
| `Caddyfile` | Automatic TLS and routing of the three domains to `crm:3000`, `n8n:5678` and `langfuse:3000` |
| `init-db.sh` | Created the `unicornia_crm`, `n8n` and `langfuse` databases on first boot. Only mounted by the compose file above |
| `.env.example` | This stack's variables (`DOMINIO_CRM`, `NEXTAUTH_SECRET`, `MINIO_USER`…). Declared `POSTGRES_DB=unicornia_crm`, a database that no longer exists |

## Why it was retired

Two reasons, both predating this wave:

- **DEC-021 — `UnicornIA-CRM` is retired.** The compose built from
  `../UnicornIA-CRM` (`docker-compose.yml:75`). That's the CRM that decision
  1 in the umbrella's `CLAUDE.md` drops in favor of `eskailet-crm`.
- **DEC-022 — Caddy is replaced by Dokploy.** TLS and domains are managed by
  Traefik from Dokploy, so the `proxy` service and this `Caddyfile` are no
  longer needed.

**Note:** `DEC-021` and `DEC-022` are cited in the parent `README.md` but
**aren't documented in any umbrella `DECISIONS.md`**. A search for those
identifiers returns nothing outside of here. Worth writing them up where
they belong.

## What's used instead

[`../dokploy/`](../dokploy/). It already points to `eskailet-crm`
(`alta-cliente.mjs:223` → `REPOS = { crm: 'eskailet-crm', … }`) and covers
all three applications via packs.

## Why it wasn't rewritten toward `eskailet-crm`

It seemed like the obvious option and it's the wrong one. This stack puts
`crm`, `n8n` and `langfuse` into **a single shared Postgres**, and the
active kit says the opposite for a specific reason
(`../dokploy/README.md:140-144`):

> Each application has its own Postgres. The chatbot and the assistant
> require `pgvector/pgvector:pg16`; the CRM requires exactly `postgres:16`,
> because its backend bundles `pg_dump` 16 for backups and server and
> client have to match.

Also, `eskailet-crm` isn't one service, it's **two** (Express backend +
nginx frontend), so this compose's `crm:` block doesn't fit it. Adapting it
would have left two deployment stacks to maintain in parallel.

## If we ever need to go back

The files are intact and git history follows them through the rename. To
recover the stack as it was:

```bash
git log --follow -- despliegue/obsoleto/docker-compose.yml
```

The `.env.example` was moved here along with the rest: it only served this
stack and declared `POSTGRES_DB=unicornia_crm`. The active kit doesn't use
it — it generates a `.env` per client and per application with
`alta-cliente.mjs`.

The parent folder's real `.env` is still where it was and **isn't
versioned** (`.gitignore`). If it had secrets from a live installation,
they're still there.
