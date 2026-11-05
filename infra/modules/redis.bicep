// Azure Managed Redis (Balanced B0) reachable only through a private endpoint.
// BullMQ needs a single (non-clustered) endpoint and `noeviction`, so jobs are never evicted.

param location string
param tags object
param redisName string
param privateEndpointName string
param subnetId string
param privateDnsZoneId string

resource cluster 'Microsoft.Cache/redisEnterprise@2025-07-01' = {
  name: redisName
  location: location
  tags: tags
  sku: { name: 'Balanced_B0' }
  properties: {
    minimumTlsVersion: '1.2'
    publicNetworkAccess: 'Disabled'
    // Pre-production: a single node halves the cost; queued jobs can be lost on a failover.
    highAvailability: 'Disabled'
  }
}

resource database 'Microsoft.Cache/redisEnterprise/databases@2025-07-01' = {
  parent: cluster
  name: 'default'
  properties: {
    clientProtocol: 'Encrypted'
    clusteringPolicy: 'NoCluster'
    evictionPolicy: 'NoEviction'
    accessKeysAuthentication: 'Enabled'
    port: 10000
  }
}

resource endpoint 'Microsoft.Network/privateEndpoints@2024-07-01' = {
  name: privateEndpointName
  location: location
  tags: tags
  properties: {
    subnet: { id: subnetId }
    privateLinkServiceConnections: [
      {
        name: 'redis'
        properties: {
          privateLinkServiceId: cluster.id
          groupIds: ['redisEnterprise']
        }
      }
    ]
  }
}

resource dnsGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2024-07-01' = {
  parent: endpoint
  name: 'default'
  properties: {
    privateDnsZoneConfigs: [
      { name: 'redis', properties: { privateDnsZoneId: privateDnsZoneId } }
    ]
  }
}

output redisName string = cluster.name
output hostName string = cluster.properties.hostName
output port int = database.properties.port
