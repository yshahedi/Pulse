function LoadBot_(bot) {
    let botOrgs = Bot('get_bot_organizations', { bot_id: bot.id });

    let botServerId = Number(GetContext(`BOT_SERVER_${bot?.id}`));
    Log(`botServerId:${botServerId}`);
    let orgsId = [];
    let oldBots = [];
    let oldBotsStr = GetContext('OLD_BOTS');
    if (oldBotsStr?.length > 0) oldBots = JSON.parse(oldBotsStr);
    botOrgs.forEach(org => {
        if (org?.bot_category_id === 2) orgsId.push(org?.organization_id ?? 0);
        if (org?.is_test_bot) SetContext(`IS_TEST_BOT_${org?.organization_id ?? 0}`, '1');
        else SetContext(`IS_TEST_BOT_${org?.organization_id ?? 0}`, '0');

        if (bot.is_telegram) {

            let ServiceId = Number(GetContext(`TELEGRAM_SERVICE`));
            SetContext(`TELEGRAM_TOKEN_${org?.organization_id ?? 0}_${org?.id ?? 0}`, `${org?.token ?? ''}`);
            if (!oldBots.includes(`t/${org?.bot_category_id ?? 0}/${org?.organization_id ?? 0}/${org?.id}`)) {
                if (bot.is_webhook) {
                    Serv('route', { route: `telegram_webhook/${org?.bot_category_id ?? 0}/${org?.organization_id ?? 0}/${org?.id}`, server: botServerId, file_name: `./js/routes/telegram_webhook.js` });
                    Log('Set Webhook...');
                    let webhook = CallService(JSON.stringify({ id: ServiceId, path: `bot${org?.token}/setWebhook`, request: JSON.stringify({ secret_token: '0063382407', url: `${bot?.webhook_address?.replace(/\/?$/, "/")}telegram_webhook/${org?.bot_category_id ?? 0}/${org?.organization_id ?? 0}/${org?.id}` }), headers: [] }));
                    Log(webhook);
                    if (!JSON.parse(webhook)?.ok) Log('Error:Can not to set bale webhook address!');
                    else oldBots.push(`t/${org?.bot_category_id ?? 0}/${org?.organization_id ?? 0}/${org?.id}`);
                }
                else {
                    Log('Set GetUpdates Scheduler...');
                    Serv('set_scheduler', { interval: 10000, timeout: 60000, file_name: `./js/routes/bot_updates.js` });
                }
            }
        }
        else {
            let ServiceId = Number(GetContext(`BALE_SERVICE`));
            SetContext(`BALE_TOKEN_${org?.organization_id ?? 0}_${org?.id ?? 0}`, `${org?.token ?? ''}`);
            if (!oldBots.includes(`b/${org?.bot_category_id ?? 0}/${org?.organization_id ?? 0}/${org?.id}`)) {
                if (bot.is_webhook) {
                    Serv('route', { route: `bale_webhook/${org?.bot_category_id ?? 0}/${org?.organization_id ?? 0}/${org?.id}`, server: botServerId, file_name: `./js/routes/bale_webhook.js` });
                    Log('Set Webhook...');
                    try {
                        let webhook = CallService(JSON.stringify({ id: ServiceId, path: `bot${org?.token}/setWebhook`, request: JSON.stringify({ url: `${bot?.webhook_address?.replace(/\/?$/, "/")}bale_webhook/${org?.bot_category_id ?? 0}/${org?.organization_id ?? 0}/${org?.id}` }), headers: [] }));
                        Log(webhook);
                        if (!JSON.parse(webhook)?.ok) Log('Error:Can not to set bale webhook address!');
                        else oldBots.push(`b/${org?.bot_category_id ?? 0}/${org?.organization_id ?? 0}/${org?.id}`);
                    }
                    catch (e) {
                        Log(`Webhook Error:${e}`);
                    }
                }
                else {
                    Log('Set GetUpdates Scheduler...');
                    Serv('set_scheduler', { interval: 10000, timeout: 60000, file_name: `./js/routes/bot_updates.js` });
                }
            }
        }
    });

    SetContext('OLD_BOTS', JSON.stringify(oldBots));
    SetContext('ORGANIZATIONS', JSON.stringify(orgsId));

}