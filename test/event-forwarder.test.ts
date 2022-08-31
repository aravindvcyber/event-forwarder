import * as cdk from 'aws-cdk-lib'
import { Template } from 'aws-cdk-lib/assertions'
import * as EventForwarder from '../lib/event-forwarder-stack'

test('SQS Queue Created', () => {
  const app = new cdk.App()

  const stack = new EventForwarder.EventForwarderStack(app, 'MyTestStack')

  const template = Template.fromStack(stack)

  console.log(template)

  template.hasResourceProperties('AWS::SQS::Queue', {
    MessageRetentionPeriod: 604800
  })
})
