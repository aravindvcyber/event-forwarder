import {
  IncomingWebhook,
  IncomingWebhookResult,
  IncomingWebhookSendArguments,
} from "@slack/webhook";
import {
  MessageAttachment,
  Block,
  KnownBlock,
  HeaderBlock,
  DividerBlock,
  SectionBlock,
  PlainTextElement,
  MrkdwnElement,
  ContextBlock,
} from "@slack/types";
import { CloudFormationStackEventBridgeEvent } from "./cfn-events";
import { logger } from "./stack-event-processor";
import { CloudformationEventDbModel } from "./model";
import { generateResourceLink } from "./console-utils";

const slackHook = new IncomingWebhook(process.env.SLACK_HOOK || "", {
  timeout: 0,
});
const errorSlackHook = new IncomingWebhook(process.env.ERROR_SLACK_HOOK || "", {
  timeout: 0,
});

export function generateItemTemplate(
  type: "plain_text" | "mrkdwn",
  text: string,
  include: boolean = false
): PlainTextElement | MrkdwnElement {
  if (type === "mrkdwn") {
    return {
      type,
      text,
      verbatim: include,
    } as MrkdwnElement;
  } else {
    return {
      type,
      text,
      emoji: include,
    } as PlainTextElement;
  }
}

export function genErrBlock(error: any): MrkdwnElement {
  return generateItemTemplate(
    "mrkdwn",
    JSON.stringify(error),
    true
  ) as MrkdwnElement;
}

export function generateInnerSection(
  item: CloudformationEventDbModel,
  region: string
): PlainTextElement | MrkdwnElement {
  logger.info(item, { item });
  let note: string =
    new Date(parseInt(item.time.N)).toLocaleString() + " | " + item.type.S;

  let itemTemplate: PlainTextElement | MrkdwnElement = generateItemTemplate(
    "mrkdwn",
    note
  );

  logger.info(item, { item });

  //const stackDetail: any = JSON.parse(item.detail.S);
  const driftDetail: any = JSON.parse(
    item.type.S === CloudFormationStackEventBridgeEvent.Drift_Detection_Change
      ? item.driftDetectionDetails.S
      : "{}"
  );

  // logger.info({ type, time, stackDetail });

  if (item.type.S === CloudFormationStackEventBridgeEvent.Resource_Change) {
    const link = mrkdwnLink(
      item.resourceType.S,
      region,
      item.physicalResourceId.S
    );

    let message: string =
      ">" +
      note +
      " | *" +
      item.status.S +
      "* | _" +
      item.statusReason.S +
      "_ | " +
      item.resourceType.S +
      " | `(" +
      item.logicalResourceId.S +
      ")`";

    if (item.status.S === "CREATE_COMPLETE") {
      message = message + " | " + link;
      if (item.resourceType.S === "AWS::Lambda::Function") {
        const loglink = mrkdwnLink(
          "logGroup",
          region,
          item.physicalResourceId.S
        );
        message = message + " | Log Group: " + loglink;
      }
    }

    itemTemplate = generateItemTemplate("mrkdwn", message);
  } else if (item.type.S === CloudFormationStackEventBridgeEvent.Stack_Change) {
    itemTemplate = generateItemTemplate(
      "mrkdwn",
      ">" +
        note +
        " | *" +
        item.status.S +
        "* | Reason : _" +
        item.statusReason.S +
        "_"
    );
  } else if (
    item.type.S === CloudFormationStackEventBridgeEvent.Drift_Detection_Change
  ) {
    itemTemplate = generateItemTemplate(
      "mrkdwn",
      ">" +
        note +
        " | *" +
        item.status.S +
        "* | isDetectionEnabled : `" +
        item.detectionStatus.S +
        "` | driftDetail : " +
        JSON.stringify(driftDetail, undefined, 2)
    );
  } else {
    note = JSON.stringify(item, undefined, 2);
    itemTemplate = generateItemTemplate("mrkdwn", "```" + note + "```");
  }
  logger.info(itemTemplate, { itemTemplate });
  return itemTemplate;
}

export function mrkdwnLink(
  resourceType: string,
  region: string,
  physicalId: string
): string {
  let result = generateResourceLink(resourceType, region, physicalId);
  if (result != physicalId) {
    result = `<${result}|${physicalId}>`;
  }
  return result;
}

export function errorMessageComposer(
  payload: Array<MrkdwnElement>
): Array<Block | KnownBlock> {
  const title: string = `:red_circle: An unhandled exception occurred in EventForwarderHandler `;
  const header: HeaderBlock = {
    type: "header",
    text: {
      type: "plain_text",
      text: title,
      emoji: true,
    },
  };
  const contentSection: ContextBlock = {
    type: "context",
    elements: [...payload],
  };
  const blocks: Array<KnownBlock | Block> = [header, contentSection];
  return blocks;
}

