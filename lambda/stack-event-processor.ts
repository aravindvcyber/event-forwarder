import { SQSEvent, SQSRecord } from "aws-lambda";
import {
  Block,
  KnownBlock,
  PlainTextElement,
  MrkdwnElement,
} from "@slack/types";
import {
  generateInnerSection,
  sendUsingSlackHook,
  stackEventMessageComposer,
} from "./slack-utils";
import {
  CloudFormationStackEventBridgeEvent,
  CloudFormationStackEventBridgeEvents,
} from "./cfn-events";
import { dbPut, queryDbItems, updateDbItem } from "./dynamodb-utils";
import { CloudformationEventDbModel, timeOrder, toDataModel } from "./model";
import { AttributeMap, QueryOutput, UpdateItemOutput } from "aws-sdk/clients/dynamodb";

const middy = require("@middy/core");

const {
  Tracer,
  captureLambdaHandler,
} = require("@aws-lambda-powertools/tracer");

const {
  Logger,
  injectLambdaContext,
} = require("@aws-lambda-powertools/logger");

export const logger = new Logger({
  logLevel: "INFO",
  serviceName: "EventForwarderHandler",
  persistentLogAttributes: {
    version: "1",
  },
});

const tracer = new Tracer({ serviceName: "EventForwarderHandler" });

const handle = async function (event: SQSEvent) {
  tracer.putAnnotation("successfulStart", true);

  tracer.putMetadata("count", event.Records.length);

  const collection: Array<PlainTextElement | MrkdwnElement> = [];

  let stackId: string = "";
  let region: string = "";
  let account: string = "";

  logger.info("content:", JSON.stringify(event, undefined, 2));

  await Promise.all(
    event.Records.map(async (rec: SQSRecord) => {
      const content: CloudFormationStackEventBridgeEvents = JSON.parse(
        rec.body
      );
      logger.info("content:", { content });
      const dbContent: CloudformationEventDbModel = await toDataModel(content);
      await dbPut(dbContent);

      const statusMatchList = dbContent.status.S.match(
        /^((CREATE|UPDATE|DELETE)_COMPLETE|UPDATE_ROLLBACK_COMP)$/
      );
      logger.info('statusMatchList', {statusMatchList, status: dbContent.status.S, type: dbContent.type.S})

      if (
         (dbContent.type.S ===
          CloudFormationStackEventBridgeEvent.Stack_Change &&
        statusMatchList &&
        statusMatchList.length > 0) || (dbContent.status.S === 'DELETE_IN_PROGRESS')
      ) {
        logger.info('Notifiable Event found in batch: ', {dbContent})
        stackId = dbContent.stackId.S;
        region = dbContent.region.S;
        account = dbContent.account.S;      
      }
    })
  );

  tracer.putAnnotation("successfullyBatchIterated", true);
  logger.info("EventsReceived: ", { count: [...event.Records].length });

  if (stackId.length > 0) {
    tracer.putAnnotation("retrievingItems", true);
    const output: QueryOutput = await queryDbItems(stackId);

    logger.info("Output", { output });

    const keyPairList: { PK: string; SK: string }[] = [];

    if (output && output.Items && output.Items.length > 0) {
      let Items: CloudformationEventDbModel[] = [];

      Items = output.Items.map((item: AttributeMap) => {
        return JSON.parse(JSON.stringify(item)) as CloudformationEventDbModel;
      });

      Items.sort(timeOrder);
      Items.map((item) => {
        logger.info("dbItem:", { item });

        keyPairList.push({ PK: item.stackId.S, SK: item.time.N });

        collection.push(generateInnerSection(item));
      });
    }

    tracer.putAnnotation("sendingSlackPost", true);

    const messageBlocks: Array<KnownBlock | Block> = stackEventMessageComposer(
      collection,
      region,
      stackId,
      account
    );

    await sendUsingSlackHook(messageBlocks);

    tracer.putAnnotation("updatingNotifiedField", true);

    logger.info("KeyPairList:", { keyPairList });

    await Promise.all(
      keyPairList.map(async ({ PK, SK }) => {
        const out: UpdateItemOutput = await updateDbItem(PK, SK);
        logger.info("UpdateItemOutput", { out });
      })
    );
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
};

exports.handler = middy(handle)
  .use(captureLambdaHandler(tracer))
  .use(injectLambdaContext(logger, { clearState: true }));
