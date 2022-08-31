import {
  aws_events_targets,
  aws_sns_subscriptions,
  CfnOutput,
  RemovalPolicy,
  Stack,
  StackProps,
} from "aws-cdk-lib";
import { CfnEventBusPolicy, Rule } from "aws-cdk-lib/aws-events";

import { DeadLetterQueue, Queue } from "aws-cdk-lib/aws-sqs";

import { Construct } from "constructs";

import { Function } from "aws-cdk-lib/aws-lambda";
//import { IConfig } from '../utils/config'
const config = require("config");
import dynamodb = require("aws-sdk/clients/dynamodb");
import { generateDLQ, getDefaultBus } from "./commons";
import { Topic } from "aws-cdk-lib/aws-sns";
import { Code, Runtime, Tracing } from "aws-cdk-lib/aws-lambda";
import { RetentionDays } from "aws-cdk-lib/aws-logs";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import { AccountPrincipal, Effect, PolicyStatement } from "aws-cdk-lib/aws-iam";

export interface RemoteEventRouterStackProps extends StackProps {
  account: string;
  region: string;
}

export class RemoteEventRouterStack extends Stack {
  constructor(
    scope: Construct,
    id: string,
    props: RemoteEventRouterStackProps
  ) {
    super(scope, id, props);

    const targetAccount = config.get("account");
    const targetRegion = config.get("region");

    const targetBus = getDefaultBus(this, targetRegion, targetAccount);
    const sourceBus = getDefaultBus(this, props.region, props.account);

    const stackEventsRoute = new Rule(this, "stack-events-route", {
      eventPattern: {
        detail: {
          "stack-id": [{ exists: true }],
        },
        source: ["aws.cloudformation"],
      },
      eventBus: sourceBus,
    });

    //todo need to single default dlq message, need to route using another process to common one
    const remoteStackEventTargetDlq: DeadLetterQueue = {
      queue: generateDLQ(this, "remoteStackEventTargetDlq"),
      maxReceiveCount: 100,
    };

    const stackEventTarget = new aws_events_targets.EventBus(targetBus, {
      deadLetterQueue: remoteStackEventTargetDlq.queue,
    });

    const remoteStackEventTargetDlqSns = new Topic(
      this,
      "remoteStackEventTargetDlqSns",
      {
        displayName: "remoteStackEventTargetDlqSns",
      }
    );

    new CfnOutput(this, "remoteStackEventTargetDlqSnsArn", {
      value: remoteStackEventTargetDlqSns.topicArn,
      exportName: "remoteStackEventTargetDlqSnsArn",
    });

    const failedMessageAggregator = new Function(
      this,
      "failedMessageAggregator",
      {
        runtime: Runtime.NODEJS_14_X,
        code: Code.fromAsset("dist/lambda/failed-message-aggregator"),
        handler: "failed-message-aggregator.handler",
        logRetention:
          parseInt(config.get("logRetentionDays")) || RetentionDays.ONE_DAY,
        tracing: Tracing.ACTIVE,
        environment: {
          TOPIC_ARN: remoteStackEventTargetDlqSns.topicArn,
        },
      }
    );

    failedMessageAggregator.applyRemovalPolicy(RemovalPolicy.DESTROY);

    failedMessageAggregator.addEventSource(
      new SqsEventSource(remoteStackEventTargetDlq.queue, {
        batchSize: 10,
      })
    );

    remoteStackEventTargetDlqSns.grantPublish(failedMessageAggregator);

    remoteStackEventTargetDlqSns.addToResourcePolicy(
      new PolicyStatement({
        sid: "Cross Account Access to subscribe",
        effect: Effect.ALLOW,
        principals: [new AccountPrincipal(targetAccount)],
        actions: ["SNS:Subscribe"],
        resources: [remoteStackEventTargetDlqSns.topicArn],
      })
    );

    const stackEventTargetDlq: DeadLetterQueue = {
      queue: Queue.fromQueueArn(
        this,
        "stackEventTargetDlq-",
        `arn:aws:sqs:${targetRegion}:${targetAccount}:stackEventTargetDlq`
      ),
      maxReceiveCount: 100,
    };

    remoteStackEventTargetDlqSns.addSubscription(
      new aws_sns_subscriptions.SqsSubscription(stackEventTargetDlq.queue)
    );

    stackEventsRoute.addTarget(stackEventTarget);
  }
}
