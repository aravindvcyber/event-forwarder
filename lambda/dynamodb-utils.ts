const AWSXRay = require("aws-xray-sdk-core");
const AWS = AWSXRay.captureAWS(require("aws-sdk"));

import { DynamoDB } from "aws-sdk";
import {
  BatchGetItemInput,
  BatchGetItemOutput,
  BatchGetRequestMap,
  PutItemInput,
  PutItemInputAttributeMap,
  KeyList,
  KeysAndAttributes,
} from "aws-sdk/clients/dynamodb";

import { CloudformationEventDbModel } from "./model";
import { logger } from "./stack-event-processor";

const dynamo: DynamoDB = new AWS.DynamoDB();

export const dbPut: any = async (event: CloudformationEventDbModel) => {
  const item: PutItemInputAttributeMap = {
    ...event,
  };
  const putData: PutItemInput = {
    TableName: process.env.EVENT_STORE || "",
    Item: item,
    ReturnConsumedCapacity: "TOTAL",
  };

  logger.info("putData", { item });

  await dynamo.putItem(putData).promise();
};

export const batchGetDbItems = async (keys: string[]): Promise<BatchGetItemOutput> => {
  logger.info("Getting: ", { keys });

  // const writeItems: ReadRequest[] = [];
  // keys.map((key: any) => {
  //   const writeItem: WriteRequest = {
  //     DeleteRequest: {
  //       Key: {
  //         ...key,
  //       },
  //     },
  //   };
  //   writeItems.push(writeItem);
  // });

  const keyList: KeyList = keys.map((key: string) => {
    return { "stackId": {S: key} };
  });

  const requestKeyAttr: KeysAndAttributes = {
    ConsistentRead: true,
    Keys: keyList,
    //ProjectionExpression: ""
    // ExpressionAttributeNames?: ExpressionAttributeNameMap;
  };

  const getRequestMap: BatchGetRequestMap = {
    "eventStore": requestKeyAttr,
  }
  const params: BatchGetItemInput = {
    RequestItems: getRequestMap,
    ReturnConsumedCapacity: "TOTAL",
  };

  logger.info("GetItem: ", { params });
  let result: BatchGetItemOutput = {};
  try {
    result = await dynamo.batchGetItem(params).promise();
  } catch (error) {
    logger.error("Error: ", { error });
  }

  return result;
};
