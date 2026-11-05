// Log Analytics workspace for Container Apps logs, with a daily cap to keep costs bounded.

param location string
param tags object
param workspaceName string

@description('Daily ingestion cap in GB. Ingestion stops for the day once it is reached.')
param dailyQuotaGb string = '0.2'

resource workspace 'Microsoft.OperationalInsights/workspaces@2025-02-01' = {
  name: workspaceName
  location: location
  tags: tags
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
    workspaceCapping: { dailyQuotaGb: json(dailyQuotaGb) }
  }
}

output workspaceName string = workspace.name
output customerId string = workspace.properties.customerId
