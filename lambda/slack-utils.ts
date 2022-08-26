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
  MrkdwnElement,
  ContextBlock
} from '@slack/types'
import {
  CloudFormationStackEventBridgeEvent
} from './cfn-events'
import {
  logger
} from './stack-event-processor'
import { CloudformationEventDbModel } from './model'

const slackHook = new IncomingWebhook(process.env.SLACK_HOOK || '', {
  timeout: 0
})

export function generateItemTemplate(type: "plain_text" | "mrkdwn", text:string, include: boolean = false): PlainTextElement | MrkdwnElement {
  if(type === "mrkdwn"){
    return {
      type,
      text,
      verbatim: include
    } as MrkdwnElement;
  } else {
    return {
      type,
      text,
      emoji: include
    } as PlainTextElement;
  }
   
}

export function generateInnerSection (
  item: CloudformationEventDbModel
): PlainTextElement | MrkdwnElement {

  logger.info(item, {item});
  let note: string = new Date(parseInt(item.time.N)).toLocaleString()  + ' | ' + item.type.S

  let itemTemplate: PlainTextElement | MrkdwnElement = generateItemTemplate('mrkdwn',note);

  logger.info(item, {item});

  //const stackDetail: any = JSON.parse(item.detail.S);
  const driftDetail: any = JSON.parse(item.type.S === CloudFormationStackEventBridgeEvent.Drift_Detection_Change ? item.driftDetectionDetails.S : "{}" );

  // logger.info({ type, time, stackDetail });

  if (item.type.S === CloudFormationStackEventBridgeEvent.Resource_Change) {
    itemTemplate = generateItemTemplate('mrkdwn',">"+note + ' | *' + item.status.S + '* | Reason : _' + item.statusReason.S + '_ | Resource Type : ' + item.resourceType.S + ' | Physical-Resource-Id : `' + item.physicalResourceId.S + "` | Logical-Resource-Id : (" + item.logicalResourceId.S +")")
  } else if (item.type.S === CloudFormationStackEventBridgeEvent.Stack_Change) {
    itemTemplate = generateItemTemplate('mrkdwn',">"+note + ' | *' + item.status.S + '* | Reason : _' + item.statusReason.S + '_');
  } else if (
    item.type.S === CloudFormationStackEventBridgeEvent.Drift_Detection_Change
  ) {
    itemTemplate = generateItemTemplate('mrkdwn',">"+note + ' | *' + item.status+'* | isDetectionEnabled : `' + item.detectionStatus.S + '` | isDetectionEnabled : ' + JSON.stringify(driftDetail, undefined, 2));
  } else {
    note = JSON.stringify(item, undefined, 2)
    itemTemplate = generateItemTemplate('mrkdwn','```' + note + '```');
  }

  logger.info(itemTemplate, {itemTemplate});
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
    text: generateItemTemplate('mrkdwn',':rocket: <' + stackLink + '|View Stack in AWS Console>'),
    accessory: {
      type: "button",
      text: generateItemTemplate("plain_text", ":dango: Click to View", true) as PlainTextElement,
      value: "stackLink",
      url: stackLink,
      action_id: "button-action"
    }
  }
  const cfnDesignerBlock: SectionBlock = {
    type: 'section',
    text: generateItemTemplate('mrkdwn', ':chart: <' +
    cfnDesignerLink +
    '|View Cloud Formation Template in AWS Console Designer>'),
    accessory: {
      type: "button",
      text: generateItemTemplate("plain_text", ":dango: Click to View", true) as PlainTextElement,
      value: "cfnDesignerLink",
      url: cfnDesignerLink,
      action_id: "button-action"
    }
  }

  const contentSection: ContextBlock = {
    type: 'context',
    elements: [...payload],
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
    logger.info("msg",{ message })
    const response: IncomingWebhookResult = await slackHook.send(message)
    logger.info({ response })
  } catch (error) {
    logger.info({ error })
  }
}
