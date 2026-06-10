#!/bin/bash

echo "======================================"
echo "    DEPLOY ORBITA QUEUE SYSTEM       "
echo "======================================"

echo "[1/5] Menarik update terbaru dari GitHub..."
git pull origin main

echo ""
echo "[2/5] Mem-build Frontend (Next.js)..."
cd frontend
npm install
npm run build
cd ..

echo ""
echo "[3/5] Mem-build Backend (NestJS)..."
cd backend
npm install

# Ensure .env file exists
if [ ! -f .env ]; then
  echo "⚠️  File .env tidak ditemukan, membuat dari template..."
  cat > .env << 'EOF'
DATABASE_URL="file:./dev.db"
JWT_SECRET=orbita-queue-jwt-secret-key-2026
JWT_EXPIRATION=24h
BACKEND_PORT=3001
CORS_ORIGIN=*
TZ="Asia/Makassar"
HIS_SERVICE_UNIT_IDS=A101,A110,A112,A201
EOF
  echo "✅ File .env berhasil dibuat"
fi

# Generate Prisma client and push schema to database
npx prisma generate
npx prisma db push --accept-data-loss 2>/dev/null || npx prisma db push

npm run build

# Seed database if counters table is empty (first deploy)
echo "🔍 Memeriksa data counter di database..."
COUNTER_COUNT=$(node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.counter.count().then(c => { console.log(c); p.\$disconnect(); }).catch(() => { console.log(0); p.\$disconnect(); });
")
if [ "$COUNTER_COUNT" = "0" ]; then
  echo "📦 Database kosong, menjalankan seed..."
  npx prisma db seed
  echo "✅ Seed selesai"
else
  echo "✅ Database sudah ada $COUNTER_COUNT counter"
fi

cd ..

echo ""
echo "[4/5] Memastikan folder upload video ada..."
mkdir -p backend/public/uploads/videos
echo "✅ Folder upload siap"

echo ""
echo "[5/5] Me-restart PM2 Services..."
pm2 restart all --update-env

echo ""
echo "======================================"
echo " ✅ Deploy Selesai dan Berhasil!     "
echo "======================================"
echo ""
echo "🔗 Cek status: pm2 status"
echo "📋 Cek log:    pm2 logs"
