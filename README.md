# Event Forwarder :roller_coaster:

Basically, I named this to stress the fact that we would be routing and consuming various aws event bridge events (especially the newly available AWS cloud formation events) to various channels which would help developers and teams effortlessly track and monitor the deployments happening in a multi-region and multi-account ecosystem.

**Note:** I have published the initial blog of this, highly recommended to check that out first before you try to do hands on.

🔁 Original post at 🔗 [Dev Post](https://devpost.hashnode.dev/aws-cdk-101-projects-cdk-stackresourcedrift-events-forwarded-to-cool-slack-posts-event-forwarder)

🔁 Reposted at 🔗 [dev to @aravindvcyber](https://dev.to/aws-builders/aws-cdk-101-projects-cdk-stackresourcedrift-events-forwarded-to-cool-slack-posts-event-forwarder-1m0m)

I believe a lot of use cases will come soon for now I am starting with the below one.

> Starting with Cloudformation events to post Slack notifications effortless from multi-region and even cross accounts to never miss your/peers/ci initiated AWS cloudformation deployments on stacks and resources besides that it could also notify drift events.

I have especially used Slack as the first delivery channel since it is quite common in organizations and free to set up personal workspace even for an amateur developer. At the same time, we are not trying to limit the possibilities. This solution could be further extended to include other mediums in the future.
# Architecture in short :roller_coaster:

![Arch Diag](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/knj8d49e7yc8onsbbfxt.jpeg)

The backbone of this stack is based on the new feature released for the availability of cloud formation events in the default bus in the AWS Eventbridge.

These events are of three types.

* Stack level Events
* Resource level Events
* Drift detection Events

This project stack has two components as elaborated below.

* `Remote Event Router Stack` which is deployed into one or many regions across accounts forwarding specific eventbridge events (Cloudformation Events specifically) into the specific target default EventBus (in the below stack) from the current default EventBus (source) by making use of event bridge rules.
* `Event Forwarder Stack` which lives in a single region for event ingestion and transformation to various delivery channels (Slack is the first channel) from the default EventBus (target).

## Prerequisites :roller_coaster:

1) At least single region where you could cdk deploy with necessary privileges to spin up the resources such as lambda, sqs, eventbridge rules, and targets with access to cloudwatch and xray

>Make use of AWS free tier benefits for personal use or request access sandbox account from your org to try this out.

1) At least one Custom Slack App with incoming webhook generated and configured to post to necessary slack channels

>Want to experiment create a free slack workspace (Recommended), creating a slack app with an incoming webhook, or generating an incoming webhook in a slack app from your organization admin? There are multiple tutorials to get this or DM me for clarifications.

