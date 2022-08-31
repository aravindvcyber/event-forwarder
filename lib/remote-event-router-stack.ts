import {
  aws_events_targets,
  Fn,
  Stack,
  StackProps,
} from "aws-cdk-lib";
import { CfnEventBusPolicy, Rule } from "aws-cdk-lib/aws-events";

import { DeadLetterQueue, Queue } from "aws-cdk-lib/aws-sqs";

import { Construct } from "constructs";


//import { IConfig } from '../utils/config'
const config = require('config')
import dynamodb = require("aws-sdk/clients/dynamodb");
import {  generateDLQ, getDefaultBus } from "./commons";



export interface RemoteEventRouterStackProps extends StackProps{
  account: string,
  region: string
}

export class RemoteEventRouterStack extends Stack {
  constructor(scope: Construct, id: string, props: RemoteEventRouterStackProps) {
    super(scope, id, props);

    const targetAccount = config.get('account');
    const targetRegion = config.get('region');

    const targetBus = getDefaultBus(this, targetRegion, targetAccount );
    const sourceBus = getDefaultBus(this, props.region, props.account );

    const stackEventsRoute = new Rule(this, "stack-events-route", {
      eventPattern: {
        detail: {
          "stack-id": [
            { "exists": true }
          ],
        },
        source: ["aws.cloudformation"],
      },
      eventBus: sourceBus
    });

    //todo need to single default dlq message, need to route using another process to common one
    const stackEventTargetDLQ: DeadLetterQueue = {
      queue: generateDLQ(this,"stackEventTargetDLQ"),
      maxReceiveCount: 100,
    };

    const stackEventTarget = new aws_events_targets.EventBus(targetBus, {
      deadLetterQueue: stackEventTargetDLQ.queue,
    })

    stackEventsRoute.addTarget(stackEventTarget);
  }
}
