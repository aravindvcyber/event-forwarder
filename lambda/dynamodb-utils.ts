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
    return { "stackId": {S: key}, "time": {
      N: "1660908358000"
     } };
  });

  // const exprAttrNameMap: ExpressionAttributeNameMap = [{

  // }]

  const requestKeyAttr: KeysAndAttributes = {
    ConsistentRead: true,
    Keys: keyList,
    //ProjectionExpression: ""
    //ExpressionAttributeNames: exprAttrNameMap
  };

  const tableName: string = process.env.EVENT_STORE || '';

  const getRequestMap: BatchGetRequestMap = {
    tableName: requestKeyAttr,
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

export const queryDbItems = async (key: string): Promise<QueryOutput> => {
  logger.info("Getting: ", { key });

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

  // const keyList: KeyList = keys.map((key: string) => {
  //   return { "stackId": {S: key}, "time": {
  //     N: "1660908358000"
  //    } };
  // });

  const tableName: string = process.env.EVENT_STORE || '';

  //const currTime: number = new Date().getTime();

  //const timeFrom: number = new Date(currTime - 1000*60*60).getTime()

  
  const params: QueryInput = {
    ReturnConsumedCapacity: "TOTAL",
    TableName: tableName,
    IndexName: 'LSI_NOTIFIED',  
    Limit: 10,
    
    ConsistentRead: true,
   
    //ScanIndexForward?: BooleanObject;
  
    // ExclusiveStartKey?: Key;
  
    //ProjectionExpression?: ProjectionExpression;
  
    //FilterExpression?: ConditionExpression;
   
    //KeyConditionExpression: "#si = :s and #ti < :t and #ny = :n",
    KeyConditionExpression: "#si = :s and #ny = :n",
   
    ExpressionAttributeNames: {
      '#si': "stackId",
      //'#ti' : "time",
      '#ny' : "notified",
    },
    
    ExpressionAttributeValues: {
      ':s': {S: key},
      //':t' : {N: `${timeFrom}`},
      ':n': {S: "false"},
    },
  };

  logger.info("GetItem: ", { params });
  let result: QueryOutput = {};
  try {
    result = await dynamo.query(params).promise();
  } catch (error) {
    logger.error("Error: ", { error });
  }

  return result;
};


export const updateDbItem = async (PK: string, SK: string ): Promise<UpdateItemOutput> => {
  logger.info("Updating: ", { PK, SK });

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

  // const keyList: KeyList = keys.map((key: string) => {
  //   return { "stackId": {S: key}, "time": {
  //     N: "1660908358000"
  //    } };
  // });

  const tableName: string = process.env.EVENT_STORE || '';

  //const currTime: number = new Date().getTime();

  //const timeFrom: number = new Date(currTime - 1000*60*60).getTime()

  
  const params: UpdateItemInput = {
    ReturnConsumedCapacity: "TOTAL",
    TableName: tableName,
    Key: {
      "stackId": {S: PK},
      "time": {N: `${SK}`}
    },

    UpdateExpression: "SET #ny = :new",
    
    ConditionExpression: "#ny = :old",
   
    ExpressionAttributeNames: {
      //'#si': "stackId",
      //'#ti' : "time",
      '#ny' : "notified",
    },
    
    ExpressionAttributeValues: {
      //':s': {S: PK},
      //':t' : {N: `${timeFrom}`},
      ':old': {S: "false"},
      ':new': {S: "true"},
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
