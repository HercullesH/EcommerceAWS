import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda";
import { Product, ProductRepository } from "/opt/nodejs/productsLayer";
import { DynamoDB } from 'aws-sdk'
import * as AWSXRay from 'aws-xray-sdk'

AWSXRay.captureAWS(require('aws-sdk'))

const productsDdb = process.env.PRODUCTS_DDB!
const ddbClient = new DynamoDB.DocumentClient()

const productRepository = new ProductRepository(ddbClient, productsDdb)

export async function handler(event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> {

    const method = event.httpMethod
    
    const lambdaRequestId = context.awsRequestId
    const apiRequestId = event.requestContext.requestId;

    console.log(` API Gateway RequestId: ${apiRequestId} - Lambda RequestId: ${lambdaRequestId}`)

    if (event.resource === '/products') {
        console.log('POST /products')

        const product = JSON.parse(event.body!) as Product
        const productCreated = await productRepository.create(product)

        return {
            statusCode: 201,
            body: JSON.stringify(productCreated)
        }
    } else if (event.resource === '/products/{id}') {
        const productId = event.pathParameters!.id as string;
        if (event.httpMethod === 'PUT') {
            try {
                console.log('PUT /products/' + productId)
                const product = JSON.parse(event.body!) as Product
                const productUpdated = await productRepository.updateProduct(productId, product)

                return {
                    statusCode: 200,
                    body: JSON.stringify(productUpdated)
                }
            } catch (ConditionalCheckFailedException) {
                return {
                    statusCode: 404,
                    body: 'Product Not Found'
                }
            }
            
        } else if (event.httpMethod === 'DELETE') {
            try {
                const product = await productRepository.deleteProduct(productId)
                return {
                    statusCode: 200,
                    body: JSON.stringify(product)
                }
            } catch (error) {
                console.error((<Error> error).message)
                return {
                    statusCode: 404,
                    body: JSON.stringify((<Error> error).message)
                }
            }
        }
    }

    return {
        statusCode: 400,
        body: 'Bad Request'
    }
}