import {
  IncomingWebhook,
  IncomingWebhookResult,
  IncomingWebhookSendArguments
} from '@slack/webhook'
import {
  MessageAttachment,
  Block,
  KnownBlock,
  HeaderBlock,
  DividerBlock,
  SectionBlock,
  PlainTextElement,
  MrkdwnElement
} from '@slack/types'
import {
  CloudFormationResourceStatusChangeDetail,
  CloudFormationStackEventBridgeEvent
} from './cfn-events'
import {
  logger
} from './stack-event-processor'

const slackHook = new IncomingWebhook(process.env.SLACK_HOOK || '', {
  timeout: 0
})

export function generateInnerSection (
  time: string,
  type: string,
  detail: any
): PlainTextElement | MrkdwnElement {
  let note: string = type + ' | ' + time

  let itemTemplate: PlainTextElement | MrkdwnElement = {
    type: 'plain_text',
    text: note
  }

  const stackDetail: any = detail['status-details']

  // logger.info({ type, time, stackDetail });

  if (type === CloudFormationStackEventBridgeEvent.Resource_Change) {
    const content: CloudFormationResourceStatusChangeDetail = detail
    itemTemplate = {
      type: 'plain_text',
      text:
        note +
        ' Change : ' +
        stackDetail.status +
        ' | Reason : ' +
        stackDetail['status-reason'] +
        ' | Resource Type : ' +
        content['resource-type'] +
        ' | Resource-logical : ' +
        content['logical-resource-id']
        // + " | Resource-physical : " +
        // content["physical-resource-id"],
    }
  } else if (type === CloudFormationStackEventBridgeEvent.Stack_Change) {
    itemTemplate = {
      type: 'plain_text',
      text:
        note +
        ' | Change : ' +
        stackDetail.status +
        ' | Reason : ' +
        stackDetail['status-reason']
    }
  } else if (
    type === CloudFormationStackEventBridgeEvent.Drift_Detection_Change
  ) {
    itemTemplate = {
      type: 'plain_text',
      text:
        note +
        ' | Drift Status : ' +
        stackDetail['stack-drift-status'] +
        ' | isDetectionEnabled : ' +
        stackDetail['detection-status']
    }
  } else {
    note = JSON.stringify(detail, undefined, 2)
    itemTemplate = {
      type: 'mrkdwn',
      text: '```' + note + '```'
    }
  }

  // logger.info(JSON.stringify(itemTemplate, undefined, 2));
  return itemTemplate
}
export function stackEventMessageComposer (
  payload: Array<PlainTextElement | MrkdwnElement>,
  region: string,
  stackId: string
): Array<Block | KnownBlock> {
  const title: string = `:four_leaf_clover: ${
    stackId.split('/')[1]
  } events on ${region}`
  const header: HeaderBlock = {
    type: 'header',
    text: {
      type: 'plain_text',
      text: title,
      emoji: true
    }
  }

  const divider: DividerBlock = {
    type: 'divider'
  }

  const cfnDesignerLink: string = `https://${region}.console.aws.amazon.com/cloudformation/designer/home?region=${region}&stackId=${encodeURIComponent(
    stackId
  )}`
  const stackLink: string = `https://${region}.console.aws.amazon.com/cloudformation/home?region=${region}&stackId=${encodeURIComponent(
    stackId
  )}`

  logger.appendKeys({
    stackName: stackId.split('/')[1]
  })

  const stackBlock: SectionBlock = {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: ':rocket: <' + stackLink + '|View Stack in AWS Console>'
    }
  }
  const cfnDesignerBlock: SectionBlock = {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text:
        ':chart: <' +
        cfnDesignerLink +
        '|View Cloud Formation Template Designer in AWS Console>'
    }
  }

  const contentSection: SectionBlock = {
    type: 'section',
    fields: [...payload]
  }
  const blocks: Array<KnownBlock | Block> = [
    header,
    divider,
    contentSection,
    divider,
    stackBlock,
    cfnDesignerBlock
  ]
  return blocks
}

export async function sendUsingSlackHook (blocks: Array<KnownBlock | Block>) {
  try {
    const attachments: MessageAttachment[] = []
    const message: IncomingWebhookSendArguments = {
      attachments,
      blocks,
      unfurl_links: false,
      unfurl_media: false
    }
    logger.info({ message })
    const response: IncomingWebhookResult = await slackHook.send(message)
    logger.info({ response })
  } catch (error) {
    logger.info({ error })
  }
}
