#!/usr/bin/env bash
# Generate a Grafana Service Account token for MCP server access
# Usage: ./scripts/grafana-setup-token.sh
# Requires: Grafana running at localhost:3000

GRAFANA_URL="http://localhost:3000"
GRAFANA_ADMIN="admin"
GRAFANA_PASS="jaskier"
SA_NAME="claude-mcp"
TOKEN_NAME="claude-code-mcp"

echo "=== Grafana MCP Token Setup ==="

# Wait for Grafana to be ready
echo "Waiting for Grafana..."
for i in $(seq 1 30); do
  if curl -s "$GRAFANA_URL/api/health" | grep -q "ok"; then
    echo "Grafana is ready."
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "ERROR: Grafana not ready after 30s"
    exit 1
  fi
  sleep 1
done

# Check if service account already exists
EXISTING=$(curl -s -u "$GRAFANA_ADMIN:$GRAFANA_PASS" \
  "$GRAFANA_URL/api/serviceaccounts/search?query=$SA_NAME")

SA_ID=$(echo "$EXISTING" | grep -o '"id":[0-9]*' | head -1 | grep -o '[0-9]*')

if [ -z "$SA_ID" ]; then
  echo "Creating service account '$SA_NAME'..."
  SA_RESPONSE=$(curl -s -u "$GRAFANA_ADMIN:$GRAFANA_PASS" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"$SA_NAME\",\"role\":\"Admin\"}" \
    "$GRAFANA_URL/api/serviceaccounts")
  SA_ID=$(echo "$SA_RESPONSE" | grep -o '"id":[0-9]*' | head -1 | grep -o '[0-9]*')
  echo "Created service account ID: $SA_ID"
else
  echo "Service account '$SA_NAME' already exists (ID: $SA_ID)"
  # Delete existing tokens to regenerate
  TOKENS=$(curl -s -u "$GRAFANA_ADMIN:$GRAFANA_PASS" \
    "$GRAFANA_URL/api/serviceaccounts/$SA_ID/tokens")
  TOKEN_IDS=$(echo "$TOKENS" | grep -o '"id":[0-9]*' | grep -o '[0-9]*')
  for TID in $TOKEN_IDS; do
    curl -s -u "$GRAFANA_ADMIN:$GRAFANA_PASS" -X DELETE \
      "$GRAFANA_URL/api/serviceaccounts/$SA_ID/tokens/$TID" > /dev/null
  done
fi

# Generate new token
echo "Generating token '$TOKEN_NAME'..."
TOKEN_RESPONSE=$(curl -s -u "$GRAFANA_ADMIN:$GRAFANA_PASS" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"$TOKEN_NAME\"}" \
  "$GRAFANA_URL/api/serviceaccounts/$SA_ID/tokens")

TOKEN=$(echo "$TOKEN_RESPONSE" | grep -o '"key":"[^"]*"' | sed 's/"key":"//;s/"//')

if [ -z "$TOKEN" ]; then
  echo "ERROR: Failed to generate token"
  echo "$TOKEN_RESPONSE"
  exit 1
fi

echo ""
echo "=== Token Generated ==="
echo "$TOKEN"
echo ""
echo "Add to your Claude Code settings:"
echo "  GRAFANA_SERVICE_ACCOUNT_TOKEN=$TOKEN"
echo ""
echo "Or run:"
echo "  claude config set env.GRAFANA_SERVICE_ACCOUNT_TOKEN \"$TOKEN\""
