import {
  aws_events_targets,
  CfnOutput,
  Duration,
  RemovalPolicy,
  Stack,
  StackProps,
} from "aws-cdk-lib";
import { Rule } from "aws-cdk-lib/aws-events";

import { DeadLetterQueue } from "aws-cdk-lib/aws-sqs";

import { Construct } from "constructs";

import { Function } from "aws-cdk-lib/aws-lambda";
//import { IConfig } from '../utils/config'
const config = require("config");

import {
  commonLambdaProps,
  exportOutput,
  generateDLQ,
  generateLayerVersion,
  getDefaultBus,
} from "./commons";
import { Topic } from "aws-cdk-lib/aws-sns";
import { Code } from "aws-cdk-lib/aws-lambda";
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
    const remoteBus = getDefaultBus(this, props.region, props.account);

    const remoteStackEventsRule = new Rule(this, "remote-stack-events-rule", {
      eventPattern: {
        detail: {
          "stack-id": [{ exists: true }],
        },
        source: ["aws.cloudformation"],
      },
      eventBus: remoteBus,
    });

    const remoteStackEventTargetDlq: DeadLetterQueue = {
      queue: generateDLQ(this, "remoteStackEventTargetDlq"),
      maxReceiveCount: 100,
    };

    const remoteStackEventTarget = new aws_events_targets.EventBus(targetBus, {
      deadLetterQueue: remoteStackEventTargetDlq.queue,
    });

    remoteStackEventsRule.addTarget(remoteStackEventTarget);

    const remoteStackEventTargetDlqSns = new Topic(
      this,
      "remoteStackEventTargetDlqSns",
      {
        displayName: "remoteStackEventTargetDlqSns",
        topicName: "remoteStackEventTargetDlqSns",
      }
    );

    remoteStackEventTargetDlqSns.applyRemovalPolicy(RemovalPolicy.DESTROY);

    exportOutput(
      this,
      "remoteStackEventTargetDlqSnsArn",
      remoteStackEventTargetDlqSns.topicArn
    );

    const powertoolsSDK = generateLayerVersion(this, "powertoolsSDK", {});

    exportOutput(this, "powertoolsSDKArn", powertoolsSDK.layerVersionArn);

    const failedMessageAggregator = new Function(
      this,
      "failedMessageAggregator",
      {
        code: Code.fromAsset("dist/lambda/failed-message-aggregator"),
        handler: "failed-message-aggregator.handler",
        ...commonLambdaProps,
        functionName: "failedMessageAggregator",
        layers: [powertoolsSDK],
        environment: {
          TOPIC_ARN: remoteStackEventTargetDlqSns.topicArn,
          TZ: config.get("timeZone"),
          LOCALE: config.get("locale"),
        },
      }
    );

    failedMessageAggregator.applyRemovalPolicy(RemovalPolicy.DESTROY);

    failedMessageAggregator.addEventSource(
      new SqsEventSource(remoteStackEventTargetDlq.queue, {
        batchSize: 10,
        maxBatchingWindow: Duration.seconds(20),
      })
    );

    exportOutput(
      this,
      "failedMessageAggregatorArn",
      failedMessageAggregator.latestVersion.functionArn
    );

    remoteStackEventTargetDlqSns.grantPublish(failedMessageAggregator);

    remoteStackEventTargetDlqSns.addToResourcePolicy(
      new PolicyStatement({
        sid: "Cross Account Access to subscribe",
        effect: Effect.ALLOW,
        principals: [new AccountPrincipal(targetAccount)],
        actions: ["sns:Subscribe"],
        resources: [remoteStackEventTargetDlqSns.topicArn],
      })
    );

    // const stackEventTargetDlq: DeadLetterQueue = {
    //   queue: Queue.fromQueueArn(
    //     this,
    //     `stackEventTargetDlq-${targetRegion}:${targetAccount}`,
    //     `arn:aws:sqs:${targetRegion}:${targetAccount}:stackEventTargetDlq`
    //   ),
    //   maxReceiveCount: 100,
    // };

    // remoteStackEventTargetDlqSns.addSubscription(
    //   new aws_sns_subscriptions.SqsSubscription(stackEventTargetDlq.queue)
    // );
  }
}