export function stackEventMessageComposer(
  payload: Array<PlainTextElement | MrkdwnElement>,
  region: string,
  stackId: string,
  account: string,
  index: number,
  chunks: number,
  status: string
): Array<Block | KnownBlock> {
  const title: string = `:construction: ${
    stackId.split("/")[1]
  } events from ${region} for account ${account} page ${index}/${chunks} on ${status}`;
  const header: HeaderBlock = {
    type: "header",
    text: {
      type: "plain_text",
      text: title,
      emoji: true,
    },
  };

  const divider: DividerBlock = {
    type: "divider",
  };

  const stackLink: string = generateResourceLink("stackLink", region, stackId);
  const AppManagerResourcesLink: string = generateResourceLink("AppManagerResourcesLink", region, stackId);
  const driftsLink: string = generateResourceLink(
    "driftsLink",
    region,
    stackId
  );

  const cfnDesignerLink: string = generateResourceLink(
    "cfnDesignerLink",
    region,
    stackId
  );

  logger.appendKeys({
    stackName: stackId.split("/")[1],
  });

  const stackBlock: SectionBlock = {
    type: "section",
    text: generateItemTemplate(
      "mrkdwn",
      ":rocket: <" + stackLink + "|Stack>"
    ),
    accessory: {
      type: "button",
      text: generateItemTemplate(
        "plain_text",
        ":dango: Open",
        true
      ) as PlainTextElement,
      value: "stackLink",
      url: stackLink,
      action_id: "button-action",
    },
  };
  const driftsBlock: SectionBlock = {
    type: "section",
    text: generateItemTemplate(
      "mrkdwn",
      ":bulb: <" + driftsLink + "|Stack drifts>"
    ),
    accessory: {
      type: "button",
      text: generateItemTemplate(
        "plain_text",
        ":dango: Open",
        true
      ) as PlainTextElement,
      value: "driftsLink",
      url: driftsLink,
      action_id: "button-action",
    },
  };
  const cfnDesignerBlock: SectionBlock = {
    type: "section",
    text: generateItemTemplate(
      "mrkdwn",
      ":chart: <" +
        cfnDesignerLink +
        "|Cloud Formation Designer>"
    ),
    accessory: {
      type: "button",
      text: generateItemTemplate(
        "plain_text",
        ":dango: Open",
        true
      ) as PlainTextElement,
      value: "cfnDesignerLink",
      url: cfnDesignerLink,
      action_id: "button-action",
    },
  };

  const AppManagerResourcesBlock: SectionBlock = {
    type: "section",
    text: generateItemTemplate(
      "mrkdwn",
      ":four_leaf_clover: <" +
        AppManagerResourcesLink +
        "|Application Manager Resources>"
    ),
    accessory: {
      type: "button",
      text: generateItemTemplate(
        "plain_text",
        ":dango: Open",
        true
      ) as PlainTextElement,
      value: "AppManagerResourcesLink",
      url: AppManagerResourcesLink,
      action_id: "button-action",
    },
  };

  const contentSection: ContextBlock = {
    type: "context",
    elements: [...payload],
  };
  const blocks: Array<KnownBlock | Block> = [header, divider, contentSection];
  if (index === chunks && status != 'DELETE_COMPLETE') {
    blocks.push(divider);
    blocks.push(stackBlock);
    blocks.push(driftsBlock);
    blocks.push(cfnDesignerBlock);
    blocks.push(AppManagerResourcesBlock);
  }
  return blocks;
}

export async function sendUsingSlackHook(blocks: Array<KnownBlock | Block>) {
  try {
    const attachments: MessageAttachment[] = [];
    const message: IncomingWebhookSendArguments = {
      attachments,
      blocks,
      unfurl_links: false,
      unfurl_media: false,
    };
    logger.info("msg", { message });
    const response: IncomingWebhookResult = await slackHook.send(message);
    logger.info({ response });
  } catch (error) {
    logger.info({ slackError: error });
    throw error
  }
}

export async function sendUsingErrorSlackHook(
  blocks: Array<KnownBlock | Block>
) {
  try {
    const attachments: MessageAttachment[] = [];
    const message: IncomingWebhookSendArguments = {
      attachments,
      blocks,
      unfurl_links: false,
      unfurl_media: false,
    };
    logger.info("msg", { message });
    const response: IncomingWebhookResult = await errorSlackHook.send(message);
    logger.info({ response });
  } catch (error) {
    logger.info({ slackError: error });
  }
}
