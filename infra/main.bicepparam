// Parameters of the pre-production environment. Secrets come from environment variables
// (infra/.env.qa, created by infra/scripts/bootstrap.sh and never committed).
using './main.bicep'

param imageTag = readEnvironmentVariable('IMAGE_TAG')
param demoMode = bool(readEnvironmentVariable('DEMO_MODE', 'false'))

param postgresAdminPassword = readEnvironmentVariable('POSTGRES_ADMIN_PASSWORD')
param betterAuthSecret = readEnvironmentVariable('BETTER_AUTH_SECRET')

param smtpEntraAppId = readEnvironmentVariable('SMTP_ENTRA_APP_ID')
param smtpServicePrincipalId = readEnvironmentVariable('SMTP_SP_OBJECT_ID')
param smtpClientSecret = readEnvironmentVariable('SMTP_CLIENT_SECRET')

param seedResidentPassword = readEnvironmentVariable('SEED_RESIDENT_PASSWORD')
param seedOperatorPassword = readEnvironmentVariable('SEED_OPERATOR_PASSWORD')
param seedAdminPassword = readEnvironmentVariable('SEED_ADMIN_PASSWORD')

param registryUsername = readEnvironmentVariable('REGISTRY_USERNAME', '')
param registryPassword = readEnvironmentVariable('REGISTRY_PASSWORD', '')

param budgetStartDate = '2026-11-01'
