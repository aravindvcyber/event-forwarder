import { Duration, RemovalPolicy } from "aws-cdk-lib";
import { EventBus, IEventBus } from "aws-cdk-lib/aws-events";
import { Architecture, Code, LayerVersion, LayerVersionProps, Runtime } from "aws-cdk-lib/aws-lambda";
import { DeadLetterQueue, Queue } from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs";
import { join } from "path";


export const dlqQueueProps = {
  retentionPeriod: Duration.days(7),
  removalPolicy: RemovalPolicy.DESTROY,
};


export const getDefaultBus = (scope: Construct, region:string, account:string): IEventBus => { 
    return EventBus.fromEventBusArn(scope,`DefaultBus-${region}-${account}`,`arn:aws:events:${region}:${account}:event-bus/default`)
};

export const normalQueueProps = {
  retentionPeriod: Duration.days(1),
  removalPolicy: RemovalPolicy.DESTROY,
  deliveryDelay: Duration.seconds(1),
  visibilityTimeout: Duration.minutes(3),
};

export const generateDLQ = (scope: Construct, queueName: string): Queue => {
  return new Queue(scope, queueName, {
    ...dlqQueueProps,
    queueName,
  });
};

export const generateDLQFifo = (scope: Construct, queueName: string): Queue => {
  return new Queue(scope, queueName, {
    ...dlqQueueProps,
    queueName,
    fifo: true
  });
};

export const generateQueue = (
  scope: Construct,
  queueName: string,
  deadLetterQueue: DeadLetterQueue
): Queue => {
  return new Queue(scope, queueName, {
    ...normalQueueProps,
    queueName,
    deadLetterQueue,
  });
};

export const generateQueueFifo = (
  scope: Construct,
  queueName: string,
  deadLetterQueue: DeadLetterQueue
): Queue => {
  return new Queue(scope, queueName, {
    ...normalQueueProps,
    queueName,
    deadLetterQueue,
    fifo: true
  });
};





const defaultLayerProps: LayerVersionProps = {
  removalPolicy: RemovalPolicy.DESTROY,
  code: Code.fromAsset(join(__dirname, "..", "layers", "default")),
  // code: Code.fromAsset(join(__dirname, "..", "dist", "layers", "utils")),
  compatibleArchitectures: [Architecture.X86_64],
  compatibleRuntimes: [Runtime.NODEJS_14_X],
}



export const generateLayerVersion = (
  scope: Construct,
  layerName: string,
  props: Partial<LayerVersion>
): LayerVersion => {
    return new LayerVersion(scope, layerName, {
      ...defaultLayerProps,
      code: Code.fromAsset(join(__dirname, "..", "layers", layerName)),
      ...props
    })  
};
