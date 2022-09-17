#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { EventForwarderStack } from "../lib/event-forwarder-stack";
import { EventForwarderDataStack } from "../lib/event-forwarder-data-stack";
import { RemoteEventRouterStack } from "../lib/remote-event-router-stack";
import { Tags } from "aws-cdk-lib";

//import { IConfig } from 'config'
const config = require("config");
const app = new cdk.App();

const remoteAccounts = config.get("remoteAccounts").split(",");
const remoteRegions = config.get("remoteRegions").split(",");

const eventForwarderData = new EventForwarderDataStack(app, "EventForwarderDataStack", {
  /* If you don't specify 'env', this stack will be environment-agnostic.
   * Account/Region-dependent features and context lookups will not work,
   * but a single synthesized template can be deployed anywhere. */

  /* Uncomment the next line to specialize this stack for the AWS Account
   * and Region that are implied by the current CLI configuration. */
  // env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },

  /* Uncomment the next line if you know exactly what Account and Region you
   * want to deploy the stack to. */
  env: { account: config.get("account"), region: config.get("region") },
  analyticsReporting: true,
  stackName: "EventForwarderDataStack",
  /* For more information, see https://docs.aws.amazon.com/cdk/latest/guide/environments.html */
});
Tags.of(eventForwarderData).add('appName', 'event-forwarder');

const EventForwarder = new EventForwarderStack(app, "EventForwarderStack", {
  /* If you don't specify 'env', this stack will be environment-agnostic.
   * Account/Region-dependent features and context lookups will not work,
   * but a single synthesized template can be deployed anywhere. */

  /* Uncomment the next line to specialize this stack for the AWS Account
   * and Region that are implied by the current CLI configuration. */
  // env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },

  /* Uncomment the next line if you know exactly what Account and Region you
   * want to deploy the stack to. */
  env: { account: config.get("account"), region: config.get("region") },
  analyticsReporting: true,
  stackName: "EventForwarderStack",
  /* For more information, see https://docs.aws.amazon.com/cdk/latest/guide/environments.html */
});

//Tags.of(EventForwarder).add('appName', 'event-forwarder');

remoteAccounts.map((account: string) => {
  remoteRegions.map((region: string) => {
    const RemoteEventRouter = new RemoteEventRouterStack(app, `RemoteEventRouterStack-${region}-${account}`, {
      env: { account, region },
      analyticsReporting: true,
      stackName: `RemoteEventRouterStack`,
      account,
      region
    });
    //Tags.of(RemoteEventRouter).add('appName', 'event-forwarder');
  });
});




