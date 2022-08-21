import { SQSEvent, SQSRecord } from 'aws-lambda'
import {
  Block,
  KnownBlock,
  PlainTextElement,
  MrkdwnElement
} from '@slack/types'
import {
  generateInnerSection,
  sendUsingSlackHook,
  stackEventMessageComposer
} from './slack-utils'
import { CloudFormationStackEventBridgeEvents } from './cfn-events'
import { batchGetDbItems, dbPut } from './dynamodb-utils'
import { toDataModel } from './model'
const middy = require('@middy/core')

const {
  Tracer,
  captureLambdaHandler
} = require('@aws-lambda-powertools/tracer')

const {
  Logger,
  injectLambdaContext
} = require('@aws-lambda-powertools/logger')

export const logger = new Logger({
  logLevel: 'INFO',
  serviceName: 'EventForwarderHandler',
  persistentLogAttributes: {
    version: '1'
  }
})

const tracer = new Tracer({ serviceName: 'EventForwarderHandler' })

const handle = async function (event: SQSEvent) {
  tracer.putAnnotation('successfulStart', true)

  tracer.putMetadata('count', event.Records.length)

  const collection: Array<PlainTextElement | MrkdwnElement> = []
  let region: string = ''
  let stackId: string = ''

  logger.info('content:', JSON.stringify(event, undefined, 2))

  await Promise.all(
    event.Records.map(async (msg: SQSRecord) => {
      const content: CloudFormationStackEventBridgeEvents = JSON.parse(
        msg.body
      )
      logger.info("content:", {content});
      const dbContent = await toDataModel(content);
      await dbPut(dbContent);
      collection.push(
        generateInnerSection(
          content.time,
          content['detail-type'],
          content.detail
        )
      )
      region = content.region
      if (content.detail) {
        stackId = content.detail['stack-id']
      }
    })
  )

  tracer.putAnnotation('successfullyBatchIterated', true)
  logger.info('EventsReceived: ', { count: [...event.Records].length })

  const messageBlocks: Array<KnownBlock | Block> = stackEventMessageComposer(
    collection,
    region,
    stackId
  )

  const output = await batchGetDbItems([stackId]);

  logger.info("Output", {output})

  await sendUsingSlackHook(messageBlocks)

  tracer.putAnnotation('successfulEnd', true)

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'text/json' },
    body: {
      EventsReceived: [...event.Records].length
    }
  }
}

exports.handler = middy(handle)
  .use(captureLambdaHandler(tracer))
  .use(injectLambdaContext(logger, { clearState: true }))


