Log('Scheduler');
response = 'OK';
//Log(JSON.stringify({ request, url, request_headers }));
try {
    let orgIdsStr = GetContext('ORGANIZATIONS');
    let orgIds = JSON.parse(orgIdsStr);
    orgIds?.forEach(orgId => {
        let currentPeriod = Financial(orgId, 1, 'get_current_period', {})?.id;
        if (!currentPeriod) throw ('دوره مالی یافت نشد!');
        let availableCharges = Apartment(orgId, 1, 'get_transaction', { period_id: currentPeriod ?? 0, type_id: 3 });
        let units = Apartment(orgId, 1, 'get_building_units', {});
        let ac = availableCharges?.map(x => (JSON.parse(x?.data ?? '{}')));
        units?.forEach(unit => {
            if (!ac.find(x => (x.unit_id === unit?.id && x.charge_type === 'P'))) {
                let proprietaryChargeAmount = 0;
                if (unit?.is_vacant === 1)
                    proprietaryChargeAmount = unit?.vacant_proprietary_charge;
                else
                    proprietaryChargeAmount = unit?.proprietary_charge;

                if (proprietaryChargeAmount > 0) {
                    let description = `تحقق شارژ مالکانه واحد ${(unit?.unit_number)} طبقه ${PrNumber(unit?.floor_number)} (${(unit?.owner_name ?? '-')})`;
                    let autoDescription = description;
                    let transId = Apartment(orgId, 1, 'new_transaction', { description, auto_description: autoDescription, amount: proprietaryChargeAmount, document_no: '', has_attachment: false, type_id: 3, building_id: unit?.building_id_fk ?? 0, data: { unit_id: unit?.id ?? 0, charge_type: 'P' } });
                    IssueVoucher(orgId, { user_id: 1, description, data: { building_id: unit?.building_id_fk ?? 0, amount: proprietaryChargeAmount, unit_id: unit?.id ?? 0, charge_type: 'P' }, business_event_id: 1, transaction_id: transId });
                    Apartment(orgId, 1, 'approve_transaction', { id: transId });
                }
            }
            if (!ac.find(x => (x.unit_id === unit?.id && x.charge_type === 'C'))) {
                let currentChargeAmount = 0
                if (unit?.is_vacant === 1)
                    currentChargeAmount = unit?.vacant_running_charge;
                else
                    currentChargeAmount = unit?.running_charge;

                if (currentChargeAmount > 0) {
                    let description = `تحقق شارژ جاری واحد ${(unit?.unit_number)} طبقه ${PrNumber(unit?.floor_number)} (${unit?.tenant_name || unit?.owner_name})`;
                    let autoDescription = description;
                    let transId = Apartment(orgId, 1, 'new_transaction', { description, auto_description: autoDescription, amount: currentChargeAmount, document_no: '', has_attachment: false, type_id: 3, building_id: unit?.building_id_fk ?? 0, data: { unit_id: unit?.id ?? 0, charge_type: 'C' } });
                    IssueVoucher(orgId, { user_id: 1, description, data: { building_id: unit?.building_id_fk ?? 0, amount: currentChargeAmount, unit_id: unit?.id ?? 0, charge_type: 'C' }, business_event_id: 1, transaction_id: transId });
                    Apartment(orgId, 1, 'approve_transaction', { id: transId });
                }
            }
        });
    });
}
catch (e) {
    Log(`Financial Scheduler ERROR:${e}`);
}

