import {
  aws_events_targets,
  aws_sns_subscriptions,
  CfnOutput,
  Duration,
  Fn,
  RemovalPolicy,
  Stack,
  StackProps,
} from "aws-cdk-lib";
import { CfnEventBusPolicy, Rule } from "aws-cdk-lib/aws-events";
import { Code, Function } from "aws-cdk-lib/aws-lambda";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import { DeadLetterQueue } from "aws-cdk-lib/aws-sqs";
import { AccountPrincipal, Effect, PolicyStatement } from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";
import { Table } from "aws-cdk-lib/aws-dynamodb";

//import { IConfig } from '../utils/config'

const config = require("config");

import {
  getDefaultBus,
  generateDLQ,
  generateQueue,
  generateLayerVersion,
  exportOutput,
  commonLambdaProps,
} from "./commons";
import { Topic } from "aws-cdk-lib/aws-sns";
import { SqsSubscriptionProps } from "aws-cdk-lib/aws-sns-subscriptions";
import { cfnEventStoreTableName } from "./event-forwarder-data-stack";

export class EventForwarderStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const eventBus = getDefaultBus(
      this,
      config.get("region"),
      config.get("account")
    );

    const stackEventsRule = new Rule(this, "stack-events-rule", {
      eventPattern: {
        detail: {
          "stack-id": [{ exists: true }],
        },
        source: ["aws.cloudformation"],
      },
      eventBus,
    });

    const stackEventProcessorQueueDLQ: DeadLetterQueue = {
      queue: generateDLQ(this, "stackEventProcessorQueueDLQ"),
      maxReceiveCount: 100,
    };

    // const stackEventProcessorQueue = generateQueueFifo(
    //   this,
    //   "stackEventProcessorQueue.fifo",
    //   stackEventProcessorQueueDLQ
    // );

    const stackEventProcessorQueue = generateQueue(
      this,
      "stackEventProcessorQueue",
      stackEventProcessorQueueDLQ
    );

    exportOutput(
      this,
      "stackEventProcessorQueueArn",
      stackEventProcessorQueue.queueArn
    );

    const stackEventTargetDlq: DeadLetterQueue = {
      queue: generateDLQ(this, "stackEventTargetDlq"),
      maxReceiveCount: 100,
    };

    exportOutput(
      this,
      "stackEventTargetDlqArn",
      stackEventTargetDlq.queue.queueArn
    );

    const stackEventTarget = new aws_events_targets.SqsQueue(
      stackEventProcessorQueue,
      {
        retryAttempts: 3,
        deadLetterQueue: stackEventTargetDlq.queue,
      }
    );

    stackEventsRule.addTarget(stackEventTarget);

    const remoteAccounts = config.get("remoteAccounts").split(",");
    const remoteRegions = config.get("remoteRegions").split(",");

    remoteAccounts.map((account: string) => {
      remoteRegions.map((region: string) => {
        // stackEventTargetDlq.queue.grantSendMessages(
        //   new AccountPrincipal(`${account}`)
        // );

        // stackEventTargetDlq.queue.addToResourcePolicy(
        //   new PolicyStatement({
        //     sid: `Cross Account Access to send message-${region}-${account}`,
        //     effect: Effect.ALLOW,
        //     principals: [new AccountPrincipal(account)],
        //     actions: [
        //       "sqs:SendMessage",
        //       "sqs:GetQueueAttributes",
        //       "sqs:GetQueueUrl",
        //     ],
        //     resources: [stackEventTargetDlq.queue.queueArn],
        //     // condition: {

        //     // }
        //   })
        // );

        const remoteStackEventTargetDlqSns = Topic.fromTopicArn(
          this,
          `remoteStackEventTargetDlqSns-${region}-${account}`,
          `arn:aws:sns:${region}:${account}:remoteStackEventTargetDlqSns`
        );

        const subProps: SqsSubscriptionProps = {
          rawMessageDelivery: true,
        };

        remoteStackEventTargetDlqSns.addSubscription(
          new aws_sns_subscriptions.SqsSubscription(
            stackEventTargetDlq.queue,
            subProps
          )
        );

        //eventBus.grantPutEventsTo(new AccountPrincipal(`${account}`));

        new CfnEventBusPolicy(this, `CrossAccountPolicy-${region}-${account}`, {
          action: "events:PutEvents",
          eventBusName: eventBus.eventBusName,
          principal: account,
          statementId: `Accept-PutEvents-From-${region}-${account}`,
          // condition: {

          // }
        });
      });
    });

    const eventStore = Table.fromTableArn(
      this,
      "eventStore",
      Fn.importValue("cfnEventStoreArn")
    );

    const eventStoreIndexes = Table.fromTableArn(
      this,
      "eventStoreIndexes",
      Fn.importValue("cfnEventStoreArn") + "/index/*"
    );

    const powertoolsSDK = generateLayerVersion(this, "powertoolsSDK", {});

    new CfnOutput(this, "powertoolsSDKArn", {
      exportName: "powertoolsSDKArn",
      value: powertoolsSDK.layerVersionArn,
    });

    const slackSDK = generateLayerVersion(this, "slackSDK", {});
    new CfnOutput(this, "slackSDKArn", {
      exportName: "slackSDKArn",
      value: powertoolsSDK.layerVersionArn,
    });

    const xraySDK = generateLayerVersion(this, "xraySDK", {});
    new CfnOutput(this, "xraySDKArn", {
      exportName: "xraySDKArn",
      value: powertoolsSDK.layerVersionArn,
    });

    const stackEventProcessor = new Function(this, "stackEventProcessor", {
      code: Code.fromAsset("dist/lambda/stack-event-processor"),
      handler: "stack-event-processor.handler",
      layers: [xraySDK, powertoolsSDK, slackSDK],
      ...commonLambdaProps,
      functionName: "stackEventProcessor",
      environment: {
        SLACK_HOOK: config.get("slackhook"),
        ERROR_SLACK_HOOK: config.get("errorslackhook"),
        EVENT_STORE: cfnEventStoreTableName,
        LOG_LEVEL: config.get("logLevel"),
        PER_POST_Event_Count: config.get("perPostEventCount"),
        DYNAMODB_QUERY_PAGING_LIMIT: config.get("dynamodbQueryPagingLimit"),
        DELETE_NOTIFIED: config.get("deleteNotified"),
        TZ: config.get("timeZone"),
        LOCALE: config.get("locale"),
      },
    });

    eventStore.grantReadWriteData(stackEventProcessor);

    eventStoreIndexes.grantReadData(stackEventProcessor);

    stackEventProcessor.applyRemovalPolicy(RemovalPolicy.DESTROY);

    stackEventProcessor.addEventSource(
      new SqsEventSource(stackEventProcessorQueue, {
        batchSize: 10,
      })
    );

    exportOutput(
      this,
      "stackEventProcessorArn",
      stackEventProcessor.latestVersion.functionArn
    );

    const failedMessageLogger = new Function(this, "failedMessageLogger", {
      code: Code.fromAsset("dist/lambda/log-dlq-message"),
      handler: "log-dlq-message.handler",
      ...commonLambdaProps,
      timeout: Duration.seconds(25),
      functionName: "failedMessageLogger",
      layers: [powertoolsSDK],
      environment: {
        //TOPIC_ARN: remoteStackEventTargetDlqSns.topicArn,
        TZ: config.get("timeZone"),
        LOCALE: config.get("locale"),
      },
    });

    failedMessageLogger.applyRemovalPolicy(RemovalPolicy.DESTROY);

    failedMessageLogger.addEventSource(
      new SqsEventSource(stackEventTargetDlq.queue, {
        batchSize: 10,
        maxBatchingWindow: Duration.seconds(20),
      })
    );

    exportOutput(
      this,
      "failedMessageLoggerArn",
      failedMessageLogger.latestVersion.functionArn
    );
  }
}
