import { ApiGatewayManagementApi } from "aws-sdk";

export class InvoiceWSService {
    private apigwManagementApi: ApiGatewayManagementApi

    constructor(apigwManagementApi: ApiGatewayManagementApi) {
        this.apigwManagementApi = apigwManagementApi
    }

    async sendData(connectionId: string, data: string): Promise<boolean> {
        try {
            await this.apigwManagementApi.getConnection({
                ConnectionId: connectionId
            }).promise()

            await this.apigwManagementApi.postToConnection({
                ConnectionId: connectionId,
                Data: data
            })
            return true
        } catch (error) {
            console.error(error)
            return false
        }
        
    }
}