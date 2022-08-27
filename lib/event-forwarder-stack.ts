import {
  aws_events_targets,
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
const config = require("config");
import dynamodb = require("aws-sdk/clients/dynamodb");
import { getDefaultBus, generateDLQ, generateQueue } from "./commons";

export class EventForwarderStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const eventBus = getDefaultBus(this, config.get('region'), config.get('account') );

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

    const stackEventProcessorQueue = generateQueue(
      this,
      "stackEventProcessorQueue",
      stackEventProcessorQueueDLQ
    );

    const stackEventTargetDLQ: DeadLetterQueue = {
      queue: generateDLQ(this, "stackEventTargetDLQ"),
      maxReceiveCount: 100,
    };

    const stackEventTarget = new aws_events_targets.SqsQueue(
      stackEventProcessorQueue,
      {
        retryAttempts: 3,
        deadLetterQueue: stackEventTargetDLQ.queue,
      }
    );

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

    const external = new LayerVersion(this, "event-external", {
      removalPolicy: RemovalPolicy.DESTROY,
      code: Code.fromAsset(join(__dirname, "..", "layers", "external")),
      // code: Code.fromAsset(join(__dirname, "..", "dist", "layers", "utils")),
      compatibleArchitectures: [Architecture.X86_64],
      compatibleRuntimes: [Runtime.NODEJS_14_X],
    });

    external.applyRemovalPolicy(RemovalPolicy.DESTROY);

    const stackEventProcessor = new Function(this, "stackEventProcessor", {
      runtime: Runtime.NODEJS_14_X,
      code: Code.fromAsset("dist/lambda/stack-event-processor"),
      handler: "stack-event-processor.handler",
      logRetention: RetentionDays.ONE_MONTH,
      layers: [external],
      tracing: Tracing.ACTIVE,
      environment: {
        SLACK_HOOK: config.get("slackhook"),
        EVENT_STORE: eventStoreTableName,
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
