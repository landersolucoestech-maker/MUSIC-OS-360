#!/bin/bash
set -e

echo "MUSIC OS 360 — Setup Dev Environment"

# 1. Create a local .env.development if it does not exist (there is no .env.example anymore —
#    apps/api/.env.production documents the full variable list, with
#    placeholders; copy the structure and fill it with real DEV values)
if [ ! -f apps/api/.env.development ]; then
  cp apps/api/.env.production apps/api/.env.development
  echo "apps/api/.env.development created from apps/api/.env.production — fill it with real DEV values before starting"
fi

# 2. Install dependencies
echo "Installing API dependencies..."
cd apps/api && npm install && cd ../..

echo ""
echo "Setup completed!"
echo "  Frontend:  npm run dev:web        → http://localhost:5000"
echo "  Backend:   cd apps/api && npm run dev → http://localhost:3001"
echo "  Swagger:   http://localhost:3001/docs"
echo ""
echo "Next steps:"
echo "  1. Configure apps/api/.env.development with the environment variables (Neon, Supabase Auth, Stripe, etc.)"
echo "  2. Execute: cd apps/api && npm run db:push"
