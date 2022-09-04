import * as cdk from 'aws-cdk-lib'
import { Template } from 'aws-cdk-lib/assertions'
import {RemoteEventRouterStack}from '../lib/remote-event-router-stack'

test('RemoteEventRouterStack Validated', () => {
  const app = new cdk.App()

  const stack = new RemoteEventRouterStack(app, 'MyTestStack',{
    account: '123',
    region: 'us-east-1'
  })

  const template = Template.fromStack(stack)

  console.log(template)

  template.hasResourceProperties('AWS::SQS::Queue', {
    MessageRetentionPeriod: 604800
  })

})
