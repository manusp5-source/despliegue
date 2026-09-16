#!/bin/bash
# Creates the n8n and Langfuse databases the first time Postgres starts.
#
# They share a server but not a database on purpose: if n8n's history grows
# out of control or a Langfuse migration goes wrong, it doesn't take down
# the patient data, which is the only thing that's truly unrecoverable.
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
  CREATE DATABASE n8n;
  CREATE DATABASE langfuse;
EOSQL

echo "n8n and langfuse databases created"
