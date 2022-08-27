export const generateResourceLink = (
  resourceType: string,
  region: string,
  physicalId: string
): string => {
  const encodedId: string = encodeURIComponent(physicalId);
  const baseUrl = `https://${region}.console.aws.amazon.com/`;

  if (resourceType === "AWS::Events::Rule") {
    return baseUrl + `events/home?region=${region}#/rules/${encodedId}`;
  } else if (resourceType === "AWS::Lambda::Function") {
    return baseUrl + `lambda/home?region=${region}#functions/${encodedId}`;
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
  } else {
    return physicalId;
  }
};
