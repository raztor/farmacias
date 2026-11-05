// Virtual network for the pre-production environment: Container Apps, PostgreSQL (delegated
// subnet) and the Redis private endpoint, plus the private DNS zones that resolve them.

param location string
param tags object
param vnetName string
param postgresServerName string

var addressSpace = '10.40.0.0/16'
var redisDnsZoneName = 'privatelink.redis.azure.net'
// Flexible Server with private access needs a zone ending in `.postgres.database.azure.com`.
var postgresDnsZoneName = '${postgresServerName}.private.postgres.database.azure.com'

resource vnet 'Microsoft.Network/virtualNetworks@2024-07-01' = {
  name: vnetName
  location: location
  tags: tags
  properties: {
    addressSpace: { addressPrefixes: [addressSpace] }
    subnets: [
      {
        // Workload profiles environments need a /27 or larger subnet delegated to Container Apps.
        name: 'snet-aca'
        properties: {
          addressPrefix: '10.40.0.0/27'
          delegations: [
            { name: 'aca', properties: { serviceName: 'Microsoft.App/environments' } }
          ]
        }
      }
      {
        name: 'snet-psql'
        properties: {
          addressPrefix: '10.40.1.0/28'
          delegations: [
            {
              name: 'psql'
              properties: { serviceName: 'Microsoft.DBforPostgreSQL/flexibleServers' }
            }
          ]
        }
      }
      {
        name: 'snet-pe'
        properties: {
          addressPrefix: '10.40.2.0/28'
        }
      }
    ]
  }
}

resource postgresDnsZone 'Microsoft.Network/privateDnsZones@2024-06-01' = {
  name: postgresDnsZoneName
  location: 'global'
  tags: tags
}

resource postgresDnsLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2024-06-01' = {
  parent: postgresDnsZone
  name: '${vnetName}-link'
  location: 'global'
  tags: tags
  properties: {
    registrationEnabled: false
    virtualNetwork: { id: vnet.id }
  }
}

resource redisDnsZone 'Microsoft.Network/privateDnsZones@2024-06-01' = {
  name: redisDnsZoneName
  location: 'global'
  tags: tags
}

resource redisDnsLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2024-06-01' = {
  parent: redisDnsZone
  name: '${vnetName}-link'
  location: 'global'
  tags: tags
  properties: {
    registrationEnabled: false
    virtualNetwork: { id: vnet.id }
  }
}

output acaSubnetId string = vnet.properties.subnets[0].id
output postgresSubnetId string = vnet.properties.subnets[1].id
output privateEndpointSubnetId string = vnet.properties.subnets[2].id
// Module outputs resolve only after every resource here (DNS links included) is deployed.
output postgresDnsZoneId string = postgresDnsZone.id
output redisDnsZoneId string = redisDnsZone.id
