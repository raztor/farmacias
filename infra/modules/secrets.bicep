// Writes the runtime secrets into Key Vault. Container Apps read them by reference through the
// user-assigned identity, so no secret value ends up in an app definition or in the workflow.

param keyVaultName string
param postgresFqdn string
param postgresDatabase string
param postgresAdminLogin string

@secure()
param postgresAdminPassword string

param redisName string
param redisHostName string
param redisPort int

@secure()
param betterAuthSecret string

param smtpUsername string

@secure()
param smtpClientSecret string

@secure()
param seedResidentPassword string

@secure()
param seedOperatorPassword string

@secure()
param seedAdminPassword string

@secure()
param registryPassword string

resource vault 'Microsoft.KeyVault/vaults@2024-11-01' existing = {
  name: keyVaultName
}

resource redisDatabase 'Microsoft.Cache/redisEnterprise/databases@2025-07-01' existing = {
  name: '${redisName}/default'
}

// Azure enforces TLS on both stores. `sslmode=require` is also understood by the Prisma CLI.
var databaseUrl = 'postgresql://${postgresAdminLogin}:${uriComponent(postgresAdminPassword)}@${postgresFqdn}:5432/${postgresDatabase}?sslmode=require'
var redisUrl = 'rediss://:${uriComponent(redisDatabase.listKeys().primaryKey)}@${redisHostName}:${redisPort}'
// Port 587 with STARTTLS (smtp.azurecomm.net does not offer implicit TLS).
var smtpUrl = 'smtp://${uriComponent(smtpUsername)}:${uriComponent(smtpClientSecret)}@smtp.azurecomm.net:587'

// The loop runs over the fixed names; the values (some only known at deploy time) are looked up.
var secretNames = [
  'database-url'
  'redis-url'
  'better-auth-secret'
  'smtp-url'
  'seed-resident-password'
  'seed-operator-password'
  'seed-admin-password'
]

var secretValues = {
  'database-url': databaseUrl
  'redis-url': redisUrl
  'better-auth-secret': betterAuthSecret
  'smtp-url': smtpUrl
  'seed-resident-password': seedResidentPassword
  'seed-operator-password': seedOperatorPassword
  'seed-admin-password': seedAdminPassword
}

resource secrets 'Microsoft.KeyVault/vaults/secrets@2024-11-01' = [
  for name in secretNames: {
    parent: vault
    name: name
    properties: { value: secretValues[name] }
  }
]

// Only needed when the GHCR packages are private.
resource registrySecret 'Microsoft.KeyVault/vaults/secrets@2024-11-01' = if (!empty(registryPassword)) {
  parent: vault
  name: 'registry-password'
  properties: { value: registryPassword }
}

output secretNames array = [for (name, i) in secretNames: secrets[i].name]
