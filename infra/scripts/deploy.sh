#!/usr/bin/env bash
# Previews or applies infra/main.bicep on the QA (pre-production) resource group.
#
#   infra/scripts/deploy.sh what-if   # shows what would change; changes nothing
#   infra/scripts/deploy.sh apply     # creates or updates the resources
#
# Reads the secrets from infra/.env.qa (see bootstrap.sh). IMAGE_TAG defaults to the tag that
# ca-farm-server runs now, so re-applying the infrastructure never rolls the apps back. Set it
# for the first deployment: IMAGE_TAG=<commit SHA built by deploy-qa.yml>.
# DEMO_MODE=true keeps one replica of server, admin and web warm (no cold starts).
set -euo pipefail

MODE="${1:-what-if}"
RG="${RG:-rg-farmacia-bm}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ENV_FILE="$ROOT/infra/.env.qa"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE. Run infra/scripts/bootstrap.sh first." >&2
  exit 1
fi
set -a
# shellcheck source=/dev/null
source "$ENV_FILE"
set +a

if [[ -z "${IMAGE_TAG:-}" ]]; then
  current="$(az containerapp show --resource-group "$RG" --name ca-farm-server \
    --query 'properties.template.containers[0].image' -o tsv 2>/dev/null || true)"
  IMAGE_TAG="${current##*:}"
fi
if [[ -z "${IMAGE_TAG:-}" ]]; then
  echo "Set IMAGE_TAG to a commit SHA whose images exist in GHCR." >&2
  exit 1
fi
export IMAGE_TAG
echo "Resource group: $RG · image tag: $IMAGE_TAG · demo mode: ${DEMO_MODE:-false}"

args=(
  --resource-group "$RG"
  --template-file "$ROOT/infra/main.bicep"
  --parameters "$ROOT/infra/main.bicepparam"
)

case "$MODE" in
  what-if)
    az deployment group what-if "${args[@]}"
    ;;
  apply)
    az deployment group create --name "farmacia-qa-$(date +%Y%m%d%H%M%S)" "${args[@]}" \
      --query properties.outputs -o json
    ;;
  *)
    echo "Usage: $0 what-if|apply" >&2
    exit 2
    ;;
esac
