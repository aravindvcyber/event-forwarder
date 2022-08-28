# Welcome to the Event Forwarder Project, a lot of use cases will come soon.

> Starting with Cloudformation events to post Slack notifications effortless from multi-region and even cross accounts to never miss your/peers/ci initiated AWS cloudformation deployments on stacks and resources besides that it could also notify drift events.

Basically, I named this to stress the fact that we would be consuming various aws event bridge events (especially the newly available AWS cloud formation events) to various channels which would help developers and teams effortlessly track and monitor the deployments happening in a multi-region and multi-account ecosystem.

I have especially used Slack as the first delivery channel since it is quite common in organizations and free to set up workspace even for an amateur developer. At the same time, we are not trying to limit the possibilities. This solution could be further extended to include other channels in the future.

# Architecture in short

![Arch Diag](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/knj8d49e7yc8onsbbfxt.jpeg)

The backbone of this stack is based on the new feature released for the availability of cloud formation events in the default bus in the event bridge.

These events are three types.

* Stack level changes Event
* Resource level changes Event
* Drift detection Event

This project stack has two components as elaborated below.

* `Remote Event Router Stack` which is deployed into one or many regions across accounts forwarding specific event bridge events (Cloudformation Events specifically) into the target default EventBus (in the below stack) by making use of event bridge rules to forward events from the current default EventBus (source).
* `Event Forwarder Stack` which lives in a single region for event ingestion and transformation to various delivery channels (Slack is the first channel) from the default EventBus (target).

## Prerequisites

1) At least single region where you could cdk deploy with necessary privileges to provide the resources such as lambda, sqs, eventbridge rules, and targets with access to cloudwatch and xray

>Want to experiment making use of AWS free tier benefits for personal use and request access sandbox account from your org

2) At least one Custom Slack App with incoming webhook generated and configured to post to necessary slack channels

>Want to experiment create a free slack workspace (Recommended), creating a slack app with an incoming webhook, or generating an incoming webhook in a slack app from your organization admin? There are multiple tutorials to get this or DM me for clarifications.

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

# Setup and bootstrapping these stack

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

* Sample CDK deployment via terminal or even CDK destroy these are visible for the developer but may not be saved anywhere except in the AWS console view. Your peers are also not aware of these deployments.

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

And all these cool things about this slack post it is having a rich format that could be customized at the source and it also include a deep link to the resources provisioned besides the stack-level links to various console screens.

> Note these console links will only work if you have already logged into your respective AWS account in the browser where you open them and if you have the necessary privileges make sure that security even for production environments is honored when you share this across various members of your teams for any follow ups in any slack threads.