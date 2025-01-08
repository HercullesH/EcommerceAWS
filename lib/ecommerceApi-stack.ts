import * as lambdaNodeJS from "aws-cdk-lib/aws-lambda-nodejs"
import * as cdk from "aws-cdk-lib"
import * as apigateway from "aws-cdk-lib/aws-apigateway"
import * as cwlogs from "aws-cdk-lib/aws-logs"
import { Construct } from "constructs"
import * as cognito from 'aws-cdk-lib/aws-cognito'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as iam from 'aws-cdk-lib/aws-iam'
interface ECommerceApiStackProps extends cdk.StackProps {
    productsFetchHandler: lambdaNodeJS.NodejsFunction;
    productsAdminHandler: lambdaNodeJS.NodejsFunction;
    ordersHandler: lambdaNodeJS.NodejsFunction;
    orderEventsFetchHandler: lambdaNodeJS.NodejsFunction;
}

export class EcommerceApiStack extends cdk.Stack {
    private productsAuthorizer: apigateway.CognitoUserPoolsAuthorizer
    // private productsAdminAuthorizer: apigateway.CognitoUserPoolsAuthorizer
    private customerPool: cognito.UserPool
    private adminPool: cognito.UserPool

    constructor(scope: Construct, id: string, props: ECommerceApiStackProps){
        super(scope, id , props)

        const logGroup = new cwlogs.LogGroup(this, 'EcommerceApiLogs')
        const api = new apigateway.RestApi(this, 'ECommerceApi', {
            restApiName: 'ECommerceApi',
            cloudWatchRole: true,
            deployOptions: {
                accessLogDestination: new apigateway.LogGroupLogDestination(logGroup),
                accessLogFormat: apigateway.AccessLogFormat.jsonWithStandardFields({
                    httpMethod: true,
                    ip: true,
                    protocol: true,
                    requestTime: true,
                    resourcePath: true,
                    responseLength: true,
                    status: true,
                    caller: true,
                    user: true
                })
            }
        })

        this.createCognitoAuth()

        const adminUserPolicyStatement = new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['cognito-idp:AdminGetUser'],
            resources: [this.adminPool.userPoolArn, this.customerPool.userPoolArn]
        })

        const adminUserPolicy = new iam.Policy(this, 'AdminGetUserPolicy', {
            statements: [adminUserPolicyStatement]
        })

        adminUserPolicy.attachToRole(<iam.Role> props.productsAdminHandler.role)
        this.createProductsService(props, api)
        this.createOrdersService(props, api)
    }

    private createCognitoAuth() {
        const postConfirmationHandler = new lambdaNodeJS.NodejsFunction(this, 'PostConfirmationFunction', {
                    functionName: 'PostConfirmationFunction',
                    entry: 'lambda/auth/postConfirmationFunction.ts',
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

        const preAuthenticationHandler = new lambdaNodeJS.NodejsFunction(this, 'PreAuthenticationFunction', {
            functionName: 'PreAuthenticationFunction',
            entry: 'lambda/auth/preAuthenticationFunction.ts',
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

        this.customerPool = new cognito.UserPool(this, 'CustomerPool', {
            lambdaTriggers: {
                preAuthentication: preAuthenticationHandler,
                postConfirmation: postConfirmationHandler
            },
            userPoolName: 'CustomerPool',
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            selfSignUpEnabled: true,
            autoVerify: {
                email: true,
                phone: false
            },
            userVerification: {
                emailSubject: 'Verify your email for the Ecommerce service!',
                emailBody: 'Thanks for signing up to Ecommerce service! your verification code is {####}',
                emailStyle: cognito.VerificationEmailStyle.CODE
            },
            signInAliases: {
                username: false,
                email: true
            },
            standardAttributes: {
                fullname: {
                    required: true,
                    mutable: false
                }
            },
            passwordPolicy: {
                minLength: 8,
                requireLowercase: true,
                requireUppercase: true,
                requireDigits: true,
                requireSymbols: true,
                tempPasswordValidity: cdk.Duration.days(3)
            },
            accountRecovery: cognito.AccountRecovery.EMAIL_ONLY
        })

        this.adminPool = new cognito.UserPool(this, 'AdminPool', {
            userPoolName: 'AdminPool',
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            selfSignUpEnabled: false,
            userInvitation: {
                emailSubject: 'Welcome to ECommerce administrator service',
                emailBody: 'Your username is ${username} and temporary password is {####}'
            },
            signInAliases: {
                username: false,
                email: true
            },
            standardAttributes: {
                email: {
                    required: true,
                    mutable: false
                }
            },
            passwordPolicy: {
                minLength: 8,
                requireLowercase: true,
                requireUppercase: true,
                requireDigits: true,
                requireSymbols: true,
                tempPasswordValidity: cdk.Duration.days(3)
            },
            accountRecovery: cognito.AccountRecovery.EMAIL_ONLY
        })

        this.customerPool.addDomain('CustomerDomain', {
            cognitoDomain: {
                domainPrefix: 'hhcms-customer-service'
            }
        })

        this.adminPool.addDomain('AdminDomain', {
            cognitoDomain: {
                domainPrefix: 'hhcms-admin-service'
            }
        })

        const adminWebScope = new cognito.ResourceServerScope({
            scopeName: 'web',
            scopeDescription: 'Admin web operation'
        })

        const customerWebScope = new cognito.ResourceServerScope({
            scopeName: 'web',
            scopeDescription: 'Customer web operation'
        })

        const customerMobileScope = new cognito.ResourceServerScope({
            scopeName: 'mobile',
            scopeDescription: 'Customer mobile operation'
        })

        const customerResourceServer = this.customerPool.addResourceServer('CustomerResourceServer', {
            identifier: 'customer',
            userPoolResourceServerName: 'CustomerResourceServer',
            scopes: [customerWebScope, customerMobileScope]
        })

        const adminResourceServer = this.adminPool.addResourceServer('AdminResourceServer', {
            identifier: 'admin',
            userPoolResourceServerName: 'AdminResourceServer',
            scopes: [adminWebScope]
        })

        this.customerPool.addClient('customer-web-client', {
            userPoolClientName: 'customerWebClient',
            authFlows: {
                userPassword: true
            },
            accessTokenValidity: cdk.Duration.minutes(60),
            refreshTokenValidity: cdk.Duration.days(7),
            oAuth: {
                scopes: [cognito.OAuthScope.resourceServer(customerResourceServer, customerWebScope)]
            }
        })

        this.customerPool.addClient('customer-mobile-client', {
            userPoolClientName: 'customerMobileClient',
            authFlows: {
                userPassword: true
            },
            accessTokenValidity: cdk.Duration.minutes(60),
            refreshTokenValidity: cdk.Duration.days(7),
            oAuth: {
                scopes: [cognito.OAuthScope.resourceServer(customerResourceServer, customerMobileScope)]
            }
        })

        this.adminPool.addClient('admin-web-client', {
            userPoolClientName: 'adminWebClient',
            authFlows: {
                userPassword: true
            },
            accessTokenValidity: cdk.Duration.minutes(60),
            refreshTokenValidity: cdk.Duration.days(7),
            oAuth: {
                scopes: [cognito.OAuthScope.resourceServer(adminResourceServer, adminWebScope)]
            }
        })

        this.productsAuthorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'ProductsAuthorizer', {
            authorizerName: 'ProductsAuthorizer',
            cognitoUserPools: [this.customerPool, this.adminPool]
        })

        // this.productsAdminAuthorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'ProductsAdminAuthorizer', {
        //     authorizerName: 'ProductsAdminAuthorizer',
        //     cognitoUserPools: [this.adminPool]
        // })
    }

    private createOrdersService(props: ECommerceApiStackProps, api: apigateway.RestApi) {
        const ordersIntegration = new apigateway.LambdaIntegration(props.ordersHandler)

        const orderDeletionValidator = new apigateway.RequestValidator(this, 'OrderDeletionValidator', {
            restApi: api,
            requestValidatorName: 'OrderDeletionValidator',
            validateRequestParameters: true,
        })

        const ordersResource = api.root.addResource('orders')
        ordersResource.addMethod('GET', ordersIntegration)
        ordersResource.addMethod('DELETE', ordersIntegration, {
            requestParameters: {
                'method.request.querystring.email': true,
                'method.request.querystring.orderId': true,
            },
            requestValidator: orderDeletionValidator
        })

        const orderRequestValidator = new apigateway.RequestValidator(this, 'OrderRequestValidator', {
            restApi: api,
            requestValidatorName: 'Order request validator',
            validateRequestBody: true
        })

        const orderModel = new apigateway.Model(this, 'OrderModel', {
            modelName: 'OrderModel',
            restApi: api,
            schema: {
                type: apigateway.JsonSchemaType.OBJECT,
                properties: {
                    email: {
                        type: apigateway
                        .JsonSchemaType.STRING
                    },
                    productIds: {
                        type: apigateway.JsonSchemaType.ARRAY,
                        minItems: 1,
                        items: {
                            type: apigateway.JsonSchemaType.STRING
                        }
                    },
                    payment: {
                        type: apigateway.JsonSchemaType.STRING,
                        enum: ['CASH', 'DEBIT_CARD', 'CREDIT_CARD']
                    }
                },
                required: ['email', 'productIds', 'payment']
            }
        })
        ordersResource.addMethod('POST', ordersIntegration, {
            requestValidator: orderRequestValidator,
            requestModels: {
                'application/json': orderModel
            }
        })

        const orderEventsResource = ordersResource.addResource('events')

        const orderEventsFetchValidator = new apigateway.RequestValidator(this, 'OrderEventsFetchValidator', {
            restApi: api,
            requestValidatorName: 'OrderEventsFetchValidator',
            validateRequestParameters: true
        })
        
        const orderEventsFunctionIntegration = new apigateway.LambdaIntegration(props.orderEventsFetchHandler)
        orderEventsResource.addMethod('GET', orderEventsFunctionIntegration, {
            requestParameters: {
                'method.request.querystring.email': true,
                'method.request.querystring.eventType': false,
            },
            requestValidator: orderEventsFetchValidator
        })
    }

    private createProductsService(props: ECommerceApiStackProps, api: apigateway.RestApi) {
        const productsFetchIntegration  = new apigateway.LambdaIntegration(props.productsFetchHandler)

        const productsFetchWebMobileIntegrationOption: cdk.aws_apigateway.MethodOptions = {
            authorizer: this.productsAuthorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
            authorizationScopes: ['customer/web', 'customer/mobile', 'admin/web']
        }

        const productsFetchWebIntegrationOption: cdk.aws_apigateway.MethodOptions = {
            authorizer: this.productsAuthorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
            authorizationScopes: ['customer/web' , 'admin/web']
        }

        const productsResource = api.root.addResource('products')
        productsResource.addMethod('GET', productsFetchIntegration, productsFetchWebMobileIntegrationOption)

        const productIdResource = productsResource.addResource('{id}')
        productIdResource.addMethod('GET', productsFetchIntegration, productsFetchWebIntegrationOption)

        const productsAdminIntegration = new apigateway.LambdaIntegration(props.productsAdminHandler)

        productsResource.addMethod('POST', productsAdminIntegration, productsFetchWebMobileIntegrationOption)

        productIdResource.addMethod('PUT', productsAdminIntegration, productsFetchWebMobileIntegrationOption)

        productIdResource.addMethod('DELETE', productsAdminIntegration, productsFetchWebMobileIntegrationOption)
    }
}