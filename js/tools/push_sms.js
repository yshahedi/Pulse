function PushSMS(orgId,objectId,trigerDate, receptor,templateId, parameters) {
    Log('Push SMS...')
    let checkLimit = User('_',1,orgId,'increase_sms_template_counter',{id:templateId, object_id:objectId});
     Log('checkLimit...')
    if(!checkLimit) {
        Log('Your SMS sending limit has been reached. ');
        return false;
    }
    Log('Get Template...')
    let templateInfo = User('_',1,orgId,'get_sms_template',{id:templateId,object_id:objectId})?.[0];
    Log(JSON.stringify(templateInfo))
    if(templateInfo)
    {
        Log('Push SMS Queue...')
        Bot('push_sms_queue',{org_id:orgId,date:trigerDate,template_no:templateInfo?.template_no??'',text:templateInfo?.template_text??'',parameters,receptor});
    }
    return true;
}