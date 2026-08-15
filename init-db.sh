#!/bin/bash
# Crea las bases de n8n y Langfuse la primera vez que arranca Postgres.
#
# Comparten servidor pero no base a proposito: si el historial de n8n crece
# sin control o una migracion de Langfuse sale mal, no se lleva por delante
# los datos de los pacientes, que son los unicos irrecuperables.
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
  CREATE DATABASE n8n;
  CREATE DATABASE langfuse;
EOSQL

echo "bases n8n y langfuse creadas"
