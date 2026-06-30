function Sms(orgId, receptor,templateId,templateText, parameters) {

    let id = Number(GetContext("SMS_SERVICE"));
    let sender = (GetContext(`SMS_Line_${orgId}`));
    let key = (GetContext(`SMS_KEY_${orgId}`));
    Log(sender);

    if (sender?.length > 0 && key?.length > 0) {
        if(templateId>0)
        {
            let path = `/send/verify`;
            let data = {
                mobile:receptor,
                templateId,
                parameters
            };
            Log(JSON.stringify({id, path, request: JSON.stringify(data)}));
            let resp = CallService(JSON.stringify({
                id, path, request: JSON.stringify(data), headers: [
                    {
                        key: 'Content-Type',
                        value: 'application/json'
                    },
                    {
                        key: 'Accept',
                        value: 'text/plain'
                    },
                    {
                        key:'x-api-key',
                        value:key
                    }
                ]
            }));
            Log(resp);
        }
        else if(templateText)
        {
            let t = templateText;
            Object.keys(parameters).forEach(x=>{
                t=t?.replaceAll(`##${x.toUpperCase()}##`,parameters[x]);
            });
            //SEND MESSAGE
            Log(t);
        }
    }
}