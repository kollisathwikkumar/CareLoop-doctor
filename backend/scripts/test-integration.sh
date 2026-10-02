#!/bin/sh
set -eu

export PATH="/opt/homebrew/bin:$PATH"

supabase db reset --no-seed
docker exec -i supabase_db_careloop psql -U postgres -d postgres -v ON_ERROR_STOP=1 < tests/integration.sql

SUPABASE_URL="$(supabase status -o json | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>process.stdout.write(JSON.parse(s).API_URL))')"
SUPABASE_ANON_KEY="$(supabase status -o json | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>process.stdout.write(JSON.parse(s).ANON_KEY))')"
SUPABASE_SERVICE_ROLE_KEY="$(supabase status -o json | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>process.stdout.write(JSON.parse(s).SERVICE_ROLE_KEY))')"
export SUPABASE_URL SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY
node tests/phone-otp-smoke.mjs
unset SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY
