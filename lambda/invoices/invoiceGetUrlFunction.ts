import { Key } from "aws-cdk-lib/aws-kms";
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda";
import { ApiGatewayManagementApi, DynamoDB, S3 } from "aws-sdk";
import * as AWSXRay from 'aws-xray-sdk'
import { v4 as uuid } from 'uuid'
import { InvoiceTransactionStatus, InvoiceTransactionRepository } from "/opt/nodejs/invoiceTransaction";
import { InvoiceWSService } from "/opt/nodejs/invoiceWSConnection";

AWSXRay.captureAWS(require('aws-sdk'))

const invoicesDdb = process.env.INVOICE_DDB!
const bucketName = process.env.BUCKET_NAME!
const invoiceWsApiEndpoint = process.env.INVOICE_WSAPI_ENDPOINT!.substring(6)

const s3Client = new S3()
const ddbClient = new DynamoDB.DocumentClient()
const apigwManagementApi = new ApiGatewayManagementApi({
    endpoint: invoiceWsApiEndpoint
})

const invoiceTransactionRepository = new InvoiceTransactionRepository(ddbClient, invoicesDdb)
const invoiceWSService = new InvoiceWSService(apigwManagementApi)

export async function handler (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> {

    const lambdaRequestId = context.awsRequestId
    const connectionId = event.requestContext.connectionId!


    const key = uuid()
    const expires = 300
    const signedUrlPut = await s3Client.getSignedUrlPromise('putObject', {
        Bucket: bucketName,
        Key: key,
        Expires: expires
    })

    const timestamp = Date.now()
    const ttl = ~~(timestamp / 1000) + ( 60 * 2 )
    const invoice = {
        pk: '#transaction',
        sk: key,
        ttl: ttl,
        requestId: lambdaRequestId,
        transactionStatus: InvoiceTransactionStatus.GENERATED,
        timestamp: timestamp,
        expiresIn: expires,
        connectionId: connectionId,
        endpoint: invoiceWsApiEndpoint
    }
    
    await invoiceTransactionRepository.createInvoiceTransaction(invoice)
    const postData = JSON.stringify({
        url: signedUrlPut,
        expires: expires,
        transactionId: key
    })

    await invoiceWSService.sendData(connectionId, postData)
    return {
        statusCode: 200,
        body: 'OK'
    }
}