* [Create Slack App](https://api.slack.com/authentication/basics#creating)

* [Setup Incoming Webhook](https://api.slack.com/messaging/webhooks)

## Checkout the config folder before you run

The `default.json` and `test.json` are from GitHub with dummy fields make sure you create `local.json` and `production.json` overriding the necessary fields of choice.

```json
{
    "account": "123",   //Primary account to host the solution
    "region": "ap-south-1", //Primary region to host the solution
    "slackhook": "", //You need to update your slack app incoming webhook as the primary delivery channel for your users
    "errorslackhook": "",//You need to update your slack app incoming webhook as the error delivery channel to notify this stack maintainers in your environment to get the errors as and when they happen and need to dive into cloudwatch logs to figure out most of the issues.
    "eventStore": "eventStores9",//This is some new dynamodb table name of your choice
    "remoteRegions":"us-east-1,us-east-2", //Your secondary regions to monitor
    "remoteAccounts":"123", //Your secondary accounts to monitor
    "logLevel":"WARN", //Use WARN for less verbose and use INFO for the verbose cloudwatch logs for the main processor handler
    "perPostEventCount": "10",//This is used to limit max N events in a single slack post, this is mainly to make sure we don't hit limit on a single slack post
    "dynamodbQueryPagingLimit": "15",//This is used to have limited the read units on a single API call to not throttle your dynamodb if you are using provisioned RCU.
    "logRetentionDays": "14",//Retention period for the primary handler cloudwatch logs
    "deleteNotified": "false", //Setting this to true will automatically delete data from dynamoDb once the event are notified. But I highly recommend you to have this false to understand the data which gets generated, which could help you with other integrations or possibilities in this monitoring
}
```

# Setup and bootstrapping

Like other project repos, you need to simply clone this repo and install the dependencies.

Besides that, you may need to configure an AWS profile in your terminal where you run this solution.

In this project, I have hard coded a specific profile `--profile=av` in `npm run scripts` since I have multiple profiles in my terminal and not to risk deployments with other environments.

Simply define one and update your custom name for a seamless experience by editing which is my kind recommendation.
`~/.aws/credentials (Linux & Mac)` or `%USERPROFILE%\.aws\credentials (Windows)`

```yaml
[av]
aws_access_key_id=dummy
aws_secret_access_key=dummy
```

Also before you deploy to any region on any account make sure that it has the CDK bootstrap already set up.

Or accordingly, run the below command to bootstrap CDK.

`cdk bootstrap aws://account1/region1 aws://account2/region2 `

Those are only the formalities I wanted to mention for the beginners/starters with AWS CDK so that they never find such blocking issues. You could also read my AWS CDK 101 series in my blogs or feel free to [DM me on Twitter](https://twitter.com/Aravind_V7) if to need some help with setup.

🔁 Original previous series post at 🔗 [Dev Post](https://devpost.hashnode.dev/aws-cdk-101-typescript)

🔁 Reposted the previous series post at 🔗 [dev to @aravindvcyber](https://dev.to/aravindvcyber/series/17111)

## Useful commands

* `npm run build`   compile typescript to js using webpack for lambda and to run jest test for testing the compilation issues.

### Standard CDK commands
  
* `cdk synth`       emits the synthesized CloudFormation template and also makes sure your code is healthy and good to deploy

* `cdk diff`        compare deployed stack with the current state if you wanted to see what this deploy into your env

* `cdk deploy`      deploy the stack to your default AWS account/region

* `cdk destroy`     destroy the stack or clean up your last deployment if fails miserably before you start again

### Custom npm scripts

(make sure you have custom-named profile `av` or update it accordingly)

* To deploy the remote stacks run the below command.
  `cdk:deploy`

> Remember a single region/account is sufficient to try this integration but I just wanted to remind you about the capabilities.

* To deploy the remote stacks run the below command.
  `cdk:deploy:remotes`

## Use cases that emit Cloudformation Events:

* CDK deployment via terminal or even CDK destroy these are visible for the developer but may not be saved anywhere except in the AWS console view. Your peers are also not aware of these deployments happening until they check the console. Sending this to slack channels will drive greater involvements from the team.

  ![simple stack deployment](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/j7017a2xvep214r6doo0.png)

* Direct cloudformation console level changes/deletes

  ![Console level delete](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/yxa0l9jc0pwazuirz7o9.png)

* Resource level mutations can also be tracked with drift detection but only one person knows what happened and could not easily correlate

* Someone edits the Cloud formation template using designer and updates the stack with/without changeset

  ![detect drifts](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/7p6wzit4mi33ms3hfnu4.png)

* Or yourself/team can have other parallel IaC framework like terraform making some changes via terminals

* Even your CI/CD pipeline does deployments to AWS, you need not check them to understand if the deployments are completed rather slack post will reach your channel in seconds consistently across the included environments

* Forbidden environments where you don't have access to checkout the events and resources created and may know if it had failed or does not know the resource names and you could not check this in the console.

## Slack Posts Results

Never miss anything happening to your cloud formation stacks since you will be always notified in your respective slack channel using this solution.

### Drift detection notifications

![drift detection](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/lqvwtozp4obo3qwfaaxw.png)

### Stack deletion notifications

![delete 1/2](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/l85lcwuve6mn7b3nbmik.png)

![delete 2/2](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/28ecbpodmvp0pqj95ip4.png)

### Stack/Resource creation/update notifications

![create/update 1 ](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/tp0927awhq1yyasb5mit.png)

![create/update 2 ](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/sxpjp15lq2sz82e3358x.png)

![create/update 3](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/cdggdp9wvpr28wjnx5t9.png)

### Even exception are sent to slack

This can be directly reported to the maintainers without waiting to dig into the cloudwatch logs to identify and track the issue.

![error notification to admin via slack post](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/f2pg8pcv1hav2gf7boil.png)

And all these cool things about this slack post it is having a rich format that could be customized at the source and it also include a deep link to the resources provisioned besides the stack-level links to various console screens.

> Note these console links will only work if you have already logged into your respective AWS account in the browser where you open them and if you have the necessary privileges make sure that security even for production environments is honored when you share this across various members of your teams for any follow ups in any slack threads.

## Extracted Utils :roller_coaster:

I have made used most of the generic parts of this solution are refracted into separated util functions which could help to simply the solution and may be reuse them in your own project work.

* Slack Utils
* Console Utils
* Dynamodb Utils
* Data model to interact with dynamodb
* Cfn events definition and may be more soon.

## Dynamodb to store data :roller_coaster:

Here in this article, we choose to use dynamodb not only as an ad-hoc data store. I believe the data generated will trigger further insights and expand the possibilities of this solution. Also I have used provisioned RCUs and WCUs to make use of my free tier benefits and as well set throttling, it is also recommend try with on-demand mode and pay as your usage.

### Indexes created for critical data lookups :roller_coaster:

![rich indexes](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/or2mxqgomg2jxewpsj4k.png)

### Sample DB item :roller_coaster:

```json
{
 "stackId": "arn:aws:cloudformation:ap-south-1:575066707855:stack/EventForwarderStack/279c3120-1f91-11ed-a6ef-022d5cdd6444",
 "time": 1661700649000,
 "account": "575066707855",
 "clientRequestToken": "",
 "detail": "{\"stack-id\":\"arn:aws:cloudformation:ap-south-1:575066707855:stack/EventForwarderStack/279c3120-1f91-11ed-a6ef-022d5cdd6444\",\"stack-drift-detection-id\":\"651434b0-26e6-11ed-817d-06bb5d2f96a6\",\"status-details\":{\"stack-drift-status\":\"\",\"detection-status\":\"DETECTION_IN_PROGRESS\"},\"drift-detection-details\":{\"drifted-stack-resource-count\":-1}}",
 "detectionStatus": "DETECTION_IN_PROGRESS",
 "driftDetectionDetails": "{\"drifted-stack-resource-count\":-1}",
 "eventId": "2892c708-d38d-9a9a-115e-c981c1d3d62f",
 "logicalResourceId": "",
 "notified": "false",
 "notifiedTime": 1661700651498,
 "physicalResourceId": "",
 "region": "ap-south-1",
 "resources": [
  "arn:aws:cloudformation:ap-south-1:575066707855:stack/EventForwarderStack/279c3120-1f91-11ed-a6ef-022d5cdd6444"
 ],
 "resourceType": "",
 "status": "DETECTION_IN_PROGRESS",
 "statusReason": "",
 "type": "CloudFormation Drift Detection Status Change"
}
```

This project is open to your generous contributions if you feel it will help other developers and also you could also solve the issues or bring new features with a Pull request.

[event-forwarder Github repo](https://github.com/aravindvcyber/event-forwarder/)

⏭ We have our next article in serverless, do check out

If in case missed my previous article, do find it with the below links.

🔁 Original previous series post at 🔗 [Dev Post](https://devpost.hashnode.dev/aws-cdk-101-typescript)

🔁 Reposted the previous series post at 🔗 [dev to @aravindvcyber](https://dev.to/aravindvcyber/series/17111)

🎉 Thanks for supporting! 🙏 and do follow and share this series for more such articles.

Would be great if you like to [☕ Buy Me a Coffee](https://www.buymeacoffee.com/AravindVCyber), to help boost my efforts 😍.

<a href="https://www.buymeacoffee.com/AravindVCyber"><img src="https://img.buymeacoffee.com/button-api/?text=Buy me a coffee&emoji=&slug=AravindVCyber&button_colour=BD5FFF&font_colour=ffffff&font_family=Cookie&outline_colour=000000&coffee_colour=FFDD00" /></a>

<a href='https://ko-fi.com/X8X0CITDJ' target='_blank'><img height='36' style='border:0px;height:36px;' src='https://cdn.ko-fi.com/cdn/kofi4.png?v=3' border='0' alt='Buy Me a Coffee at ko-fi.com' /></a>

🔁 Original post at 🔗 [Dev Post](https://devpost.hashnode.dev/aws-cdk-101-projects-cdk-stackresourcedrift-events-forwarded-to-cool-slack-posts-event-forwarder)

🔁 Reposted at 🔗 [dev to @aravindvcyber](https://dev.to/aws-builders/aws-cdk-101-projects-cdk-stackresourcedrift-events-forwarded-to-cool-slack-posts-event-forwarder-1m0m)
