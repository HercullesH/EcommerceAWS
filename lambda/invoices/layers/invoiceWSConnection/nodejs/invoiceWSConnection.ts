import { ApiGatewayManagementApi } from "aws-sdk";

export class InvoiceWSService {
    private apigwManagementApi: ApiGatewayManagementApi

    constructor(apigwManagementApi: ApiGatewayManagementApi) {
        this.apigwManagementApi = apigwManagementApi
    }

    async sendData(connectionId: string, data: string): Promise<boolean> {
        await this.apigwManagementApi.getConnection({
            ConnectionId: connectionId
        }).promise()

        await this.apigwManagementApi.postToConnection({
            ConnectionId: connectionId,
            Data: data
        }).promise()
        
        return true
        
    }
}