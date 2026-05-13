#!/bin/bash

echo "======================================"
echo "    DEPLOY ORBITA QUEUE SYSTEM       "
echo "======================================"

echo "[1/4] Menarik update terbaru dari GitHub..."
git pull origin main

echo ""
echo "[2/4] Mem-build Frontend (Next.js)..."
cd frontend
npm install
npm run build
cd ..

echo ""
echo "[3/4] Mem-build Backend (NestJS)..."
cd backend
npm install
npx prisma generate
npm run build
cd ..

echo ""
echo "[4/4] Me-restart PM2 Services..."
pm2 restart all

echo ""
echo "======================================"
echo " ✅ Deploy Selesai dan Berhasil!     "
echo "======================================"
