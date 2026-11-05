// Pre-production environment on Azure (deployed from the QA branch). See infra/README.md.
targetScope = 'resourceGroup'

@description('Region of the network, PostgreSQL, Redis and Container Apps. East US 2 rejects Burstable PostgreSQL for this subscription (SkuNotAvailable), so the workload runs in Central US.')
param location string = 'centralus'

@description('Region of the identity, Key Vault and Log Analytics (created first in East US 2; they work across regions).')
param supportLocation string = 'eastus2'

@description('Short environment name, used in tags.')
param environmentName string = 'qa'

@description('Image tag to run (the commit SHA pushed by .github/workflows/deploy-qa.yml).')
param imageTag string

param imageRegistry string = 'ghcr.io/raztor'
param imagePrefix string = 'farmacias'

@description('Keeps one replica of server, admin and web warm (no cold starts) for live demos.')
param demoMode bool = false

param postgresAdminLogin string = 'farmacia_admin'

@secure()
param postgresAdminPassword string

@secure()
param betterAuthSecret string

@description('Entra application (client) id linked to the SMTP username.')
param smtpEntraAppId string

@description('Object id of the service principal of that Entra application.')
param smtpServicePrincipalId string

@secure()
param smtpClientSecret string

@secure()
param seedResidentPassword string

@secure()
param seedOperatorPassword string

@secure()
param seedAdminPassword string

@description('GHCR credentials, only when the packages are private.')
param registryUsername string = ''

@secure()
param registryPassword string = ''

param budgetAmount int = 80

@description('First day of the month the budget starts (yyyy-MM-01). Never change it afterwards.')
param budgetStartDate string

var tags = {
  project: 'farmacias'
  environment: environmentName
  managedBy: 'bicep'
}

var names = {
  vnet: 'vnet-farmacia-bm'
  logs: 'log-farmacia-bm'
  identity: 'id-farmacia-bm'
  keyVault: 'kv-farmacia-bm'
  postgres: 'psql-farmacia-bm'
  redis: 'redis-farmacia-bm'
  redisEndpoint: 'pe-redis-farmacia-bm'
  emailService: 'ecs-farmacia-bm'
  communication: 'acs-farmacia-bm'
  environment: 'cae-farmacia-bm'
  web: 'ca-farm-web'
  admin: 'ca-farm-admin'
  server: 'ca-farm-server'
  worker: 'ca-farm-worker'
  migrate: 'caj-farm-migrate'
  seed: 'caj-farm-seed'
  budget: 'budget-farmacia-bm'
}

func imageRef(registry string, prefix string, image string, tag string) string =>
  '${registry}/${prefix}-${image}:${tag}'

func httpProbe(probeType string, path string, port int) object => {
  type: probeType
  httpGet: { path: path, port: port }
  initialDelaySeconds: probeType == 'Startup' ? 3 : 0
  periodSeconds: probeType == 'Startup' ? 3 : 15
  failureThreshold: probeType == 'Startup' ? 20 : 3
  timeoutSeconds: 5
}

module network 'modules/network.bicep' = {
  name: 'network'
  params: {
    location: location
    tags: tags
    vnetName: names.vnet
    postgresServerName: names.postgres
  }
}

module monitoring 'modules/monitoring.bicep' = {
  name: 'monitoring'
  params: { location: supportLocation, tags: tags, workspaceName: names.logs }
}

module security 'modules/security.bicep' = {
  name: 'security'
  params: {
    location: supportLocation
    tags: tags
    identityName: names.identity
    keyVaultName: names.keyVault
  }
}

module postgres 'modules/postgres.bicep' = {
  name: 'postgres'
  params: {
    location: location
    tags: tags
    serverName: names.postgres
    subnetId: network.outputs.postgresSubnetId
    privateDnsZoneId: network.outputs.postgresDnsZoneId
    administratorLogin: postgresAdminLogin
    administratorPassword: postgresAdminPassword
  }
}

