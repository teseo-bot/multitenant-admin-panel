#!/bin/bash

# ==============================================================================
# Script de Backup Teseo V2 (Inmutable & Zero-Trust)
# ==============================================================================

# Variables
DATE=$(date +%Y-%m-%d_%H-%M-%S)
PROJECT_DIR="/Users/teseohome/projects/Teseo-AI-CRM"
BACKUP_DIR="/Users/teseohome/projects/Teseo-AI-CRM/backups"
BACKUP_NAME="teseo_crm_backup_${DATE}.tar.gz"

# Crear directorio de backups si no existe
mkdir -p "$BACKUP_DIR"

echo "========================================"
echo "Iniciando Backup Zero-Trust del Proyecto"
echo "========================================"

# Comprimir excluyendo node_modules, .next, dist y otros artifacts pesados
tar -czvf "${BACKUP_DIR}/${BACKUP_NAME}" \
  --exclude="node_modules" \
  --exclude=".next" \
  --exclude="dist" \
  --exclude=".cache" \
  --exclude="google-cloud-sdk" \
  --exclude="backups" \
  -C "${PROJECT_DIR}" .

echo "========================================"
echo "Backup Completado Exitosamente."
echo "Archivo: ${BACKUP_DIR}/${BACKUP_NAME}"
echo "Peso:"
ls -lh "${BACKUP_DIR}/${BACKUP_NAME}" | awk '{print $5}'
echo "========================================"
