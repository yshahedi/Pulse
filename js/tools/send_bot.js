function SendBot(method, data, content_type = 'application/json', mime = false) {
    let id = 0;
    let token = '';
    // Log(`Send chatID:${data?.chat_id}`);
    let params = data?.chat_id?.split('_');
    let mimeData = data?.mime;
    if (!params?.[1] || !params?.[3]) throw ('Wrong chat id!');
    if (params?.[0] === 't') {
        id = Number(GetContext("TELEGRAM_SERVICE"));
        token = GetContext(`TELEGRAM_TOKEN_${params?.[1]}_${params?.[2]}`);
    }
    else if (params?.[0] === 'b') {
        id = Number(GetContext("BALE_SERVICE"));
        token = GetContext(`BALE_TOKEN_${params?.[1]}_${params?.[2]}`);
    }
    else {
        throw ('Wrong chat id!');
    }
    if (!mime) {
        data.chat_id = params?.[3];
    }
    else {
        mimeData.push({ name: 'chat_id', data: params?.[3] });
        if (data?.reply_markup) mimeData.push({ name: 'reply_markup', data: JSON.stringify(data?.reply_markup) })
        data = mimeData;
    }


    Log(JSON.stringify(data));
    let resp = "";
    try {

        resp = CallService(JSON.stringify({ id, path: `bot${token}/${method}`, request: JSON.stringify(data), headers: [], mime }));
        Log(resp);
        return JSON.parse(resp);
    }
    catch (e) {
        Log(`ERROR to call Service...`);
        Log(JSON.stringify(data));
        Log(`Response...`);
        Log(resp);
        throw e;
    }
}