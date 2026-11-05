#!/usr/bin/env bash
# Starts a Container Apps job and waits for it to finish; exits 1 if the run does not succeed.
#
#   infra/scripts/run-job.sh caj-farm-migrate                     # current image
#   infra/scripts/run-job.sh caj-farm-migrate ghcr.io/...:<sha>   # switch image, then run
#
# Used by .github/workflows/deploy-qa.yml and by hand (migrations, demo seed).
set -euo pipefail

JOB="${1:?Usage: $0 <job-name> [image]}"
IMAGE="${2:-}"
RG="${RG:-rg-farmacia-bm}"
TIMEOUT_SECONDS="${TIMEOUT_SECONDS:-900}"

if [[ -n "$IMAGE" ]]; then
  az containerapp job update --resource-group "$RG" --name "$JOB" --image "$IMAGE" --output none
fi

execution="$(az containerapp job start --resource-group "$RG" --name "$JOB" --query name -o tsv)"
echo "Started $execution"

deadline=$((SECONDS + TIMEOUT_SECONDS))
while ((SECONDS < deadline)); do
  status="$(az containerapp job execution show --resource-group "$RG" --name "$JOB" \
    --job-execution-name "$execution" --query properties.status -o tsv)"
  case "$status" in
    Succeeded)
      echo "$execution succeeded"
      exit 0
      ;;
    Failed | Stopped | Degraded)
      echo "$execution ended with status $status. Logs:" >&2
      echo "  az containerapp job logs show -g $RG -n $JOB --execution $execution --container $JOB" >&2
      exit 1
      ;;
  esac
  sleep 10
done

echo "$execution did not finish within ${TIMEOUT_SECONDS}s" >&2
exit 1
