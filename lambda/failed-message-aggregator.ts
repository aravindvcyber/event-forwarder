import { SQSEvent, SQSRecord } from "aws-lambda";
import { SNS } from "aws-sdk";
import { PublishInput, PublishResponse } from "aws-sdk/clients/sns";
import { LambdaInterface } from '@aws-lambda-powertools/commons';

const serviceName = "FailedMessagesAggregator";

const middy = require("@middy/core");

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

const {
  Tracer,
  captureLambdaHandler,
} = require("@aws-lambda-powertools/tracer");

const tracer = new Tracer({ serviceName });

tracer.provider.setLogger(logger);

const sns = tracer.captureAWSClient(new SNS());

class Lambda implements LambdaInterface {
  
  @tracer.captureMethod()
  private async processSQSRecord (rec: SQSRecord)  {
    logger.info("Fetching DLQ message:", {rec});
    const params: PublishInput = {
      Message: rec.body,
      Subject: "Forwarding event message to SNS topic",
      TopicArn: process.env.TOPIC_ARN,
    };
    const snsResult: PublishResponse = await sns.publish(params).promise();
    logger.info("Success", { params, snsResult });
  }

  public async handler(event: SQSEvent) {
    try {
      await Promise.all(
        event.Records.map(async (rec: SQSRecord) => {
          await this.processSQSRecord(rec);
        })
      );
      return {
        statusCode: 200,
        headers: { "Content-Type": "text/json" },
        body: {
          EventsReceived: [...event.Records].length,
        },
      };
    } catch (error) {
      logger.error("Error", { error });
      return {
        statusCode: 400,
        headers: { "Content-Type": "text/json" },
        body: {
          EventsReceived: [...event.Records].length,
          Error: error
        },
      };
    }
  };

}

const handlerClass = new Lambda();
const handle = handlerClass.handler.bind(handlerClass); 

exports.handler = middy(handle)
  .use(captureLambdaHandler(tracer))
  .use(injectLambdaContext(logger, { clearState: true }));