module redis 'modules/redis.bicep' = {
  name: 'redis'
  params: {
    location: location
    tags: tags
    redisName: names.redis
    privateEndpointName: names.redisEndpoint
    subnetId: network.outputs.privateEndpointSubnetId
    privateDnsZoneId: network.outputs.redisDnsZoneId
  }
}

module email 'modules/email.bicep' = {
  name: 'email'
  params: {
    tags: tags
    emailServiceName: names.emailService
    communicationServiceName: names.communication
    smtpUsername: 'farmacia-${environmentName}'
    smtpEntraAppId: smtpEntraAppId
    smtpServicePrincipalId: smtpServicePrincipalId
  }
}

module secrets 'modules/secrets.bicep' = {
  name: 'secrets'
  params: {
    keyVaultName: security.outputs.keyVaultName
    postgresFqdn: postgres.outputs.fqdn
    postgresDatabase: postgres.outputs.databaseName
    postgresAdminLogin: postgresAdminLogin
    postgresAdminPassword: postgresAdminPassword
    redisName: redis.outputs.redisName
    redisHostName: redis.outputs.hostName
    redisPort: redis.outputs.port
    betterAuthSecret: betterAuthSecret
    smtpUsername: email.outputs.smtpUsername
    smtpClientSecret: smtpClientSecret
    seedResidentPassword: seedResidentPassword
    seedOperatorPassword: seedOperatorPassword
    seedAdminPassword: seedAdminPassword
    registryPassword: registryPassword
  }
}

module containerEnv 'modules/container-env.bicep' = {
  name: 'container-env'
  params: {
    location: location
    tags: tags
    environmentName: names.environment
    subnetId: network.outputs.acaSubnetId
    logAnalyticsWorkspaceName: monitoring.outputs.workspaceName
  }
}

module apps 'modules/apps.bicep' = {
  name: 'apps'
  params: {
    location: location
    tags: tags
    names: names
    environmentId: containerEnv.outputs.environmentId
    defaultDomain: containerEnv.outputs.defaultDomain
    identityId: security.outputs.identityId
    keyVaultUri: security.outputs.keyVaultUri
    images: {
      server: imageRef(imageRegistry, imagePrefix, 'server', imageTag)
      worker: imageRef(imageRegistry, imagePrefix, 'worker', imageTag)
      admin: imageRef(imageRegistry, imagePrefix, 'admin', imageTag)
      web: imageRef(imageRegistry, imagePrefix, 'mobile-web', imageTag)
      migrate: imageRef(imageRegistry, imagePrefix, 'migrate', imageTag)
    }
    emailFrom: 'Farmacia Comunitaria Peñalolén <${email.outputs.senderAddress}>'
    demoMode: demoMode
    registryUsername: registryUsername
    probes: {
      server: [
        httpProbe('Startup', '/health', 4000)
        httpProbe('Liveness', '/health', 4000)
        httpProbe('Readiness', '/ready', 4000)
      ]
      worker: [httpProbe('Startup', '/health', 4100), httpProbe('Liveness', '/health', 4100)]
      admin: [httpProbe('Startup', '/sign-in', 3001), httpProbe('Liveness', '/sign-in', 3001)]
      web: [httpProbe('Startup', '/health', 8080), httpProbe('Liveness', '/health', 8080)]
    }
  }
  // Every Key Vault reference must exist before an app or job starts.
  dependsOn: [secrets]
}

module budget 'modules/budget.bicep' = {
  name: 'budget'
  params: {
    budgetName: names.budget
    amount: budgetAmount
    startDate: budgetStartDate
  }
}

output webUrl string = 'https://${apps.outputs.webFqdn}'
output adminUrl string = 'https://${apps.outputs.adminFqdn}'
output keyVaultName string = security.outputs.keyVaultName
output migrateJobName string = names.migrate
output seedJobName string = names.seed
