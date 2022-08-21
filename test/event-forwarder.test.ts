import * as cdk from 'aws-cdk-lib'
import { Template } from 'aws-cdk-lib/assertions'
import * as EventForwarder from '../lib/event-forwarder-stack'

test('SQS Queue Created', () => {
  const app = new cdk.App()
  // WHEN
  const stack = new EventForwarder.EventForwarderStack(app, 'MyTestStack')
  // THEN
  const template = Template.fromStack(stack)

  template.hasResourceProperties('AWS::SQS::Queue', {
    MessageRetentionPeriod: 604800
  })
})
