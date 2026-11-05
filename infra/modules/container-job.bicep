// Manually triggered Container Apps job (migrations, seed). It runs once and exits.

param location string
param tags object
param name string
param environmentId string
param identityId string
param keyVaultUri string
param image string
param command array = []
param env array = []
param secretNames array = []
param cpu string = '0.5'
param memory string = '1Gi'

@description('Seconds before a run is stopped.')
param timeoutSeconds int = 600

param registryUsername string = ''

var usesRegistry = !empty(registryUsername)
var allSecretNames = usesRegistry ? union(secretNames, ['registry-password']) : secretNames

resource job 'Microsoft.App/jobs@2025-07-01' = {
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
      triggerType: 'Manual'
      replicaTimeout: timeoutSeconds
      // A failed migration must stop the release, not be retried blindly.
      replicaRetryLimit: 0
      manualTriggerConfig: { parallelism: 1, replicaCompletionCount: 1 }
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
        union(
          {
            name: name
            image: image
            resources: { cpu: json(cpu), memory: memory }
            env: env
          },
          empty(command) ? {} : { command: command }
        )
      ]
    }
  }
}

output name string = job.name
