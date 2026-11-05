// One container app. Secrets are Key Vault references resolved with the user-assigned identity.

param location string
param tags object
param name string
param environmentId string
param identityId string
param keyVaultUri string
param image string

@description('vCPU as a string (e.g. "0.25"). Consumption pairs it with memory: 0.25/0.5Gi, 0.5/1Gi...')
param cpu string
param memory string

@description('Container port that receives traffic. 0 means no ingress (background worker).')
param targetPort int = 0

@description('Public ingress when true; otherwise reachable only inside the environment.')
param external bool = false

param env array = []

@description('Key Vault secret names the app needs; referenced from env with `secretRef`.')
param secretNames array = []

param probes array = []
param minReplicas int = 0
param maxReplicas int = 1

@description('GHCR username. Leave empty when the packages are public.')
param registryUsername string = ''

var usesRegistry = !empty(registryUsername)
var allSecretNames = usesRegistry ? union(secretNames, ['registry-password']) : secretNames

resource app 'Microsoft.App/containerApps@2025-07-01' = {
  name: name
  location: location
  tags: tags
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: { '${identityId}': {} }
  }
  properties: {
    environmentId: environmentId
    workloadProfileName: 'Consumption'
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: targetPort == 0
        ? null
        : {
            external: external
            targetPort: targetPort
            transport: 'http'
            // Internal callers use plain HTTP (http://<app>); public apps are HTTPS only.
            allowInsecure: !external
          }
      secrets: [
        for secret in allSecretNames: {
          name: secret
          keyVaultUrl: '${keyVaultUri}secrets/${secret}'
          identity: identityId
        }
      ]
      registries: usesRegistry
        ? [{ server: 'ghcr.io', username: registryUsername, passwordSecretRef: 'registry-password' }]
        : []
    }
    template: {
      containers: [
        {
          name: name
          image: image
          resources: { cpu: json(cpu), memory: memory }
          env: env
          probes: probes
        }
      ]
      scale: {
        minReplicas: minReplicas
        maxReplicas: maxReplicas
        rules: targetPort == 0
          ? []
          : [{ name: 'http', http: { metadata: { concurrentRequests: '50' } } }]
      }
    }
  }
}

output fqdn string = targetPort == 0 ? '' : app.properties.configuration.ingress.fqdn
