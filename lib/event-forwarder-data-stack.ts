import {
  CfnOutput,
  RemovalPolicy,
  Stack,
  StackProps,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import {
  AttributeType,
  ProjectionType,
  Table,
  TableEncryption,
} from "aws-cdk-lib/aws-dynamodb";

//import { IConfig } from '../utils/config'

const config = require("config");

export const cfnEventStoreTableName: string = config.get("eventStore");

export class EventForwarderDataStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const cfnEventStore = new Table(this, cfnEventStoreTableName, {
      tableName: cfnEventStoreTableName,
      sortKey: { name: "time", type: AttributeType.NUMBER },
      partitionKey: { name: "stackId", type: AttributeType.STRING },
      encryption: TableEncryption.AWS_MANAGED,
      readCapacity: 5,
      writeCapacity: 5,
      contributorInsightsEnabled: true,
    });

    cfnEventStore.addLocalSecondaryIndex({
      indexName: "LSI_TYPE",
      sortKey: {
        name: "type",
        type: AttributeType.STRING,
      },
      nonKeyAttributes: ["time", "detail", "status", "notified"],
      projectionType: ProjectionType.INCLUDE,
    });

    cfnEventStore.addLocalSecondaryIndex({
      indexName: "LSI_STATUS",
      sortKey: {
        name: "status",
        type: AttributeType.STRING,
      },
      nonKeyAttributes: ["time", "detail", "type", "notified"],
      projectionType: ProjectionType.INCLUDE,
    });

    cfnEventStore.addLocalSecondaryIndex({
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

    cfnEventStore.addGlobalSecondaryIndex({
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

    cfnEventStore.applyRemovalPolicy(RemovalPolicy.RETAIN);

    new CfnOutput(this, "cfnEventStoreArn", {
      exportName: "cfnEventStoreArn",
      value: cfnEventStore.tableArn,
    });
    
  }
}
