function LoadOrg_() {
    let orgs = Bot('get_organizations', { });
    let botCat = Bot('get_bot_categories', { });
    orgs?.forEach(x=>{
         let dbFile = ReadFile(`./db/db_${x?.id ?? 0}/user.db`);
        if (!dbFile) {
            Log('<<<<<<<<<<<<<<<<<<<<DB files not found>>>>>>>>>>>>>>>>>>>')
            Log('create readme file in db path...')
            CreateFile(`./db/db_${x?.id ?? 0}/`, `readme.txt`, `${x?.description}`);
            Log('copy db files...')
            System(`cp -a ./db/db/user* ./db/db/apa* ./db/db/bus* ./db/db/ord* ./db/db/fin* ./db/db_${x?.id ?? 0}/;`);
            Log('done.')
        }
        else
        {
            Log('<<<<<<<<<<<<<<<<<<<<DB files is ok>>>>>>>>>>>>>>>>>>>')
        }
        SetContext(`ORG_NAME_${x?.id??0}`,x?.description??'');
        SetContext(`ORG_EXPIRE_${x?.id??0}`,x?.expire_thru??'');

        let sms= Bot('get_organization_sms',{organization_id:x?.id ?? 0});
        if(sms)
        {
            SetContext(`SMS_Line_${x?.id ?? 0}`,sms?.line_no);
            SetContext(`SMS_KEY_${x?.id ?? 0}`,sms?.panel_key);
        }
        else
        {
            SetContext(`SMS_Line_${x?.id ?? 0}`,'');
            SetContext(`SMS_KEY_${x?.id?? 0}`,'');
        }
    });

    botCat?.forEach(cat=>{
        Log('Add Telegram Functions...');
        let botStates = Sqlite(0, 'bot.db', `SELECT * FROM bot_states_${cat?.id??0}_tab `);
        let home = botStates.find(x => x?.is_root === 1);
        if (!home) throw ('Root state not found')
        {
            let jsFile = ReadFile(`./js/bot_${cat?.id??0}/b_home.js`);
            if (!jsFile) {
                let content = `function B_${cat?.id??0}_Home(chatId,userId,request)
{           
            let parameters=chatId?.split('_');
            let orgId = Number(parameters?.[1]);
            if (GetContext(\`IS_TEST_BOT_\${orgId ?? 0}\`) === '1') {
                User(chatId, userId, orgId,'add_admin',{chat_id:chatId});
            }
            return B_${cat?.id??0}_${home?.id ?? 0}(chatId,userId,request);
}
`;
                CreateFile(`./js/bot_${cat?.id??0}/`, `b_home.js`, content);
            }
            Serv('add_function', { name: `B_${cat?.id??0}_Home`, file_name: `./js/bot_${cat?.id??0}/b_home.js` });
        }

        let preCallbackState={};
        let preInputState={};
        let stateRegexCheck = {};
        botStates.forEach((x, idx) => {
            let targetStates = x?.target_states_id?.split(';');    
            targetStates?.forEach(y=>{
                if(!preCallbackState?.[y]) preCallbackState[y]=[];
                preCallbackState[y].push(x?.id);
            })
            if(Number(x?.next_state_id)>0)
            {
                if(!preInputState?.[x?.next_state_id]) preInputState[x?.next_state_id]=[];
                preInputState[x?.next_state_id].push(x?.id);
            }
            stateRegexCheck[x?.id??0]={regex:x?.input_check_regex,error:x?.input_error};
        });
        botStates.forEach((x, idx) => {
            if (x?.is_root == 1) {
                Log(`Set:B_${cat?.id??0}_Home`)
                SetContext(`B_${cat?.id??0}_Home`, JSON.stringify({
                    next: x?.next_state_id ?? 0, text: x?.caption, keyboard: [...(x?.target_states_id?.split(';')?.filter(x => !!x)?.map(x => { if (x === 'x') return []; let state = botStates.find(y => y?.id === Number(x)); return [{ text: state?.button_caption ?? 'unknown', callback_data: `${state?.id ?? 0}` }] }) ?? []),
                    ...(x?.return_target_states_id?.split(';')?.filter(x => !!x)?.map(x => { if (x === 'x') return []; let state = botStates.find(y => y?.id === Number(x)); return [{ text: state?.return_button_caption ?? 'unknown', callback_data: `${state?.id ?? 0}` }] }) ?? [])]
                }));
            }
            Log(`Set:B_${cat?.id??0}_${x?.id ?? 0}`)
            SetContext(`B_${cat?.id??0}_${x?.id ?? 0}`, JSON.stringify({
                next: x?.next_state_id ?? 0, text: x?.caption, keyboard: [...(x?.target_states_id?.split(';')?.filter(x => !!x)?.map(x => { if (x === 'x') return []; let state = botStates.find(y => y?.id === Number(x)); return [{ text: state?.button_caption ?? 'unknown', callback_data: `${state?.id ?? 0}` }] }) ?? []),
                ...(x?.return_target_states_id?.split(';')?.filter(x => !!x)?.map(x => { if (x === 'x') return []; let state = botStates.find(y => y?.id === Number(x)); return [{ text: state?.return_button_caption ?? 'unknown', callback_data: `${state?.id ?? 0}` }] }) ?? [])]
            }));

            let jsFile = ReadFile(`./js/bot_${cat?.id??0}/b_${x?.id ?? 0}.js`);
            if (!jsFile) {
                let firstConditionFlg=true;
                let content = `function B_${cat?.id??0}_${x?.id ?? 0}(chatId,userId,request)
{
    try{
        Log('B_${cat?.id??0}_${x?.id}');
        let parameters=chatId?.split('_');
        let orgId = Number(parameters?.[1]);
        if(!User(chatId, userId, orgId,'check_user_permission',{id:userId,org_id:parameters?.[1],state:${x?.id}})) throw('🚫 شما دسترسی لازم برای انجام این عملیات را ندارید.');
        if(IsSqlInjection(request?.req?.message?.text)) throw('🚫 عملیات غیر مجاز');
        let lastState = Number(request?.state?.[0]);
        let input=Pr2En(request?.req?.message?.text);
        let callback = request?.callback;
        let keyboard=[];
        let text=null;
        let messages=[];
        let userContext = User(chatId, userId, orgId,'get_context', { id: userId });
        //if(!userContext?.is_admin) return B_${cat?.id??0}_Home(chatId, userId, request);
        let customerId = userContext?.customer_id ?? 0;
        if (!customerId) {
            let customerInfo = User(chatId, userId, orgId, 'get_my_customer_info', {});
            if (!customerInfo) throw ('🚫 شما دسترسی لازم برای انجام این عملیات را ندارید.');
            User(chatId, userId, orgId, 'set_context', { id: userId, context: { customer_id:customerInfo?.id??0 } });
            customerId = customerInfo?.id;
        }

        ${preCallbackState?.[x?.id]?.map((x,idx)=>{
            firstConditionFlg=false;
            return `${idx!==0?'else ':''}if(lastState===${x} && callback?.[0])
            {
                
            }`;
        })?.join('\n')??''}
        ${preInputState?.[x?.id]?.map((x,idx)=>{
            return `${(idx!==0 || !firstConditionFlg)?'else ':''}if(lastState===${x} && !callback?.[0] && input)
            {
                ${stateRegexCheck[x]?.regex?.length>0?`if(!(/${stateRegexCheck[x]?.regex}/)?.test(input)) throw('${stateRegexCheck[x]?.error?.length>0?stateRegexCheck[x]?.error:'⚠️ ورودی صحیح نمیباشد'}');`:''}
            }`;
        })?.join('\n')??''}

        ${x?.auto_state_id > 0 ? `return B_${cat?.id??0}_${x?.auto_state_id}(chatId,userId,request);` : `
        messages.push({
                text,
                keyboard
            });
        return {state:${x?.id ?? 0},messages}
        `}
        }
    catch(e)
    {
        return {state:request?.state?.[0]??${x?.id ?? 0},error:e,
            messages:[{
                    text:undefined,
                    keyboard:[]
                }]}
    }
}
`;

                CreateFile(`./js/bot_${cat?.id??0}/`, `b_${x?.id ?? 0}.js`, content);
            }
            Serv('add_function', { name: `B_${cat?.id??0}_${x?.id ?? 0}`, file_name: `./js/bot_${cat?.id??0}/b_${x?.id ?? 0}.js`, refresh: (botStates.length === (idx + 1)) });
        });
        let jsWebhookFile = ReadFile(`./js/bot_${cat?.id??0}/webhook.js`);
        if (!jsWebhookFile) {
            let webhookTmp = ReadFile(`./template/webhook.tmp`);
            webhookTmp = webhookTmp?.replaceAll('##CAT_ID##',`${cat?.id??0}`);
            CreateFile(`./js/bot_${cat?.id??0}/`, `webhook.js`, webhookTmp);
        }
        SetQueueConsumer(JSON.stringify({ key: `BOT_REQUEST_${cat?.id??0}`, name: `T_${cat?.id??0}_Webhook`, file_name: `./js/bot_${cat?.id??0}/webhook.js` }));
        

    });

    
    let schedulerId=Number(GetContext(`SCHEDULER_ID_60`));
    if(schedulerId>0)
    {
        Serv('remove_scheduler', {id:schedulerId});
        Sleep(2000);        
    }
    schedulerId = Serv('set_scheduler', {interval:60000, timeout:60000, file_name: `./js/routes/scheduler.js` });
    SetContext(`SCHEDULER_ID_60`,`${schedulerId}`);

}