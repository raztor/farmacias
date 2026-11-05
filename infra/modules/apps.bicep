// The four container apps and the two jobs, wired the same way as docker-compose.prod.yml.

param location string
param tags object
param names object
param environmentId string
param defaultDomain string
param identityId string
param keyVaultUri string
param images object
param emailFrom string
param demoMode bool
param registryUsername string
param probes object

var webUrl = 'https://${names.web}.${defaultDomain}'
var adminUrl = 'https://${names.admin}.${defaultDomain}'
// Inside the environment, an app is reachable by name over plain HTTP (internal ingress).
var apiInternalUrl = 'http://${names.server}'
var warmReplicas = demoMode ? 1 : 0

func secretEnv(name string, secret string) object => { name: name, secretRef: secret }

var authEnv = [
  { name: 'NODE_ENV', value: 'production' }
  secretEnv('DATABASE_URL', 'database-url')
  secretEnv('BETTER_AUTH_SECRET', 'better-auth-secret')
  // The browser reaches the API through the web origin (Caddy proxies /api/auth and /trpc).
  { name: 'BETTER_AUTH_URL', value: webUrl }
  { name: 'TRUSTED_ORIGINS', value: '${webUrl},${adminUrl},bnp://' }
]

module server 'container-app.bicep' = {
  name: 'app-server'
  params: {
    location: location
    tags: tags
    environmentId: environmentId
    identityId: identityId
    keyVaultUri: keyVaultUri
    registryUsername: registryUsername
    name: names.server
    image: images.server
    cpu: '0.5'
    memory: '1Gi'
    targetPort: 4000
    external: false
    secretNames: ['database-url', 'redis-url', 'better-auth-secret']
    env: concat(authEnv, [
      { name: 'LOG_LEVEL', value: 'info' }
      { name: 'HOST', value: '0.0.0.0' }
      { name: 'PORT', value: '4000' }
      secretEnv('REDIS_URL', 'redis-url')
      { name: 'TRUST_PROXY_HOPS', value: '1' }
      // The Container Apps ingress (Envoy) connects from 100.64.0.0/10 and the apps from the VNet,
      // so the client IP is the right-most entry of X-Forwarded-For outside those (R-ACC-09).
      { name: 'TRUST_PROXY_ADDRESSES', value: 'loopback,uniquelocal,100.64.0.0/10' }
      { name: 'RATE_LIMIT_MAX', value: '300' }
    ])
    probes: probes.server
    minReplicas: warmReplicas
    // B1ms allows ~35 user connections: one server replica keeps the pools well below that.
    maxReplicas: 1
  }
}

module worker 'container-app.bicep' = {
  name: 'app-worker'
  params: {
    location: location
    tags: tags
    environmentId: environmentId
    identityId: identityId
    keyVaultUri: keyVaultUri
    registryUsername: registryUsername
    name: names.worker
    image: images.worker
    cpu: '0.25'
    memory: '0.5Gi'
    secretNames: ['database-url', 'redis-url', 'smtp-url']
    env: [
      { name: 'NODE_ENV', value: 'production' }
      { name: 'LOG_LEVEL', value: 'info' }
      secretEnv('DATABASE_URL', 'database-url')
      secretEnv('REDIS_URL', 'redis-url')
      secretEnv('SMTP_URL', 'smtp-url')
      { name: 'EMAIL_FROM', value: emailFrom }
      { name: 'WORKER_CONCURRENCY', value: '5' }
      { name: 'WORKER_HEALTH_PORT', value: '4100' }
    ]
    probes: probes.worker
    // Always one replica: it consumes the BullMQ queues (delayed jobs and retries included).
    minReplicas: 1
    maxReplicas: 1
  }
}

module admin 'container-app.bicep' = {
  name: 'app-admin'
  params: {
    location: location
    tags: tags
    environmentId: environmentId
    identityId: identityId
    keyVaultUri: keyVaultUri
    registryUsername: registryUsername
    name: names.admin
    image: images.admin
    cpu: '0.25'
    memory: '0.5Gi'
    targetPort: 3001
    external: true
    env: [
      { name: 'NODE_ENV', value: 'production' }
      // Must match the API_INTERNAL_URL build arg (Next.js bakes rewrites in at build time).
      { name: 'API_INTERNAL_URL', value: apiInternalUrl }
      { name: 'RESIDENT_APP_URL', value: webUrl }
    ]
    probes: probes.admin
    minReplicas: warmReplicas
    maxReplicas: 2
  }
  dependsOn: [server]
}

module web 'container-app.bicep' = {
  name: 'app-web'
  params: {
    location: location
    tags: tags
    environmentId: environmentId
    identityId: identityId
    keyVaultUri: keyVaultUri
    registryUsername: registryUsername
    name: names.web
    image: images.web
    cpu: '0.25'
    memory: '0.5Gi'
    targetPort: 8080
    external: true
    env: [{ name: 'API_UPSTREAM', value: apiInternalUrl }]
    probes: probes.web
    minReplicas: warmReplicas
    maxReplicas: 2
  }
  dependsOn: [server]
}

module migrate 'container-job.bicep' = {
  name: 'job-migrate'
  params: {
    location: location
    tags: tags
    environmentId: environmentId
    identityId: identityId
    keyVaultUri: keyVaultUri
    registryUsername: registryUsername
    name: names.migrate
    image: images.migrate
    secretNames: ['database-url']
    env: [secretEnv('DATABASE_URL', 'database-url')]
  }
}

// Optional synthetic demo data (RNF-06). Idempotent; run it by hand after the first migration.
module seed 'container-job.bicep' = {
  name: 'job-seed'
  params: {
    location: location
    tags: tags
    environmentId: environmentId
    identityId: identityId
    keyVaultUri: keyVaultUri
    registryUsername: registryUsername
    name: names.seed
    image: images.server
    command: ['node', 'dist/scripts/seed.js']
    secretNames: [
      'database-url'
      'better-auth-secret'
      'seed-resident-password'
      'seed-operator-password'
      'seed-admin-password'
    ]
    env: concat(authEnv, [
      secretEnv('SEED_RESIDENT_PASSWORD', 'seed-resident-password')
      secretEnv('SEED_OPERATOR_PASSWORD', 'seed-operator-password')
      secretEnv('SEED_ADMIN_PASSWORD', 'seed-admin-password')
    ])
  }
}

output webFqdn string = web.outputs.fqdn
output adminFqdn string = admin.outputs.fqdn
