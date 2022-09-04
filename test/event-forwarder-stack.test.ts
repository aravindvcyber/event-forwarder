import * as cdk from 'aws-cdk-lib'
import { Template } from 'aws-cdk-lib/assertions'
import {EventForwarderStack}from '../lib/event-forwarder-stack'

test('EventForwarderStack Validated', () => {
  const app = new cdk.App()

  const stack = new EventForwarderStack(app, 'MyTestStack')

  const template = Template.fromStack(stack)

  console.log(template)

  template.hasResourceProperties('AWS::SQS::Queue', {
    MessageRetentionPeriod: 604800
  })

})
