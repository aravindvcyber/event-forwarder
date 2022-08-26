import { EventBridgeEvent } from 'aws-lambda/trigger/eventbridge'

import { StackDriftStatus, StackStatus } from 'aws-sdk/clients/cloudformation'

export declare type CloudFormationStackEventBridgeEvents = CloudFormationResourceStatusChangeEvent
| CloudFormationStackStatusChangeEvent
| CloudFormationDriftDetectionStatusChangeEvent

export enum CloudFormationStackEventBridgeEvent {
  Resource_Change = 'CloudFormation Resource Status Change',
  Stack_Change = 'CloudFormation Stack Status Change',
  Drift_Detection_Change = 'CloudFormation Drift Detection Status Change',
}

export declare type CloudFormationResourceStatusChangeEvent = EventBridgeEvent<
CloudFormationStackEventBridgeEvent.Resource_Change,
CloudFormationResourceStatusChangeDetail
>

export declare type CloudFormationStackStatusChangeEvent = EventBridgeEvent<
CloudFormationStackEventBridgeEvent.Stack_Change,
CloudFormationStackStatusChangeDetail
>

export declare type CloudFormationDriftDetectionStatusChangeEvent =
  EventBridgeEvent<
  CloudFormationStackEventBridgeEvent.Drift_Detection_Change,
  CloudFormationDriftDetectionStatusChangeDetail
  >

export declare type CloudFormationStatusChangeEventDetails = CloudFormationResourceStatusChangeDetail
| CloudFormationStackStatusChangeDetail
| CloudFormationDriftDetectionStatusChangeDetail

export class CloudFormationResourceStatusChangeDetail {
  'stack-id': string
  'logical-resource-id': string
  'physical-resource-id': string
  'status-details': {
    'status': StackStatus
    'status-reason': string
  }
  'resource-type': string
  'client-request-token': string
}


export class CloudFormationStackStatusChangeDetail {
  'stack-id': string
  'status-details': {
    'status': StackStatus
    'status-reason': string
  }
  'client-request-token': string
}
export class CloudFormationDriftDetectionStatusChangeDetail {
  'stack-id': string
  'stack-drift-detection-id': string
  'status-details': {
    'stack-drift-status': StackDriftStatus
    'detection-status': string
  }
  'drift-detection-details': {
    'drifted-stack-resource-count': number
  }
  'client-request-token': string
}
