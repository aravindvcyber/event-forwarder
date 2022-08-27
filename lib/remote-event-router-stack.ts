import {
  aws_events_targets,
  Duration,
  RemovalPolicy,
  Stack,
  StackProps,
} from "aws-cdk-lib";
import { CfnEventBusPolicy, EventBus, Rule } from "aws-cdk-lib/aws-events";
import {
  Code,
  Runtime,
  Function,
  LayerVersion,
  Architecture,
  Tracing,
} from "aws-cdk-lib/aws-lambda";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import { RetentionDays } from "aws-cdk-lib/aws-logs";
import { DeadLetterQueue, Queue } from "aws-cdk-lib/aws-sqs";

import { Construct } from "constructs";
import { join } from "path";
import {
  AttributeType,
  ProjectionType,
  Table,
  TableEncryption,
} from "aws-cdk-lib/aws-dynamodb";
//import { IConfig } from '../utils/config'
const config = require('config')
import dynamodb = require("aws-sdk/clients/dynamodb");
import {  generateDLQ, getDefaultBus } from "./commons";
import { Role } from "aws-cdk-lib/aws-iam";


export interface RemoteEventRouterStackProps extends StackProps{
  account: string,
  region: string
}

export class RemoteEventRouterStack extends Stack {
  constructor(scope: Construct, id: string, props: RemoteEventRouterStackProps) {
    super(scope, id, props);

    const targetBus = getDefaultBus(this, config.get('region'), config.get('account') );
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

    new CfnEventBusPolicy(this, "CrossAccountPolicy", {
      action: "events:PutEvents",
      eventBusName: targetBus.eventBusName,
      principal: props.account,
      statementId: `AcceptFrom${props.account}`,
    });


    //todo need to use default region for dlq
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
