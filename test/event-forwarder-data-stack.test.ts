import * as cdk from 'aws-cdk-lib'
import { Template } from 'aws-cdk-lib/assertions'
import {EventForwarderDataStack}from '../lib/event-forwarder-data-stack'

test('DynamoDB Validated', () => {
  const app = new cdk.App()

  const stack = new EventForwarderDataStack(app, 'MyTestStack')

  const template = Template.fromStack(stack)

  console.log(template)

  template.hasResourceProperties('AWS::DynamoDB::Table', {
    ProvisionedThroughput: {
      "ReadCapacityUnits": 5,
      "WriteCapacityUnits": 5
     }
  })

})
