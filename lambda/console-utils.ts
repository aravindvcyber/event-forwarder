export const generateResourceLink = (
  resourceType: string,
  region: string,
  physicalId: string
): string => {
  const encodedId: string = encodeURIComponent(physicalId);
  const stackName: string = physicalId.split('/')[1];

  const baseUrl = `https://${region}.console.aws.amazon.com/`;

  if (resourceType === "AWS::Events::Rule") {
    return baseUrl + `events/home?region=${region}#/rules/${encodedId}`;
  } else if (resourceType === "AWS::Lambda::Function") {
    return baseUrl + `lambda/home?region=${region}#functions/${encodedId}`;
  } else if (resourceType === "logGroup") {
    return (
      baseUrl +
      `cloudwatch/home?region=${region}#logsV2:log-groups/log-group/${encodedId}`
    );
  } else if (resourceType === "AWS::DynamoDB::Table") {
    return (
      baseUrl + `dynamodb/home?region=${region}#tables:selected=${encodedId}`
    );
  } else if (resourceType === "cfnDesignerLink") {
    return (
      baseUrl +
      `cloudformation/designer/home?region=${region}&stackId=${encodedId}`
    );
  } else if (resourceType === "stackLink") {
    return (
      baseUrl + `cloudformation/home?region=${region}&stackId=${encodedId}`
    );
  } else if (resourceType === "driftsLink") {
    return (
      baseUrl +
      `cloudformation/home?region=${region}#/stacks/drifts?stackId=${encodedId}`
    );
  } else if (resourceType === "AppManagerResourcesLink") {
    return (
      baseUrl +
      `systems-manager/appmanager/application/AppManager-CFN-${stackName}?region=${region}&tab=AppManagerApplicationResourcesTab`
    );
  } else if (resourceType === "AWS::Lambda::LayerVersion") {
    const layerVersionNumber = physicalId.split(":").reverse()[0]
    const layerVersionName = physicalId.split(":").reverse()[1]
    return (
      baseUrl +
      `lambda/home?region=${region}#/layers/${layerVersionName}/versions/${layerVersionNumber}?tab=versions`
    );
  } else {
    return physicalId;
  }
};


