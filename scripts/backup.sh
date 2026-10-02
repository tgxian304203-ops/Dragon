#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# 💾 BACKUP — mongodump 2 Kho (SC1, H42)
# Chạy: bash scripts/backup.sh
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

if [ ! -f .env ]; then
  echo "❌ Không tìm thấy file .env"
  exit 1
fi

export $(grep -v '^#' .env | grep -v '^$' | xargs)

if [ -z "${MONGO1_URI:-}" ] || [ -z "${MONGO2_URI:-}" ]; then
  echo "❌ Thiếu MONGO1_URI hoặc MONGO2_URI trong .env"
  exit 1
fi

if ! command -v mongodump &> /dev/null; then
  echo "❌ Chưa cài mongodump."
  echo "   Cài: https://www.mongodb.com/try/download/database-tools"
  exit 1
fi

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="backup/${TIMESTAMP}"
mkdir -p "${BACKUP_DIR}"

echo "🐉 Rồng Thần — Bắt đầu backup"
echo "📁 Thư mục: ${BACKUP_DIR}"
echo ""

echo "📦 [1/2] Backup Kho 1..."
mongodump --uri="${MONGO1_URI}" --out="${BACKUP_DIR}/kho1" --quiet
echo "✅ Kho 1 xong"

echo ""
echo "📦 [2/2] Backup Kho 2..."
mongodump --uri="${MONGO2_URI}" --out="${BACKUP_DIR}/kho2" --quiet
echo "✅ Kho 2 xong"

echo ""
echo "🗜️  Đang nén..."
tar -czf "${BACKUP_DIR}.tar.gz" -C "${BACKUP_DIR}" .
rm -rf "${BACKUP_DIR}"

SIZE=$(du -h "${BACKUP_DIR}.tar.gz" | cut -f1)

echo ""
echo "═══════════════════════════════════════"
echo "✅ Backup hoàn tất"
echo "📁 File: ${BACKUP_DIR}.tar.gz"
echo "📊 Kích thước: ${SIZE}"
echo "═══════════════════════════════════════"