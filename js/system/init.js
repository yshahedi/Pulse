function Init_() {
    Log('Init...');

    // SetContext("CLAUDE_API_KEY", `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`);

    let consumerId = Serv('server', { port: 4001, is_ssl: false, certificate: '', private_key: '' });
    Serv('route', { route: `api`, server: consumerId, file_name: `./js/routes/api.js`, timeout: (1000 * 60) });
    Serv('route', { route: `reload`, server: consumerId, file_name: `./js/routes/reload.js`, timeout: (1000 * 60) });

    Authorizer('create_data_model', {});
    Base('create_data_model', {});
    UserInterface('create_data_model', {});

    // Seed default admin user and roles (idempotent — safe to run on every start)
    Base('seed_admin', {});
    Authorizer('seed_admin', {});

    // Start the worker-telemetry WebSocket server (no-op if Pulse was built
    // without -DPULSE_METRICS). Pushes a metrics snapshot to dashboards @500ms.
    Serv('start_metrics', { port: 4002 });

    /* let PostServiceId = Serv('service', {
         url: 'https://api.v0.dev/v1/', method: 1, timeout: (1000 * 60 * 10)
     });
     let GetServiceId = Serv('service', {
         url: 'https://api.v0.dev/v1/', method: 2, timeout: (1000 * 60 * 10)
     });
 
     let PutServiceId = Serv('service', {
         url: 'https://api.v0.dev/v1/', method: 3, timeout: (1000 * 60 * 10)
     });
 
     let DelServiceId = Serv('service', {
         url: 'https://api.v0.dev/v1/', method: 4, timeout: (1000 * 60 * 10)
     });
 
     let PatchServiceId = Serv('service', {
         url: 'https://api.v0.dev/v1/', method: 5, timeout: (1000 * 60 * 10)
     });
 
     let PostServiceClaudeId = Serv('service', {
         url: 'https://api.anthropic.com/v1/', method: 1, timeout: (1000 * 60 * 10)
     });
 
     let GetServiceClaudeId = Serv('service', {
         url: 'https://api.anthropic.com/v1/', method: 2, timeout: (1000 * 60 * 10)
     });
 
     let PutServiceClaudeId = Serv('service', {
         url: 'https://api.anthropic.com/v1/', method: 3, timeout: (1000 * 60 * 10)
     });
 
     let DelServiceClaudeId = Serv('service', {
         url: 'https://api.anthropic.com/v1/', method: 4, timeout: (1000 * 60 * 10)
     });
 
     let PatchServiceClaudeId = Serv('service', {
         url: 'https://api.anthropic.com/v1/', method: 5, timeout: (1000 * 60 * 10)
     });
 
     SetContext(`V0_POST_SERVICE`, `${PostServiceId}`);
     SetContext(`V0_GET_SERVICE`, `${GetServiceId}`);
     SetContext(`V0_PUT_SERVICE`, `${PutServiceId}`);
     SetContext(`V0_DEL_SERVICE`, `${DelServiceId}`);
     SetContext(`V0_PATCH_SERVICE`, `${PatchServiceId}`);
 
     SetContext(`CLAUDE_POST_SERVICE`, `${PostServiceClaudeId}`);
     SetContext(`CLAUDE_GET_SERVICE`, `${GetServiceClaudeId}`);
     SetContext(`CLAUDE_PUT_SERVICE`, `${PutServiceClaudeId}`);
     SetContext(`CLAUDE_DEL_SERVICE`, `${DelServiceClaudeId}`);
     SetContext(`CLAUDE_PATCH_SERVICE`, `${PatchServiceClaudeId}`);

    let fielList = Ls('./js/generator');
    fielList?.split(';')?.forEach(file_name => {
        const name = file_name.split("/").pop()?.split(".")?.[0];
        Log(`Reloading ${name} function from : ${file_name}`);
        Serv('add_function', { name, file_name });

    })*/





    /* let bots = Bot('get_bots', {});
     bots.forEach(bot => {
         let botServerId = Serv('server', { port: bot?.port ?? 443, is_ssl: true, certificate: bot?.certificate ?? '', private_key: bot?.private_key ?? '' });
         let ServiceId = Serv('service', { url: bot?.server ?? 'https://api.telegram.org/', method: 1, timeout: 30000 });
         SetContext(`BOT_SERVER_${bot?.id}`, `${botServerId}`);
         if (bot.is_telegram) {
             SetContext(`TELEGRAM_SERVICE`, `${ServiceId}`);
         }
         else {
             SetContext(`BALE_SERVICE`, `${ServiceId}`);
         }
         LoadOrg_();
         LoadBot_(bot);
         Serv('route', { route: 'reload', server: botServerId, file_name: `./js/routes/reload.js` });
         Serv('route', { route: 'db', server: botServerId, file_name: `./js/routes/db.js` });
         Serv('route', { route: 'test', server: botServerId, source: `response="OK";` });
 
 
     });
 
 
     let TalaWebServiceId = Serv('service', { url: 'https://www.tala.ir/webservice/price_live.php', method: 2, timeout: 5000 });
     SetContext(`TALA_IR_SERVER_ID`, `${TalaWebServiceId}`);
     let TgjuWebServiceId = Serv('service', { url: 'https://www.tgju.org/profile/', method: 2, timeout: 5000 });
     SetContext(`TGJU_ORG_SERVER_ID`, `${TgjuWebServiceId}`);
 
     let SmsServiceId = Serv('service', { url: 'https://api.sms.ir/v1', method: 1, timeout: 5000 });
     SetContext("SMS_SERVICE", `${SmsServiceId}`);
 
     let tempServerId = Serv('server', { port: 3000, is_ssl: false });
     let iranServiceId = Serv('service', { url: 'https://pulsemind.ir:88/db', method: 1, timeout: 20000 });
     let ptServiceId = Serv('service', { url: 'https://servomind.ir:88/db', method: 1, timeout: 20000 });
     SetContext(`PULSE_SERVER_ID`, `${iranServiceId}`);
     SetContext(`SERVO_SERVER_ID`, `${ptServiceId}`);
     Serv('route', { route: 'telegram', server: tempServerId, file_name: `./js/routes/update_telegram.js` });*/









}