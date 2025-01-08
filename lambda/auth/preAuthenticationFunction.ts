import { Callback, Context, PreAuthenticationTriggerEvent } from "aws-lambda";

export async function handler(event: PreAuthenticationTriggerEvent, context: Context, callback: Callback): Promise<void> {
    
    console.log(event)

    // if (event.request.userAttributes.email === 'herculles.hendriuss@gmail.com') {
    //     callback('this user is blocked. Reason: Payment', event)
    // } else {
    //     callback(null, event)
    // }
    callback(null, event)
}