import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as lambdaNodeJS from 'aws-cdk-lib/aws-lambda-nodejs'
import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import * as sqs from 'aws-cdk-lib/aws-sqs'
import * as events from 'aws-cdk-lib/aws-events'
import * as targets from 'aws-cdk-lib/aws-events-targets'

export class AuditEventBusStack extends cdk.Stack {
    readonly bus: events.EventBus

    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props)

        this.bus = new events.EventBus(this, 'AuditEventBus', {
            eventBusName: 'AuditEventBus'
        })

        this.bus.archive('BusArchive', {
            eventPattern: {
                source: ['app.order']
            },
            archiveName: 'auditEvents',
            retention: cdk.Duration.days(10)
        })

        const nonValidOrderRule = new events.Rule(this, 'NonValidOrderRule', {
            ruleName: 'NonValidOrderRule',
            description: 'Rule matching non valid order',
            eventBus: this.bus,
            eventPattern: {
                source: ['app.order'],
                detailType: ['order'],
                detail: {
                    reason: ['PRODUCT_NOT_FOUND']
                }
            }
        })

        const ordersErrorsFunction = new lambdaNodeJS.NodejsFunction(this, 'OrdersErrorsFunction', {
                    functionName: 'OrdersErrorsFunction',
                    entry: 'lambda/audit/ordersErrorsFunction.ts',
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
                    tracing: lambda.Tracing.ACTIVE,
                    insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_119_0
        })

        nonValidOrderRule.addTarget(new targets.LambdaFunction(ordersErrorsFunction))

        const nonValidInvoiceRule = new events.Rule(this, 'NonValidInvoiceRule', {
            ruleName: 'NonValidInvoiceRule',
            description: 'Rule matching non valid invoice',
            eventBus: this.bus,
            eventPattern: {
                source: ['app.invoice'],
                detailType: ['invoice'],
                detail: {
                    errorDetail: ['FAIL_NO_INVOICE_NUMBER']
                }
            }
        })

        const invoicesErrorsFunction = new lambdaNodeJS.NodejsFunction(this, 'InvoicesErrorsFunction', {
                    functionName: 'InvoicesErrorsFunction',
                    entry: 'lambda/audit/invoicesErrorsFunction.ts',
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
                    tracing: lambda.Tracing.ACTIVE,
                    insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_119_0
        })

        nonValidInvoiceRule.addTarget(new targets.LambdaFunction(invoicesErrorsFunction))

        const timeoutImportInvoiceRule = new events.Rule(this, 'TimeoutImportInvoiceRule', {
            ruleName: 'TimeoutImportInvoiceRule',
            description: 'Rule matching timeout import invoice',
            eventBus: this.bus,
            eventPattern: {
                source: ['app.invoice'],
                detailType: ['invoice'],
                detail: {
                    errorDetail: ['TIMEOUT']
                }
            }
        })

        const invoiceImportTimeoutQueue = new sqs.Queue(this, 'InvoiceImportTimeout', {
            queueName: 'invoice-import-timeout'
        })

        timeoutImportInvoiceRule.addTarget(new targets.SqsQueue(invoiceImportTimeoutQueue))
    }
}