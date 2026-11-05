// Azure Communication Services Email with an Azure-managed domain and an SMTP username
// linked to an Entra application (created by infra/scripts/bootstrap.sh).

param tags object
param emailServiceName string
param communicationServiceName string
param smtpUsername string
param smtpEntraAppId string
param smtpServicePrincipalId string

// Built-in role: Communication and Email Service Owner (required to send through SMTP).
var emailOwnerRoleId = '09976791-48a7-449e-bb21-39d1a415f350'

resource emailService 'Microsoft.Communication/emailServices@2025-09-01' = {
  name: emailServiceName
  location: 'global'
  tags: tags
  properties: {
    dataLocation: 'United States'
  }
}

resource domain 'Microsoft.Communication/emailServices/domains@2025-09-01' = {
  parent: emailService
  name: 'AzureManagedDomain'
  location: 'global'
  tags: tags
  properties: {
    domainManagement: 'AzureManaged'
    userEngagementTracking: 'Disabled'
  }
}

resource communication 'Microsoft.Communication/communicationServices@2025-09-01' = {
  name: communicationServiceName
  location: 'global'
  tags: tags
  properties: {
    dataLocation: 'United States'
    linkedDomains: [domain.id]
  }
}

resource smtpRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(communication.id, smtpServicePrincipalId, emailOwnerRoleId)
  scope: communication
  properties: {
    principalId: smtpServicePrincipalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions',
      emailOwnerRoleId
    )
  }
}

resource smtpUser 'Microsoft.Communication/communicationServices/smtpUsernames@2025-09-01' = {
  parent: communication
  // Azure rejects a username equal to the resource name.
  name: 'smtp-${smtpUsername}'
  properties: {
    username: smtpUsername
    entraApplicationId: smtpEntraAppId
    tenantId: tenant().tenantId
  }
  dependsOn: [smtpRole]
}

output smtpUsername string = smtpUser.properties.username
// Azure-managed domains include the `DoNotReply` sender.
output senderAddress string = 'DoNotReply@${domain.properties.mailFromSenderDomain}'
