#!/bin/bash

API_URL="http://localhost:3000/api/v1/ingest"
TENANT_ID="tenant_test_$(date +%s)"
EXTERNAL_ID="msg_abc123_$(date +%s)"

echo "=== Test 1: Primer Payload (Ingreso exitoso) ==="
echo "Esperado: HTTP 202 Accepted"
curl -s -w "\nHTTP Status: %{http_code}\n" -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -H "idempotency-key: $EXTERNAL_ID" \
  -d '{
    "tenant_id": "'$TENANT_ID'",
    "source": "whatsapp",
    "payload": {
      "text": "Hola, necesito ayuda con mi cuenta."
    }
  }'

echo -e "\n--------------------------------------------------------\n"

echo "=== Test 2: Payload Duplicado (Prueba de Idempotencia) ==="
echo "Esperado: HTTP 200 OK (already_exists)"
curl -s -w "\nHTTP Status: %{http_code}\n" -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -H "idempotency-key: $EXTERNAL_ID" \
  -d '{
    "tenant_id": "'$TENANT_ID'",
    "source": "whatsapp",
    "payload": {
      "text": "Hola, necesito ayuda con mi cuenta."
    }
  }'