try {

    const getValueById = (htmlString, id, propName = 'id') => {
        const regex = new RegExp(`<[^>]*${propName}=['"]${id}['"][^>]*>([\\s\\S]*?)<\\/[^>]*>`, 'i');
        const match = htmlString.match(regex);
        return match ? match[1] : null;
    }

    let counter = Number(GetContext("TALA_PRICE_COUNTER") ?? 0);
    if (!counter) counter = 0;
    let getPriceFlg = (counter % 10) == 0;
    Log(`Price Counter:${counter}`)
    counter++;
    SetContext("TALA_PRICE_COUNTER", `${counter}`);
    if (getPriceFlg) {
        try {
            let id = Number(GetContext("TALA_IR_SERVER_ID"));
            let resp = CallService(JSON.stringify({
                id, request: JSON.stringify({})
            }));
            let gold18 = Number(getValueById(resp, 'gold_18k')?.replaceAll(',', ''));
            Log(gold18);
            Vitrin(8,1, 1, 'update_price', { material_id: 2, price: gold18, tag: 'TALA.IR' });
            let gold24 = Number(getValueById(resp, 'gold_24k')?.replaceAll(',', ''));
            Log(gold24);
            Vitrin(8,1, 1, 'update_price', { material_id: 1, price: gold24, tag: 'TALA.IR' });
            /* gold_ounce
             gold_24k
             sekke-gad
             sekke-jad
             sekke-nim
             sekke-rob
             sekke-grm*/

        }
        catch (e) {
            Log(e);
        }

        try {
            let id = Number(GetContext("TGJU_ORG_SERVER_ID"));
            let resp = CallService(JSON.stringify({
                id, path: 'geram18', request: JSON.stringify({})
            }));
            let gold18 = SafeRound(Number(getValueById(resp, 'info.last_trade.PDrCotVal', 'data-col')?.replaceAll(',', '')) / 10);
            Log(gold18);
            Vitrin(8,1, 1, 'update_price', { material_id: 2, price: gold18, tag: 'TGJU.ORG' });
            resp = CallService(JSON.stringify({
                id, path: 'geram24', request: JSON.stringify({})
            }));
            let gold24 = SafeRound(Number(getValueById(resp, 'info.last_trade.PDrCotVal', 'data-col')?.replaceAll(',', '')) / 10);
            Log(gold24);
            Vitrin(8,1, 1, 'update_price', { material_id: 1, price: gold24, tag: 'TGJU.ORG' });
        }
        catch (e) {
            Log(e);
        }
    }
}
catch (e) {

}

try {

    let orgIdsStr = GetContext('ORGANIZATIONS');
    let orgIds = JSON.parse(orgIdsStr);
    orgIds?.forEach(orgId => {
        let lastPeriod = Bot('get_config', { id: 1 })?.int_value;
        let currentPeriod = Financial(orgId, 1, 'get_current_period', {})?.id;

        if (currentPeriod === 0 || lastPeriod !== currentPeriod) {
            let setCheck = Bot('set_config', { id: 1, type: 'int', value: currentPeriod });
            if (setCheck) {

                let buildings = Apartment(orgId, 1, 'get_all_building', {});
                buildings?.forEach(x => {
                    if (!x?.id) return;
                    let units = Apartment(orgId, 1, 'get_building_units', { building_id: x?.id });
                    let limit = (units?.length ?? 0) * 4;
                    User('_', 1, orgId, 'set_reset_sms_template_limit', { id: 1, limit, object_id: x?.id })
                });

            }

        }
    });
}
catch (e) {
    Log(`Scheduler ERROR:${e}`);
}

try {
    let sms = Bot('pop_sms_queue', {});
    Log(JSON.stringify(sms));
    sms?.forEach(x => {
        try {
            Log(JSON.stringify(x));
            Sms(x?.organization_id??0,x?.receptor??'',x?.template_no?Number(x?.template_no):null,x?.template_text?x?.template_text:null,JSON.parse(x?.parameters));
        }
        catch (e) {
            Log(`ERROR SEND SMS:${e}`);
        }
    })
}
catch (e) {
    Log(`SMS Scheduler ERROR:${e}`);
}

try {
    const now = new Date();
    let lastDate = new Date();
    let lastDateStr = GetContext("SCHEDULER_LAST_DATE");
    if(lastDateStr)
    {
        lastDate=new Date(Number(lastDateStr));
    }
    else
    {
        lastDate=new Date();
    }

    if (now.getDate() !== lastDate.getDate()) {
        SetContext("SCHEDULER_LAST_DATE",`${now.getTime()}`);

        let currentJalali  = ToJalali(new Date(),true);
        let currentJalaliStr = currentJalali.replaceAll('/','_').replaceAll(' ','').replaceAll(':','_').replaceAll('-','_');
        System(`mkdir ./backup;`);
        System(`tar -czvf ./backup/Backup_${currentJalaliStr}.tar.gz ./db/*`);
    }
}
catch (e) {
    Log(`Backup ERROR:${e}`);
}

