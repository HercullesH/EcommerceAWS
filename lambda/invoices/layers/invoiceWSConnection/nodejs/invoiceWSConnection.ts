import { ApiGatewayManagementApi } from "aws-sdk";

export class InvoiceWSService {
    private apigwManagementApi: ApiGatewayManagementApi

    constructor(apigwManagementApi: ApiGatewayManagementApi) {
        this.apigwManagementApi = apigwManagementApi
    }

    async sendData(connectionId: string, data: string): Promise<boolean> {
        try {

            console.log('verificando se chegou antes de dar get connection: ', data)
            
            await this.apigwManagementApi.getConnection({
                ConnectionId: connectionId
            }).promise()

            console.log('indo enviar a mensagem', {
                ConnectionId: connectionId,
                Data: data
            })

            await this.apigwManagementApi.postToConnection({
                ConnectionId: connectionId,
                Data: data
            })
            console.log('enviou')
            return true
        } catch (error) {
            console.error(error)
            return false
        }
        
    }
}