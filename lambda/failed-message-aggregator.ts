import { SQSEvent, SQSRecord } from "aws-lambda";
import { SNS } from "aws-sdk";
import { PublishInput } from "aws-sdk/clients/sns";

const sns = new SNS();

exports.handler = async function (event: SQSEvent) {
  event.Records.map(async (rec: SQSRecord) => {
    const eventText = JSON.stringify(rec, null, 2);
    console.log("Fetching DLQ message:", eventText);

    const params: PublishInput = {
      Message: JSON.stringify(rec),
      Subject: "Forwarding Dlq messages to SNS topic",
      TopicArn: process.env.TOPIC_ARN,
    };
    await sns.publish(params);
  });
};
