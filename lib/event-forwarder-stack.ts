import {
  aws_events_targets,
  aws_sns_subscriptions,
  CfnOutput,
  RemovalPolicy,
  Stack,
  StackProps,
} from "aws-cdk-lib";
import { CfnEventBusPolicy, Rule } from "aws-cdk-lib/aws-events";
import {
  Code,
  Runtime,
  Function,
  Tracing,
} from "aws-cdk-lib/aws-lambda";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import { RetentionDays } from "aws-cdk-lib/aws-logs";
import { DeadLetterQueue } from "aws-cdk-lib/aws-sqs";
import { AccountPrincipal, Effect, PolicyStatement } from "aws-cdk-lib/aws-iam";

import { Construct } from "constructs";

import {
  AttributeType,
  ProjectionType,
  Table,
  TableEncryption,
} from "aws-cdk-lib/aws-dynamodb";
//import { IConfig } from '../utils/config'
const config = require("config");

import {
  getDefaultBus,
  generateDLQ,
  generateQueue,
  generateLayerVersion,
  // generateQueueFifo,
  // generateDLQFifo,
} from "./commons";
import { Topic } from "aws-cdk-lib/aws-sns";
import { SqsSubscriptionProps } from "aws-cdk-lib/aws-sns-subscriptions";


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

    const stackEventTargetDlq: DeadLetterQueue = {
      queue: generateDLQ(this, "stackEventTargetDlq"),
      maxReceiveCount: 100,
    };

    const stackEventTarget = new aws_events_targets.SqsQueue(
      stackEventProcessorQueue,
      {
        retryAttempts: 3,
        deadLetterQueue: stackEventTargetDlq.queue,
      }
    );

    const remoteAccounts = config.get("remoteAccounts").split(",");
    const remoteRegions = config.get("remoteRegions").split(",");

    remoteAccounts.map((account: string) => {
      remoteRegions.map((region: string) => {
      // stackEventTargetDlq.queue.grantSendMessages(
      //   new AccountPrincipal(`${account}`)
      // );

      stackEventTargetDlq.queue.addToResourcePolicy(
        new PolicyStatement({
          sid: `Cross Account Access to send message-${account}-${region}`,
          effect: Effect.ALLOW,
          principals: [new AccountPrincipal(account)],
          actions: ["sqs:SendMessage"],
          resources: [stackEventTargetDlq.queue.queueArn],
        })
      );

      const remoteStackEventTargetDlqSns = Topic.fromTopicArn(this,
         `remoteStackEventTargetDlqSns-${account}-${region}`,
         `arn:aws:sns:${region}:${account}:remoteStackEventTargetDlqSns`)

      const subProps: SqsSubscriptionProps = {
        rawMessageDelivery: true
      }

      remoteStackEventTargetDlqSns.addSubscription(
        new aws_sns_subscriptions.SqsSubscription(stackEventTargetDlq.queue, subProps)
      );

      //eventBus.grantPutEventsTo(new AccountPrincipal(`${account}`));

      new CfnEventBusPolicy(this, `CrossAccountPolicy-${account}-${region}`, {
        action: "events:PutEvents",
        eventBusName: eventBus.eventBusName,
        principal: account,
        statementId: `Accept-PutEvents-From-${account}-${region}`,
        // condition: {
        
        // }
      });
    });

      //const remoteStackEventTargetDlqSns = Topic.fromTopicArn(this, 'remoteStackEventTargetDlqSns',`arn:aws:sns:us-east-2:575066707855:RemoteEventRouterStack-remoteStackEventTargetDlqSns9B6A4035-3WtskWdvk2LI`);
    });

    stackEventsRule.addTarget(stackEventTarget);

    const eventStoreTableName: string = config.get("eventStore");

    const eventStore = new Table(this, eventStoreTableName, {
      tableName: eventStoreTableName,
      sortKey: { name: "time", type: AttributeType.NUMBER },
      partitionKey: { name: "stackId", type: AttributeType.STRING },
      encryption: TableEncryption.AWS_MANAGED,
      readCapacity: 5,
      writeCapacity: 5,
      //stream: StreamViewType.KEYS_ONLY,
      contributorInsightsEnabled: true,
    });

    eventStore.addLocalSecondaryIndex({
      indexName: "LSI_TYPE",
      sortKey: {
        name: "type",
        type: AttributeType.STRING,
      },
      nonKeyAttributes: ["time", "detail", "status", "notified"],
      projectionType: ProjectionType.INCLUDE,
    });

    eventStore.addLocalSecondaryIndex({
      indexName: "LSI_STATUS",
      sortKey: {
        name: "status",
        type: AttributeType.STRING,
      },
      nonKeyAttributes: ["time", "detail", "type", "notified"],
      projectionType: ProjectionType.INCLUDE,
    });

    eventStore.addLocalSecondaryIndex({
      indexName: "LSI_NOTIFIED",
      sortKey: {
        name: "notified",
        type: AttributeType.STRING,
      },
      nonKeyAttributes: [
        "time",
        "detail",
        "type",
        "status",
        "statusReason",
        "resourceType",
        "logicalResourceId",
        "physicalResourceId",
        "detectionStatus",
        "driftDetectionDetails",
      ],
      projectionType: ProjectionType.INCLUDE,
    });

    eventStore.addGlobalSecondaryIndex({
      indexName: "GSI_EVENT_ID",
      partitionKey: {
        name: "eventId",
        type: AttributeType.STRING,
      },
      nonKeyAttributes: ["stackId", "time", "type", "detail", "status"],
      projectionType: ProjectionType.INCLUDE,
      readCapacity: 5,
      // sortKey: {
      //   name: 'time',
      //   type: AttributeType.Number,
      // },
      writeCapacity: 5,
    });

    eventStore.applyRemovalPolicy(RemovalPolicy.RETAIN);

    const powertoolsSDK = generateLayerVersion(this, "powertoolsSDK", {})

    new CfnOutput(this, 'powertoolsSDKArn', {
      exportName: 'powertoolsSDKArn',
      value: powertoolsSDK.layerVersionArn
    });

    const slackSDK = generateLayerVersion(this, "slackSDK", {});
    new CfnOutput(this, 'slackSDKArn', {
      exportName: 'slackSDKArn',
      value: powertoolsSDK.layerVersionArn
    });

    const xraySDK = generateLayerVersion(this, "xraySDK", {});
    new CfnOutput(this, 'xraySDKArn', {
      exportName: 'xraySDKArn',
      value: powertoolsSDK.layerVersionArn
    });

    const stackEventProcessor = new Function(this, "stackEventProcessor", {
      runtime: Runtime.NODEJS_14_X,
      code: Code.fromAsset("dist/lambda/stack-event-processor"),
      handler: "stack-event-processor.handler",
      logRetention:
        parseInt(config.get("logRetentionDays")) || RetentionDays.ONE_DAY,
      layers: [xraySDK,powertoolsSDK,slackSDK],
      tracing: Tracing.ACTIVE,
      environment: {
        SLACK_HOOK: config.get("slackhook"),
        ERROR_SLACK_HOOK: config.get("errorslackhook"),
        EVENT_STORE: eventStoreTableName,
        LOG_LEVEL: config.get("logLevel"),
        PER_POST_Event_Count: config.get("perPostEventCount"),
        DYNAMODB_QUERY_PAGING_LIMIT: config.get("dynamodbQueryPagingLimit"),
        DELETE_NOTIFIED: config.get("deleteNotified"),
        TZ: config.get('timeZone'),
        LOCALE: config.get('locale')
      },
    });

    eventStore.grantReadWriteData(stackEventProcessor);

    stackEventProcessor.applyRemovalPolicy(RemovalPolicy.DESTROY);

    stackEventProcessor.addEventSource(
      new SqsEventSource(stackEventProcessorQueue, {
        batchSize: 10,
      })
    );
  }
}
