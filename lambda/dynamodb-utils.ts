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
  QueryInput,
  QueryOutput,
  UpdateItemOutput,
  UpdateItemInput,
  BatchWriteItemInput,
  WriteRequest,
  BatchWriteItemRequestMap,
} from "aws-sdk/clients/dynamodb";

import { CloudformationEventDbModel } from "./model";
import { logger } from "./stack-event-processor";

const dynamo: DynamoDB = new AWS.DynamoDB();

const tableName: string = process.env.EVENT_STORE || "";

const dynamodbQueryPagingLimit: number = parseInt(
  process.env.DYNAMODB_QUERY_PAGING_LIMIT || "10"
);

export const dbPut: any = async (event: CloudformationEventDbModel) => {
  const item: PutItemInputAttributeMap = {
    ...event,
  };
  const putData: PutItemInput = {
    TableName: tableName,
    Item: item,
    ReturnConsumedCapacity: "TOTAL",
  };

  logger.info("putData", { item });

  await dynamo.putItem(putData).promise();
};

export const batchGetDbItems = async (
  keys: string[]
): Promise<BatchGetItemOutput> => {
  logger.info("Getting: ", { keys });

  const keyList: KeyList = keys.map((key: string) => {
    return {
      stackId: { S: key },
      time: {
        N: "1660908358000",
      },
    };
  });

  const requestKeyAttr: KeysAndAttributes = {
    ConsistentRead: true,
    Keys: keyList,
  };

  const getRequestMap: BatchGetRequestMap = {
    tableName: requestKeyAttr,
  };
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

export const queryAllDbItems = async (
  key: string
): Promise<DynamoDB.ItemList> => {
  logger.info("queryAllDbItems: ", { key });

  let lastEvaluatedKey: DynamoDB.Key | undefined = undefined;

  let result: DynamoDB.ItemList = [];

  do {
    const partOutput: QueryOutput = await queryDbItems(key, lastEvaluatedKey);
    lastEvaluatedKey = partOutput.LastEvaluatedKey;
    logger.info("partOutput: ", { partOutput });
    if (partOutput.Items) {
      result = result.concat(partOutput.Items);
    }
  } while (lastEvaluatedKey);
  return result;
};

export const batchDeleteDbItems = async (keys: DynamoDB.Key[]) => {
  logger.info("Deleting: ", { keys });

  const writeItems: WriteRequest[] = [];
  keys.map((key: DynamoDB.Key) => {
    const writeItem: WriteRequest = {
      DeleteRequest: {
        Key: key,
      },
    };
    writeItems.push(writeItem);
  });
  let writeRequestMap: BatchWriteItemRequestMap = {};
  writeRequestMap[tableName] = writeItems;
  const params: BatchWriteItemInput = {
    RequestItems: writeRequestMap,
    ReturnConsumedCapacity: "TOTAL",
    ReturnItemCollectionMetrics: "SIZE",
  };

  logger.info("deleteItem: ", { params });

  return await dynamo.batchWriteItem(params).promise();
};

export const queryDbItems = async (
  key: string,
  fromKey?: DynamoDB.Key
): Promise<QueryOutput> => {
  logger.info("queryDbItems: ", { key, fromKey });

  const params: QueryInput = {
    ReturnConsumedCapacity: "TOTAL",
    TableName: tableName,
    IndexName: "LSI_NOTIFIED",
    Limit: dynamodbQueryPagingLimit,

    ConsistentRead: true,

    KeyConditionExpression: "#si = :s and #ny = :n",

    ExpressionAttributeNames: {
      "#si": "stackId",
      "#ny": "notified",
    },

    ExpressionAttributeValues: {
      ":s": { S: key },
      ":n": { S: "false" },
    },
  };

  if (fromKey) {
    params.ExclusiveStartKey = fromKey;
  }

  logger.info("GetItem: ", { params });
  let result: QueryOutput = {};
  try {
    result = await dynamo.query(params).promise();
  } catch (error) {
    logger.error("Error: ", { error });
  }

  return result;
};

export const updateDbItem = async (
  key: DynamoDB.Key
): Promise<UpdateItemOutput> => {
  logger.info("Updating: ", { key });

  const params: UpdateItemInput = {
    ReturnConsumedCapacity: "TOTAL",
    TableName: tableName,
    Key: key,

    UpdateExpression: "SET #ny = :new , #nyt = :time",

    ConditionExpression: "#ny = :old",

    ExpressionAttributeNames: {
      "#ny": "notified",
      "#nyt": "notifiedTime",
    },

    ExpressionAttributeValues: {
      ":old": { S: "false" },
      ":new": { S: "true" },
      ":time": { N: `${new Date().getTime()}` },
    },
  };

  logger.info("updateItem: ", { params });
  let result: UpdateItemOutput = {};
  try {
    result = await dynamo.updateItem(params).promise();
  } catch (error) {
    logger.error("Error: ", { error });
  }

  return result;
};
