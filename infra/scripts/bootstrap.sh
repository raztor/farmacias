#!/usr/bin/env bash
# One-time setup of the QA (pre-production) environment. Safe to re-run: it reuses what exists.
#
# - infra/.env.qa: generated secrets (chmod 600, ignored by git). Back it up somewhere safe.
# - Entra app "farmacia-qa-smtp": SMTP sign-in for Azure Communication Services Email.
# - Entra app "farmacia-qa-github-deploy": used by GitHub Actions through OIDC, only from the
#   GitHub environment "qa" (which only accepts the QA branch), with Contributor on the RG.
# - GitHub environment "qa" and its variables.
# - Registers the Microsoft.Cache resource provider (Azure Managed Redis).
#
# Needs: az (signed in to the target subscription), gh (with admin on the repo), openssl.
set -euo pipefail

RG="${RG:-rg-farmacia-bm}"
REPO="${REPO:-raztor/farmacias}"
GH_ENV="qa"
GH_BRANCH="QA"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ENV_FILE="$ROOT/infra/.env.qa"

log() { printf '\n==> %s\n' "$*"; }

# Appends KEY='value' to the env file unless KEY is already there.
put() {
  grep -q "^$1=" "$ENV_FILE" || printf "%s='%s'\n" "$1" "$2" >>"$ENV_FILE"
}

# Prints the appId of an Entra application (and makes sure it has a service principal).
ensure_app() {
  local name="$1" app_id
  app_id="$(az ad app list --display-name "$name" --query '[0].appId' -o tsv)"
  if [[ -z "$app_id" ]]; then
    app_id="$(az ad app create --display-name "$name" --sign-in-audience AzureADMyOrg --query appId -o tsv)"
  fi
  az ad sp show --id "$app_id" >/dev/null 2>&1 || az ad sp create --id "$app_id" >/dev/null
  printf '%s' "$app_id"
}

SUBSCRIPTION_ID="$(az account show --query id -o tsv)"
TENANT_ID="$(az account show --query tenantId -o tsv)"
RG_ID="$(az group show --name "$RG" --query id -o tsv)"
echo "Subscription: $(az account show --query name -o tsv) ($SUBSCRIPTION_ID)"
echo "Resource group: $RG"

log "Generated secrets ($ENV_FILE)"
touch "$ENV_FILE"
chmod 600 "$ENV_FILE"
# PostgreSQL requires 3 of: upper case, lower case, digits, symbols.
put POSTGRES_ADMIN_PASSWORD "Pg9-$(openssl rand -hex 20)"
put BETTER_AUTH_SECRET "$(openssl rand -hex 32)"
put SEED_RESIDENT_PASSWORD "Demo-$(openssl rand -hex 8)"
put SEED_OPERATOR_PASSWORD "Demo-$(openssl rand -hex 8)"
put SEED_ADMIN_PASSWORD "Demo-$(openssl rand -hex 8)"

log "Entra app for SMTP"
SMTP_APP_ID="$(ensure_app farmacia-qa-smtp)"
put SMTP_ENTRA_APP_ID "$SMTP_APP_ID"
put SMTP_SP_OBJECT_ID "$(az ad sp show --id "$SMTP_APP_ID" --query id -o tsv)"
if ! grep -q '^SMTP_CLIENT_SECRET=' "$ENV_FILE"; then
  put SMTP_CLIENT_SECRET "$(az ad app credential reset --id "$SMTP_APP_ID" \
    --display-name smtp-qa --years 1 --append --query password -o tsv)"
fi

log "Entra app for GitHub Actions (OIDC)"
DEPLOY_APP_ID="$(ensure_app farmacia-qa-github-deploy)"
DEPLOY_SP_ID="$(az ad sp show --id "$DEPLOY_APP_ID" --query id -o tsv)"
SUBJECT="repo:${REPO}:environment:${GH_ENV}"
if [[ -z "$(az ad app federated-credential list --id "$DEPLOY_APP_ID" --query "[?subject=='$SUBJECT'].name" -o tsv)" ]]; then
  az ad app federated-credential create --id "$DEPLOY_APP_ID" --parameters "{
    \"name\": \"github-${GH_ENV}\",
    \"issuer\": \"https://token.actions.githubusercontent.com\",
    \"subject\": \"${SUBJECT}\",
    \"audiences\": [\"api://AzureADTokenExchange\"]
  }" >/dev/null
fi
if [[ -z "$(az role assignment list --assignee "$DEPLOY_SP_ID" --scope "$RG_ID" --role Contributor --query '[0].id' -o tsv)" ]]; then
  az role assignment create --assignee-object-id "$DEPLOY_SP_ID" \
    --assignee-principal-type ServicePrincipal --role Contributor --scope "$RG_ID" >/dev/null
fi

log "GitHub environment '$GH_ENV' (branch $GH_BRANCH only)"
gh api --method PUT "repos/$REPO/environments/$GH_ENV" --input - >/dev/null <<JSON
{"deployment_branch_policy": {"protected_branches": false, "custom_branch_policies": true}}
JSON
if ! gh api "repos/$REPO/environments/$GH_ENV/deployment-branch-policies" \
  --jq '.branch_policies[].name' | grep -qx "$GH_BRANCH"; then
  gh api --method POST "repos/$REPO/environments/$GH_ENV/deployment-branch-policies" \
    -f name="$GH_BRANCH" -f type=branch >/dev/null
fi
gh variable set AZURE_CLIENT_ID --env "$GH_ENV" --repo "$REPO" --body "$DEPLOY_APP_ID"
gh variable set AZURE_TENANT_ID --env "$GH_ENV" --repo "$REPO" --body "$TENANT_ID"
gh variable set AZURE_SUBSCRIPTION_ID --env "$GH_ENV" --repo "$REPO" --body "$SUBSCRIPTION_ID"
gh variable set AZURE_RESOURCE_GROUP --env "$GH_ENV" --repo "$REPO" --body "$RG"

log "Resource provider Microsoft.Cache"
az provider register --namespace Microsoft.Cache --wait

log "Done. Next: push to $GH_BRANCH to build the images, then infra/scripts/deploy.sh (see infra/README.md)."
