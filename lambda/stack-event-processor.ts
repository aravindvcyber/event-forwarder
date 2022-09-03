import { SQSEvent, SQSRecord } from "aws-lambda";
import {
  Block,
  KnownBlock,
  PlainTextElement,
  MrkdwnElement,
} from "@slack/types";
import {
  errorMessageComposer,
  generateInnerSection,
  genErrBlock,
  sendUsingErrorSlackHook,
  sendUsingSlackHook,
  stackEventMessageComposer,
} from "./slack-utils";
import {
  CloudFormationStackEventBridgeEvent,
  CloudFormationStackEventBridgeEvents,
} from "./cfn-events";
import {
  batchDeleteDbItems,
  dbPut,
  queryAllDbItems,
  updateDbItem,
} from "./dynamodb-utils";
import { CloudformationEventDbModel, genCustomTableKey, timeOrder, toDataModel } from "./model";
import { AttributeMap, ItemList, UpdateItemOutput } from "aws-sdk/clients/dynamodb";

const middy = require("@middy/core");

export const serviceName = "EventForwarderHandler";

const {
  Tracer,
  captureLambdaHandler,
} = require("@aws-lambda-powertools/tracer");

const {
  Logger,
  injectLambdaContext,
} = require("@aws-lambda-powertools/logger");

export const logger = new Logger({
  logLevel: process.env.LOG_LEVEL || "INFO",
  serviceName,
  persistentLogAttributes: {
    version: "1",
  },
});

const deleteNotified = process.env.DELETE_NOTIFIED || "false";

export const tracer = new Tracer({ serviceName });

tracer.provider.setLogger(logger);

const handle = async function (event: SQSEvent) {
  tracer.putAnnotation("successfulStart", true);

  tracer.putMetadata("count", event.Records.length);

  const collection: Array<PlainTextElement | MrkdwnElement> = [];

  let stackId: string = "";
  let region: string = "";
  let account: string = "";
  let status: string = "";
  let type: string = "";

  logger.info("eventPayload:", { event });

  try {
    await Promise.all(
      event.Records.map(async (rec: SQSRecord) => {
        const content: CloudFormationStackEventBridgeEvents = JSON.parse(
          rec.body
        );
        logger.info("content:", { content });
        const dbContent: CloudformationEventDbModel = await toDataModel(
          content
        );
        await dbPut(dbContent);

        const statusMatchList = dbContent.status.S.match(
          /^((CREATE|UPDATE|DELETE)_COMPLETE|UPDATE_ROLLBACK_COMP)$/
        );

        const driftMatchList = dbContent.status.S.match(/^(DRIFTED|IN_SYNC)$/);

        logger.info("statusMatchList", {
          statusMatchList,
        });

        if (
          (dbContent.type.S ===
            CloudFormationStackEventBridgeEvent.Stack_Change &&
            statusMatchList &&
            statusMatchList.length > 0) ||
          (dbContent.type.S ===
            CloudFormationStackEventBridgeEvent.Drift_Detection_Change &&
            driftMatchList &&
            driftMatchList.length > 0)
        ) {
          logger.info("Notifiable Event found in batch: ", { dbContent });
          stackId = dbContent.stackId.S;
          region = dbContent.region.S;
          account = dbContent.account.S;
          status = dbContent.status.S;
          type = dbContent.type.S;
        }
      })
    );

    tracer.putAnnotation("successfullyBatchIterated", true);
    logger.info("EventsReceived: ", { count: [...event.Records].length });

    if (stackId.length > 0) {
      tracer.putAnnotation("retrievingItems", true);
      let output: ItemList = await queryAllDbItems(stackId);
      logger.info("Output", { output });

      const keyPairList: { PK: string; SK: string }[] = [];

      if (output && output.length > 0) {
        let Items: CloudformationEventDbModel[] = [];

        Items = output.map((item: AttributeMap) => {
          return JSON.parse(JSON.stringify(item)) as CloudformationEventDbModel;
        });

        Items.sort(timeOrder);
        Items.map((item) => {
          logger.info("dbItem:", { item });

          keyPairList.push({ PK: item.stackId.S, SK: item.time.N });

          collection.push(generateInnerSection(item, region));
        });
      }

      let chunks =[];

      if (collection.length > 0) {
        const chunkSize = parseInt(process.env.PER_POST_Event_Count || "10");
        for (let i = 0; i < collection.length; i += chunkSize) {
          const chunk = collection.slice(i, i + chunkSize);
          const messageBlocks: Array<KnownBlock | Block> =
            stackEventMessageComposer(
              chunk,
              region,
              stackId,
              account,
              Math.round((i + chunkSize) / chunkSize),
              Math.round(collection.length / chunkSize + 1),
              status
            );
            tracer.putAnnotation("sendingSlackPost", true);
            logger.info("sendingToSlack");
            chunks.push(messageBlocks);
          Promise.all(chunks.map(async(chunk)=> await sendUsingSlackHook(chunk)));
          logger.info("sentToSlack");
          chunks=[];
        }

        const keys = keyPairList.map((key)=>{
          return genCustomTableKey(key);
        });
  
        if (deleteNotified === "true") {
          tracer.putAnnotation("deletingNotifiedField", true);
  
          logger.info("keys:", { keys });
  
          const out: any = await batchDeleteDbItems(keys);
  
          logger.info("DeleteItemOutput", { out });
        } else {
          tracer.putAnnotation("updatingNotifiedField", true);
  
          logger.info("keys:", { keys });
  
          await Promise.all(
            keys.map(async (key) => {
              const out: UpdateItemOutput = await updateDbItem(key);
              logger.info("UpdateItemOutput", { out });
            })
          );
        }
      }
      
    } else {
      logger.info("No Stack Completed", { event });
    }

    tracer.putAnnotation("successfulEnd", true);

    return {
      statusCode: 200,
      headers: { "Content-Type": "text/json" },
      body: {
        EventsReceived: [...event.Records].length,
      },
    };
  } catch (error) {
    const mrkdwnError: MrkdwnElement = genErrBlock(error);

    const messageBlocks: Array<KnownBlock | Block> = errorMessageComposer([
      mrkdwnError,
    ]);
    await sendUsingErrorSlackHook(messageBlocks);
    return {
      statusCode: 200,
      headers: { "Content-Type": "text/json" },
      body: {
        EventsReceived: [...event.Records].length,
        Error: error,
      },
    };
  }
};

exports.handler = middy(handle)
  .use(captureLambdaHandler(tracer))
  .use(injectLambdaContext(logger, { clearState: true }));
