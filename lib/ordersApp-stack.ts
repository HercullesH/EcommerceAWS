import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as lambdaNodeJS from 'aws-cdk-lib/aws-lambda-nodejs'
import * as cdk from 'aws-cdk-lib'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import * as ssm from 'aws-cdk-lib/aws-ssm'
import { Construct } from 'constructs'
import * as sns from 'aws-cdk-lib/aws-sns'
import * as subs from 'aws-cdk-lib/aws-sns-subscriptions'

interface OrdersAppStackProps extends cdk.StackProps {
    productsDdb: dynamodb.Table
}

export class OrdersAppStack extends cdk.Stack {
    readonly ordersHandler: lambdaNodeJS.NodejsFunction

    constructor(scope: Construct, id: string, props: OrdersAppStackProps){
        super(scope, id, props)

        const ordersDdb = new dynamodb.Table(this, 'OrdersDdb', {
            tableName: 'orders',
            partitionKey: {
                name: 'pk',
                type: dynamodb.AttributeType.STRING
            },
            sortKey: {
                name: 'sk',
                type: dynamodb.AttributeType.STRING
            },
            billingMode: dynamodb.BillingMode.PROVISIONED,
            readCapacity: 1,
            writeCapacity: 1
        })

        const ordersLayerArn = ssm.StringParameter.valueForStringParameter(this, 'OrdersLayerVersionArn')
        const ordersLayer = lambda.LayerVersion.fromLayerVersionArn(this, 'OrdersLayerVersionArn', ordersLayerArn)

        const orderEventsLayerArn = ssm.StringParameter.valueForStringParameter(this, 'OrderEventsLayerVersionArn')
        const orderEventsLayer = lambda.LayerVersion.fromLayerVersionArn(this, 'OrderEventsLayerVersionArn', orderEventsLayerArn)

        const ordersApiLayerArn = ssm.StringParameter.valueForStringParameter(this, 'OrdersApiLayerVersionArn')
        const ordersApiLayer = lambda.LayerVersion.fromLayerVersionArn(this, 'OrdersApiLayerVersionArn', ordersApiLayerArn)

        const productsLayerArn = ssm.StringParameter.valueForStringParameter(this, 'ProductsLayerVersionArn')
        const productsLayer = lambda.LayerVersion.fromLayerVersionArn(this, 'ProductsLayerVersionArn', productsLayerArn)

        const ordersTopic = new sns.Topic(this, 'OrderEventsTopic', {
            displayName: 'Order events topic',
            topicName: 'order-events'
        })

        this.ordersHandler = new lambdaNodeJS.NodejsFunction(this, 'OrdersFunction', {
            functionName: 'OrdersFunction',
            entry: 'lambda/orders/ordersFunction.ts',
            handler: 'handler',
            memorySize: 512,
            runtime: lambda.Runtime.NODEJS_20_X,
            timeout: cdk.Duration.seconds(2),
            bundling: {
                minify: true,
                sourceMap: false,
                nodeModules: [
                    'aws-xray-sdk-core'
                ]
            },
            environment: {
                PRODUCTS_DDB: props.productsDdb.tableName,
                ORDERS_DDB: ordersDdb.tableName,
                ORDER_EVENTS_TOPIC_ARN: ordersTopic.topicArn
            },
            layers: [
                ordersLayer,
                productsLayer,
                ordersApiLayer,
                orderEventsLayer
            ],
            tracing: lambda.Tracing.ACTIVE,
            insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_119_0
        })

        ordersDdb.grantReadWriteData(this.ordersHandler)
        props.productsDdb.grantReadData(this.ordersHandler)
        ordersTopic.grantPublish(this.ordersHandler)
    }
}