import { CloudFormationDriftDetectionStatusChangeDetail, CloudFormationResourceStatusChangeDetail, CloudFormationStackEventBridgeEvent, CloudFormationStackEventBridgeEvents, CloudFormationStackStatusChangeDetail } from "./cfn-events";

export interface CloudformationEventDbModel {
    eventId: { S: string; },
    time: {N: string},
    region: { S: string; },
    type: { S: string; },
    stackId: { S: string; },
    resources: { L: { S: string; }[]},
    detail: { S: string; },
    clientRequestToken: { S: string; },
    status: { S: string; },
    statusReason: { S: string; },
    resourceType : { S: string; },
    logicalResourceId : { S: string; },
    physicalResourceId : { S: string; },
    detectionStatus : { S: string; },
    driftDetectionDetails: { S: string; },
    notified: {S: string;}
}

export const toDataModel = (event: CloudFormationStackEventBridgeEvents): CloudformationEventDbModel => {
  const time: {N: string} = { N: `${new Date(event.time).getTime()}` };
  const resources: { S: string; }[] = event.resources.map((v)=>{
    return { S: v }
  });
  const type: { S: string; } = { S: event["detail-type"] };
  const status: { S: string; } = { S: ''};
  const notified: {S: string;} = { S: 'false'};
  const statusReason: { S: string; } = { S: ''};
  const detectionStatus: { S: string; } = { S: ''};
  const resourceType: { S: string; } = { S: ''};
  const logicalResourceId: { S: string; } = { S: ''};
  const physicalResourceId: { S: string; } = { S: ''};
  const clientRequestToken: { S: string; } = { S: event["detail"]["client-request-token"] || ''};
  const detail: { S: string; } = { S: JSON.stringify(event.detail) };
  const stackId: { S: string; } = {S: event["detail"]["stack-id"]};
  const driftDetectionDetails: { S: string; } = { S: '' };
  const eventId: { S: string; } = { S: event.id };
  const region: { S: string } = { S: event.region };
  if(type.S === CloudFormationStackEventBridgeEvent.Resource_Change){
    let det = event["detail"] as CloudFormationResourceStatusChangeDetail;
    status.S = det["status-details"].status;
    statusReason.S = det["status-details"]["status-reason"];
    resourceType.S = det["resource-type"];
    logicalResourceId.S = det["logical-resource-id"];
    physicalResourceId.S = det["physical-resource-id"];
  } else if(type.S === CloudFormationStackEventBridgeEvent.Stack_Change){
    let det = event["detail"] as CloudFormationStackStatusChangeDetail;
    status.S = det["status-details"].status;
    statusReason.S = det["status-details"]["status-reason"];
  } else if(type.S === CloudFormationStackEventBridgeEvent.Drift_Detection_Change){
    let det = event["detail"] as CloudFormationDriftDetectionStatusChangeDetail;
    status.S = det["status-details"]["stack-drift-status"];
    detectionStatus.S = det["status-details"]["detection-status"];
    if(status.S === ''){
      status.S = detectionStatus.S
    }
    driftDetectionDetails.S = JSON.stringify(det["drift-detection-details"]);
  }
    const result:CloudformationEventDbModel = {
            eventId,
            time,
            region,
            type,
            stackId,
            resources: { L: resources},
            detail,
            clientRequestToken,
            status,
            statusReason,
            resourceType,
            logicalResourceId,
            physicalResourceId,
            detectionStatus,
            driftDetectionDetails,
            notified
    }
    
    return result
}


export function timeOrder( a:CloudformationEventDbModel, b:CloudformationEventDbModel )
  {
  if ( a.time.N < b.time.N){
    return -1;
  }
  if ( a.time.N > b.time.N){
    return 1;
  }
  return 0;
}
