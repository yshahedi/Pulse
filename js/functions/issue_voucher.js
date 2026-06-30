function IssueVoucher(orgId,req) {
    if(!orgId) throw('Organization Id not found!');
    Log('Version 3');
    let db = 'financial.db';
    /* 
    Input Sample:{user_id:1,accounting_period_id:4,description:"Yasser Test",data:{},business_event_id:1,voucher_date:'',is_reverse:false,voucher_ref_ids:[],currency_table_id:0,cross_currency_id:0}
    Qudity: 1: Debit 2: Credit 3:none
    */
    //req :{user_id,accounting_period_id,description,data,business_event_id, is_reverse,voucher_date,currency_table_id,cross_currency_id,voucher_ref_ids,reference_code,payment_order_id,financial_order_id,payment_id}
    let start = Time();
    if (!req?.user_id) throw ('Wrong input format: user not found');
    if (!req?.description) throw ('Wrong input format: description not found');
    if (!req?.business_event_id) throw ('Wrong input format: Besiness event id not found');
    if (!req?.is_reverse && !req?.data) throw ('Wrong input format: Business event data not found!');
    let data = JSON.stringify(req?.data ?? '{}') ?? '{}';
    try {

        let periodId = 0;
        if (!req?.accounting_period_id) {
            periodId = Sqlite(orgId,db, `SELECT id FROM accounting_period_tab WHERE is_active=1 AND is_closed=0 AND from_date<= DATETIME('now','localtime') AND thru_date >DATETIME('now','localtime') ORDER BY from_date asc`)?.[0]?.id;
            if (!periodId) {
                Sqlite(orgId,db, `UPDATE accounting_period_tab SET is_closed=1 WHERE is_active=1 AND is_closed=0 AND from_date<= DATETIME('now','localtime') `);
                periodId = Sqlite(orgId,db, `SELECT id FROM accounting_period_tab WHERE is_active=1  AND from_date<= DATETIME('now','localtime') AND thru_date >DATETIME('now','localtime') ORDER BY from_date asc`)?.[0]?.id;
                if (!periodId) throw ('Current accounting period not found');
                Sqlite(orgId,db, `UPDATE accounting_period_tab SET is_closed=0 WHERE id=${periodId} `);
            }
        }
        else {
            periodId = req.accounting_period_id;
        }
        let voucherDateTime = new Date();

        if (req.voucher_date) {
            voucherDateTime = new Date(req.voucher_date);
        }
        Sqlite(orgId,db, 'BEGIN TRANSACTION;');

        let currencyCheckDate = voucherDateTime;
        let currencyTable = 0;
        let crossCurrency = 0;
        let orgCurrencyCode = 0;
        let firstParallelCur = 0;
        let secondParallelCur = 0;
        let firstParallelCurRate = 0;
        let secondParallelCurRate = 0;
        let reverseFlg = false;

        if (req.is_reverse) reverseFlg = true;
        if (reverseFlg && !req?.voucher_ref_ids) throw ('reference vouchers not defined!')
        let finConfig = Sqlite(orgId,db, 'SELECT * FROM finance_config_tab;')?.[0];
        if (!finConfig) throw ('Organization currency not found');
        if (!finConfig?.currency_code_id_fk) throw ('Organization currency not found');
        orgCurrencyCode = finConfig?.currency_code_id_fk;
        if (!reverseFlg) {
            firstParallelCur = finConfig?.first_parallel_currency_id_fk ?? 0;
            secondParallelCur = finConfig?.second_parallel_currency_id_fk ?? 0;
            currencyTable = finConfig?.currency_table_id_fk ?? 0;
            if (!firstParallelCur && secondParallelCur) throw ('Organization first parallel currency not found');
            if ((firstParallelCur || secondParallelCur) && currencyTable == 0) throw ('Mismatch currency table for parallel currencies');
            if (firstParallelCur || secondParallelCur) {
                let curTab = Sqlite(orgId,db, `SELECT * FROM currency_table_tab WHERE id = ${currencyTable}`);
                if (curTab?.[0]?.currency_code_id_fk !== orgCurrencyCode) throw ('Mismatch currency table');
            }
            if (firstParallelCur) {
                let curRate = Sqlite(orgId,db, `SELECT * FROM currency_rate_tab WHERE is_active=1 AND from_date<=DATETIME('now','localtime') AND currency_table_id_fk=${currencyTable} AND currency_code_id_fk=${firstParallelCur} ORDER BY id desc`)?.[0];
                firstParallelCurRate = curRate?.value ?? 0;
            }
            if (secondParallelCur) {
                let curRate = Sqlite(orgId,db, `SELECT * FROM currency_rate_tab WHERE is_active=1 AND from_date<=DATETIME('now','localtime') AND currency_table_id_fk=${currencyTable} AND currency_code_id_fk=${secondParallelCur} ORDER BY id desc`)?.[0];
                secondParallelCurRate = curRate?.value ?? 0;
            }
            if ((firstParallelCur && !firstParallelCurRate) || (secondParallelCur && !secondParallelCurRate)) throw ('Mismatch currency table for parallel currencies');
            if (req.currency_table_id) currencyTable = req.currency_table_id;
            if (req.cross_currency_id) crossCurrency = req.cross_currency_id;
        }
        /*//LOCK POSTING_DATA_TAB
        let pstData = Sqlite(orgId,db,`SELECT * FROM posting_data_tab WHERE id=${req.posting_data_id}`)?.[0];
        if (!reverseFlg && pstData?.status_id != 2000) throw ('Duplicate voucher');
        if (reverseFlg && pstData?.status_id != 2001) throw ('Can not to reverse voucher"');*/

        //let bsnEvnt = Sqlite(orgId,db,`SELECT * FROM business_event_tab WHERE id=${pstData.business_event_id_fk}`)?.[0];
        let actPeriod = Sqlite(orgId,db, `SELECT * FROM accounting_period_tab WHERE id=${periodId}`)?.[0];
        let actYear = Sqlite(orgId,db, `SELECT * FROM accounting_year_tab WHERE id=${actPeriod?.accounting_year_id_fk}`)?.[0];

        if (!actPeriod?.is_active || actPeriod?.from_date > voucherDateTime || actPeriod?.thru_date < voucherDateTime) throw ('The accounting period is not active');
        if (actPeriod?.is_closed) throw ('The accounting period is closed');
        if (!actYear?.is_active || actYear?.from_date > voucherDateTime || actYear?.thru_date < voucherDateTime) throw ('The accounting year is not active');
        if (actYear?.is_closed) throw ('The accounting year is closed');

        let mainVouchers = [];
        if (reverseFlg) {
            mainVouchers = Sqlite(orgId,db, `SELECT * FROM voucher_tab WHERE  id in (${req?.voucher_ref_ids?.join(',') ?? 0}) AND status_id=2000 AND is_reverse=0 AND business_event_id_fk=${req?.business_event_id}`);
            if (!mainVouchers) throw ('Main voucher not found!');


        }

        let postingType = Sqlite(orgId,db, `SELECT * FROM business_event_posting_type_tab WHERE  business_event_id_fk=${req?.business_event_id} order by \`order\` asc;`);
        postingType?.forEach(rec => {
            let mainVoucher = {};
            let mainVoucherId = 0;
            if (reverseFlg) {
                mainVoucher = mainVouchers.find(x => x.business_event_posting_type_id_fk === rec.id);
                if (!mainVoucher) return;
                mainVoucherId = mainVoucher?.id ?? 0;
                firstParallelCur = mainVoucher?.first_parallel_currency_id_fk ?? 0;
                firstParallelCurRate = mainVoucher?.first_parallel_currency_rate ?? 0;
                secondParallelCur = mainVoucher?.second_parallel_currency_id_fk ?? 0;
                secondParallelCurRate = mainVoucher?.second_parallel_currency_rate ?? 0;
                currencyTable = mainVoucher?.currency_table_id_fk ?? 0;
                crossCurrency = mainVoucher?.cross_currency_id_fk ?? 0;
                currencyCheckDate = mainVoucher?.voucher_date ?? 0;
                data = mainVoucher.data;
            }
            let pstType = Sqlite(orgId,db, `SELECT * FROM posting_type_tab WHERE  id=${rec.posting_type_id_fk}`)?.[0];
            if (!pstType) throw ('Posting type is not defined');
            let userGroup = 0;
            if (pstType?.check_user_permission != 0) {

                let checkUserAlloweYearFlg = false;
                let checkUserAllowePeriodFlg = false;
                let checkUserAlloweVoucherTypeFlg = false;

                let userGrpMember = Sqlite(orgId,db, `SELECT * FROM user_group_member_tab WHERE is_active=1 AND user_id=${req?.user_id ?? 0}`);
                if (userGrpMember.length == 0) throw ('User permission denied');

                let userGrp = Sqlite(orgId,db, `SELECT * FROM user_group_tab WHERE id IN (${userGrpMember?.map(x => x?.user_group_id_fk)?.join(',')});`);

                userGrp.forEach(item => {
                    if (userGroup > 0) return;
                    let userAlloweYearFlg = false;
                    let userAllowePeriodFlg = false;
                    let userAlloweVoucherTypeFlg = false;

                    let allowedYear = item?.allowed_year?.split(';')?.filter(Boolean)?.map(x => Number(x));
                    let allowedPeriod = item?.allowed_period?.split(';')?.filter(Boolean)?.map(x => Number(x));
                    let allowedVoucherType = item?.allowed_voucher_type?.split(';')?.filter(Boolean)?.map(x => Number(x));

                    if (allowedYear.includes(actPeriod.accounting_year_id_fk)) { userAlloweYearFlg = true; checkUserAlloweYearFlg = true; }
                    if (allowedPeriod.includes(actPeriod.id)) { userAllowePeriodFlg = true; checkUserAllowePeriodFlg = true; }
                    if (allowedVoucherType.includes(pstType.voucher_type_id_fk)) { userAlloweVoucherTypeFlg = true; checkUserAlloweVoucherTypeFlg = true; }

                    if (userAlloweYearFlg && userAllowePeriodFlg && userAlloweVoucherTypeFlg) {
                        userGroup = item.id;
                    }

                });
                if (!checkUserAlloweYearFlg) throw ('User or user group does not have an access to accounting year');
                if (!checkUserAllowePeriodFlg) throw ('User or user group does not have an access to accounting period');
                if (!checkUserAlloweVoucherTypeFlg) throw ('User or user group does not have an access to voucher type');
                if (!userGroup) throw ('User permission denied');
            }

            let voucherNo = Sqlite(orgId,db, `SELECT * FROM voucher_no_serial_tab WHERE  voucher_type_id_fk=${pstType?.voucher_type_id_fk ?? 0} AND accounting_year_id_fk=${actPeriod?.accounting_year_id_fk ?? 0}`)?.[0];
            if (!voucherNo) throw ('Voucher serial no. not found');
            if (voucherNo?.current_number >= voucherNo?.thru_serial) throw ('Cannot get new voucher serial no.');
            let voucherSerial = 0;
            if (!voucherNo.current_number || voucherNo?.current_number < voucherNo?.from_serial) voucherSerial = voucherNo?.from_serial ?? 0;
            else voucherSerial = (voucherNo?.current_number ?? 0) + 1;

            let rowsCombination = {};
            if (!reverseFlg) {
                let pstCtl = Sqlite(orgId,db, `SELECT * FROM posting_control_tab WHERE posting_type_id_fk=${pstType?.id ?? 0};`);


                let sum = 0;
                let quantitySum = 0;
                let creditSum = 0;
                let debitSum = 0;
                pstCtl.forEach(item => {
                    const scriptFunction = new Function(`let SUM=${sum};let CR_SUM=${creditSum};let DB_SUM=${debitSum};let QTY_SUM=${quantitySum}; let data = ${data};\n` + item?.script ?? 'return [{amount:0,currency_id:0,account_id:0,quantity:0,code_parts:{}}];');
                    let result = scriptFunction();
                    result.forEach(row => {
                        sum += row?.amount ?? 0;
                        quantitySum += row?.quantity ?? 0;
                        if (item.is_debit == 0) creditSum += row?.amount ?? 0;
                        else debitSum += row?.amount ?? 0;
                        let account = Sqlite(orgId,db, `SELECT * from account_tab WHERE id=${row?.account_id ?? 0};`)?.[0];
                        if (!account) throw ('Account is not defined');
                        if (!account.is_active || account.from_date > voucherDateTime || account.thru_date < voucherDateTime) throw ('The account is not active');
                        let codePartRestrictions = Sqlite(orgId,db, `SELECT * FROM account_code_part_value_restriction_tab WHERE account_id_fk=${account?.id} AND currency_code_id_fk=${row?.currency_id ?? 0}; `);
                        Object.keys(row?.code_parts).forEach(key => {
                            let cp = Sqlite(orgId,db, `SELECT is_has_list,list FROM code_part_tab WHERE id=${key};`)?.[0];
                            if (!cp) throw ('Code part not found!');
                            if (cp.is_has_list && cp?.list?.length > 0) {
                                listJson = JSON.parse(cp.list);
                                if (!listJson[row?.code_parts?.[key] ?? 0]) throw ('Code part value not found!');
                            }
                        });
                        codePartRestrictions?.forEach(cpr => {
                            let hasMandatory = true;
                            let findCodePartValue = true;
                            if (cpr.is_code_part_mandatory) hasMandatory = false;
                            if (cpr.code_part_value_id_fk) findCodePartValue = false;
                            Object.keys(row?.code_parts).forEach(key => {
                                if (key === cpr.code_part_id_fk) {
                                    hasMandatory = true;
                                    if (!findCodePartValue && cpr.code_part_value_id_fk === row?.code_parts?.[key]) findCodePartValue = true;
                                    if (cpr.is_code_part_blocked && !cpr.code_part_value_id_fk) throw ('Account code part resteriction');
                                }
                            });
                            if (!hasMandatory || (!findCodePartValue && !cpr.is_code_part_blocked) || (findCodePartValue && cpr.is_code_part_blocked)) throw ('Account code part resteriction');
                        });

                        let pcc = `${row.account_id}$${row.currency_id}$${Object.keys(row?.code_parts)?.join(';') ?? ''}$${Object.keys(row?.code_parts)?.map(x => row?.code_parts[x])?.join(';')}`;
                        if (!rowsCombination?.[pcc]) rowsCombination[pcc] = {
                            currency: row.currency_id,
                            credit: 0,
                            debit: 0,
                            currency_credit: 0,
                            currency_debit: 0,
                            amount: 0,
                            currency_amount: 0,
                            quantity: 0,
                            account: 0,
                            code_part: '',
                            code_part_value: '',
                            currency_rate: 0,
                            account_quiddity: 0,
                            has_overdraft: false,
                            credit_balance: 0,
                            debit_balance: 0,
                            currency_credit_balance: 0,
                            currency_debit_balance: 0,
                            balance: 0,
                            currency_balance: 0
                        };
                        let currencyRate = 1;
                        if (row.currency_id != orgCurrencyCode) {
                            if (crossCurrency > 0) {
                                let crossCur = Sqlite(orgId,db, `SELECT * FROM cross_currency_tab WHERE id=${crossCurrency}`)?.[0];
                                if (!crossCur) throw ('Cross currency not defined');
                                let crossCurRate = Sqlite(orgId,db, `SELECT * FROM cross_currency_rate_tab WHERE cross_currency_id_fk=${crossCurrency} AND from_currency_id_fk=${row.currency_id} AND thru_currency_id_fk=${orgCurrencyCode} AND is_active=1 AND from_date>${currencyCheckDate} order by id asc`)?.[0];
                                if (crossCurRate) currencyRate = crossCurRate.value;
                            }
                            else if (currencyTable) {
                                let curTab = Sqlite(orgId,db, `SELECT * FROM currency_table_tab WHERE id=${currencyTable}`)?.[0];
                                if (!curTab) throw ('Currency Table not defined');
                                let curTabRate = Sqlite(orgId,db, `SELECT * FROM currency_rate_tab WHERE currency_table_id_fk=${currencyTable} AND currency_code_id_fk=${row.currency_id} AND is_active=1 AND from_date>${currencyCheckDate} order by id asc`)?.[0];
                                if (curTabRate) currencyRate = curTabRate.value;
                            }
                            else {
                                throw ('currency table or cross currency rate not defined');
                            }
                        }

                        rowsCombination[pcc].credit += item.is_debit ? 0 : row.amount * currencyRate;
                        rowsCombination[pcc].debit += !item.is_debit ? 0 : row.amount * currencyRate;
                        rowsCombination[pcc].currency_credit += item.is_debit ? 0 : row.amount;
                        rowsCombination[pcc].currency_debit += !item.is_debit ? 0 : row.amount;
                        rowsCombination[pcc].amount += item.is_debit ? row.amount * currencyRate * -1 : row.amount * currencyRate;
                        rowsCombination[pcc].currency_amount += item.is_debit ? row.amount * -1 : row.amount;
                        rowsCombination[pcc].quantity += item.is_debit ? row.quantity * -1 : row.quantity;
                        rowsCombination[pcc].account = row.account_id;
                        rowsCombination[pcc].code_part = Object.keys(row?.code_parts)?.join(';') ?? '';
                        rowsCombination[pcc].code_part_value = Object.keys(row?.code_parts)?.map(x => row?.code_parts[x])?.join(';') ?? '';
                        rowsCombination[pcc].currency_rate = currencyRate;
                        rowsCombination[pcc].account_quiddity = account.account_quiddity_id;
                        rowsCombination[pcc].has_overdraft = !!account?.is_allowed_overdraft;

                    });

                });
            }
            else {
                let voucherRows = Sqlite(orgId,db, `SELECT * FROM voucher_row_tab WHERE voucher_id_fk=${mainVoucherId}`);
                voucherRows?.forEach(r => {
                    let account = Sqlite(orgId,db, `SELECT * from account_tab WHERE id=${r?.account_id_fk ?? 0};`)?.[0];
                    if (!account) throw ('Account is not defined');
                    if (!account.is_active || account.from_date > voucherDateTime || account.thru_date < voucherDateTime) throw ('The account is not active');
                    let pcc = `${r.account_id_fk}$${r.currency_code_id_fk}$${r?.code_parts ?? ''}$${r?.code_part_values ?? ''}`;
                    if (!rowsCombination?.[pcc]) rowsCombination[pcc] = {
                        currency: r.currency_code_id_fk,
                        credit: 0,
                        debit: 0,
                        currency_credit: 0,
                        currency_debit: 0,
                        amount: 0,
                        currency_amount: 0,
                        quantity: 0,
                        account: 0,
                        code_part: '',
                        code_part_value: '',
                        currency_rate: 0,
                        account_quiddity: 0,
                        has_overdraft: false,
                        credit_balance: 0,
                        debit_balance: 0,
                        currency_credit_balance: 0,
                        currency_debit_balance: 0,
                        balance: 0,
                        currency_balance: 0
                    };
                    rowsCombination[pcc].credit += r.debit_amount;
                    rowsCombination[pcc].debit += r.credit_amount;
                    rowsCombination[pcc].currency_credit += r.currency_debit_amount;
                    rowsCombination[pcc].currency_debit += r.currency_credit_amount;
                    rowsCombination[pcc].amount += (-1) * r.amount;
                    rowsCombination[pcc].currency_amount += (-1) * r.currency_amount;
                    rowsCombination[pcc].quantity += (-1) * r.quantity;
                    rowsCombination[pcc].account = r.account_id_fk;
                    rowsCombination[pcc].code_part = r.code_parts;
                    rowsCombination[pcc].code_part_value = r.code_part_values;
                    rowsCombination[pcc].currency_rate = r.currency_rate;
                    rowsCombination[pcc].account_quiddity = account.account_quiddity_id;
                    rowsCombination[pcc].has_overdraft = !!account?.is_allowed_overdraft;
                });

            }
            let checkAmount = 0;
            if (Object?.keys(rowsCombination)?.length == 0) throw ('Voucher Row not found!');

            Object.keys(rowsCombination).forEach(cmb => {
                let row = rowsCombination[cmb];
                checkAmount += row.amount;
                let min = 0;
                let max = 999999999999;
                if (row.has_overdraft) {
                    let overdraft = Sqlite(orgId,db, `SELECT * FROM account_overdraft_tab WHERE account_id_fk=${row.account};`);
                    overdraft?.forEach(x => {
                        if (userGroup==0 || x.allowed_user_group.split(';')?.filter(Boolean).includes(userGroup)) {
                            if (x.minimum_value >= 0 && x.minimum_value > min) min = x.minimum_value;
                            if (x.maximum_value >= 0 && x.maximum_value < max) max = x.maximum_value;
                        }
                    })
                }

                let cp = row?.code_part?.split(';')?.filter(Boolean);
                let cpv = row?.code_part_value?.split(';')?.filter(Boolean);
                let conditions = cp?.map((x,idx)=>{
                    return ` AND ((code_part_1=${x} AND code_part_value_1='${cpv[idx]}') OR (code_part_2=${x} AND code_part_value_2='${cpv[idx]}') OR (code_part_3=${x} AND code_part_value_3='${cpv[idx]}') OR (code_part_4=${x} AND code_part_value_4='${cpv[idx]}') OR (code_part_5=${x} AND code_part_value_5='${cpv[idx]}') )`
                })?.join('  ')??'';
                let accountBalance = Sqlite(orgId,db, `SELECT sum(amount_balance) as bal FROM accounting_balance_tab WHERE account_id_fk=${row.account ?? 0} AND currency_code_id_fk=${row.currency ?? 0}  ${conditions} `)?.[0]?.bal??0;

                let amountBalance = accountBalance + row.amount;
                if ((row.account_quiddity == 1 && amountBalance > min) || (row.account_quiddity == 2 && amountBalance < (min * (-1)))) throw (`Insufficent Funds: #${row.account??0}`);
                if ((row.account_quiddity == 1 && amountBalance < (max * (-1))) || (row.account_quiddity == 2 && amountBalance > max) || (row.account_quiddity == 3 && (amountBalance > max || amountBalance < (max * (-1))))) throw (`Account Overflow: #${row.account??0}`);
               /* Sqlite(orgId,db, `UPDATE account_tab SET 
            amount_balance=${amountBalance} ,
            first_parallel_currency_balance=first_parallel_currency_balance+${row.amount * firstParallelCurRate},
            second_parallel_currency_balance=second_parallel_currency_balance+${row.amount * secondParallelCurRate}
            WHERE id = ${row.account};`);*/
                let actBal = Sqlite(orgId,db, `SELECT * FROM accounting_balance_tab WHERE account_id_fk=${row.account ?? 0}  AND accounting_year_id_fk=${actPeriod.accounting_year_id_fk} AND accounting_period_id_fk=${actPeriod.id} ${conditions}`)?.[0];
                if (!actBal) {
                    rowsCombination[cmb].credit_balance = rowsCombination[cmb].credit;
                    rowsCombination[cmb].debit_balance = rowsCombination[cmb].debit;
                    rowsCombination[cmb].currency_credit_balance = rowsCombination[cmb].currency_credit;
                    rowsCombination[cmb].currency_debit_balance = rowsCombination[cmb].currency_debit;
                    rowsCombination[cmb].balance = rowsCombination[cmb].amount;
                    rowsCombination[cmb].currency_balance = rowsCombination[cmb].currency_amount;
                    Sqlite(orgId,db, `INSERT INTO accounting_balance_tab 
                (account_id_fk,
                ${row?.code_part?.split(';')?.filter(Boolean)?.map((x, index) => `code_part_${index + 1},`).join(' ')}
                ${row?.code_part_value?.split(';')?.filter(Boolean)?.map((x, index) => `code_part_value_${index + 1},`).join(' ')}
                currency_code_id_fk,
                accounting_year_id_fk,
                accounting_period_id_fk,
                debit_balance,
                credit_balance,
                amount_balance,
                currency_debit_balance,
                currency_credit_balance,
                currency_amount_balance,
                quantity_balance,
                first_parallel_currency_debit_balance,
                first_parallel_currency_credit_balance,
                first_parallel_currency_balance,
                second_parallel_currency_debit_balance,
                second_parallel_currency_credit_balance,
                second_parallel_currency_balance,
                update_date)
                 VALUES (${row.account ?? 0},
                    ${row?.code_part?.split(';')?.filter(Boolean)?.map((x) => `${x},`).join(' ')}
                    ${row?.code_part_value?.split(';')?.filter(Boolean)?.map((x) => `'${x}',`).join(' ')}
                    ${rowsCombination[cmb].currency},
                    ${actPeriod.accounting_year_id_fk},
                    ${actPeriod.id},
                    ${rowsCombination[cmb].debit_balance},
                    ${rowsCombination[cmb].credit_balance},
                    ${rowsCombination[cmb].balance},                    
                    ${rowsCombination[cmb].currency_debit_balance},
                    ${rowsCombination[cmb].currency_credit_balance},
                    ${rowsCombination[cmb].currency_balance},     
                    ${rowsCombination[cmb].quantity},               
                    ${rowsCombination[cmb].debit_balance * firstParallelCurRate},
                    ${rowsCombination[cmb].credit_balance * firstParallelCurRate},
                    ${rowsCombination[cmb].currency_credit_balance * firstParallelCurRate},
                    ${rowsCombination[cmb].debit_balance * secondParallelCurRate},
                    ${rowsCombination[cmb].credit_balance * secondParallelCurRate},
                    ${rowsCombination[cmb].currency_credit_balance * secondParallelCurRate},
                    DATETIME('now','localtime')
                    );`);
                }
                else {
                    rowsCombination[cmb].credit_balance = rowsCombination[cmb].credit + actBal.credit_balance;
                    rowsCombination[cmb].debit_balance = rowsCombination[cmb].debit + actBal.debit_balance;
                    rowsCombination[cmb].currency_credit_balance = rowsCombination[cmb].currency_credit + actBal.currency_credit_balance;
                    rowsCombination[cmb].currency_debit_balance = rowsCombination[cmb].currency_debit + actBal.currency_debit_balance;
                    rowsCombination[cmb].balance = rowsCombination[cmb].amount + actBal.amount_balance;
                    rowsCombination[cmb].currency_balance = rowsCombination[cmb].currency_amount + actBal.currency_amount_balance;
                    Sqlite(orgId,db, `UPDATE accounting_balance_tab SET 
                debit_balance=${rowsCombination[cmb].debit_balance},
                credit_balance=${rowsCombination[cmb].credit_balance},
                amount_balance=${rowsCombination[cmb].balance},
                currency_debit_balance=${rowsCombination[cmb].currency_debit_balance},
                currency_credit_balance=${rowsCombination[cmb].currency_credit_balance},
                currency_amount_balance=${rowsCombination[cmb].currency_balance},
                quantity_balance=quantity_balance+${rowsCombination[cmb].quantity},
                first_parallel_currency_debit_balance=${rowsCombination[cmb].debit_balance * firstParallelCurRate},
                first_parallel_currency_credit_balance=${rowsCombination[cmb].credit_balance * firstParallelCurRate},
                first_parallel_currency_balance=${rowsCombination[cmb].balance * firstParallelCurRate},
                second_parallel_currency_debit_balance=${rowsCombination[cmb].debit_balance * secondParallelCurRate},
                second_parallel_currency_credit_balance=${rowsCombination[cmb].credit_balance * secondParallelCurRate},
                second_parallel_currency_balance=${rowsCombination[cmb].balance * secondParallelCurRate},
                update_date=DATETIME('now','localtime')
                WHERE id=${actBal.id};`);
                }
            });
            if (Math.abs(checkAmount) > 0.000001) throw ('Voucher is not balance');
            Sqlite(orgId,db, `UPDATE voucher_no_serial_tab SET current_number=${voucherSerial} WHERE id=${voucherNo.id};`);
            let voucherAmount=0;
            let voucherCurrencyAmount=0;
            Object.keys(rowsCombination).forEach((cmb, idx) => {
                voucherAmount+=rowsCombination[cmb].debit;
                voucherCurrencyAmount+=rowsCombination[cmb].currency_debit;
            });
            Sqlite(orgId,db, `INSERT INTO voucher_tab 
        (
        accounting_year_id_fk,
        accounting_period_id_fk,
        voucher_type_id_fk,
        user_group_id_fk,
        user_id,
        voucher_ref_id_fk,
        voucher_number,
        voucher_date,
        register_date,
        currency_table_id_fk,
        cross_currency_id_fk,
        voucher_text,
        reference_code,
        voucher_text_auto,
        status_id,
        insert_user_id,
        business_event_posting_type_id_fk,
        is_reverse,
        first_parallel_currency_id_fk,
        first_parallel_currency_rate,
        second_parallel_currency_id_fk,
        second_parallel_currency_rate,
        payment_order_id_fk,
        financial_order_id_fk,
        payment_id_fk,
        data,
        amount,
        currency_amount,
        business_event_id_fk,
        transaction_id
        )
    VALUES
        (
        ${actPeriod.accounting_year_id_fk},
        ${actPeriod.id},
        ${pstType.voucher_type_id_fk},
        ${userGroup},
        ${req.user_id},
        ${reverseFlg ? mainVoucherId : req.ref_voucher_id ?? 'null'},
        ${voucherSerial},
        '${voucherDateTime}',
        DATETIME('now','localtime'),
        ${currencyTable ? currencyTable : 'null'},
        ${crossCurrency ? crossCurrency : 'null'},
        '${req?.description ?? ''}',
        '${req.reference_code ?? ''}',
        '${reverseFlg ? 'Reverse Voucher' : req?.auto_description??''}',
        2000,
        ${req.user_id},
        ${rec.id},
        ${reverseFlg ? 1 : 0},
        ${firstParallelCur ? firstParallelCur : 'null'},
        ${firstParallelCurRate ? firstParallelCurRate : 'null'},
        ${secondParallelCur ? secondParallelCur : 'null'},
        ${secondParallelCurRate ? secondParallelCurRate : 'null'},
        ${reverseFlg ? mainVoucher?.payment_order_id_fk ?? 'null' : req?.payment_order_id ?? 'null'},
        ${reverseFlg ? mainVoucher?.financial_order_id_fk ?? 'null' : req?.financial_order_id ?? 'null'},
        ${reverseFlg ? mainVoucher?.payment_id_fk ?? 'null' : req?.payment_id ?? 'null'},
        '${data}',
        ${voucherAmount},
        ${voucherCurrencyAmount},
        ${rec.business_event_id_fk??0},
        ${reverseFlg?mainVoucher?.transaction_id ?? 'null' : req?.transaction_id ?? 'null'}
        );`);

            let voucherId = Sqlite(orgId,db, `SELECT LAST_INSERT_ROWID() as id;`)?.[0]?.id ?? 0;
            if (reverseFlg) {
                Sqlite(orgId,db, `UPDATE voucher_tab SET status_id=2001,voucher_ref_id_fk=${voucherId} WHERE id=${mainVoucherId};`)
            }


            Object.keys(rowsCombination).forEach((cmb, idx) => {
                let row = rowsCombination[cmb];
                Sqlite(orgId,db, `INSERT INTO voucher_row_tab 
            (
                voucher_id_fk,
                row_no,
                account_id_fk,
                ${row?.code_part?.split(';')?.filter(Boolean)?.map((x, index) => `code_part_${index + 1},`).join(' ')}
                ${row?.code_part_value?.split(';')?.filter(Boolean)?.map((x, index) => `code_part_value_${index + 1},`).join(' ')}
                code_parts,
                code_part_values,
                description,
                row_text,
                debit_amount,
                credit_amount,
                currency_debit_amount,
                currency_credit_amount,
                currency_code_id_fk,
                currency_rate,
                quantity,
                balance,
                currency_balance,
                amount,
                currency_amount,
                debit_balance,
                credit_balance,
                currency_debit_balance,
                currency_credit_balance
            )
            VALUES
            (
                ${voucherId},
                ${idx + 1},
                ${row.account},
                ${row?.code_part?.split(';')?.filter(Boolean)?.map((x) => `${x},`).join(' ')}
                ${row?.code_part_value?.split(';')?.filter(Boolean)?.map((x) => `'${x}',`).join(' ')}
                '${row.code_part}',
                '${row.code_part_value}',
                '${req.description}',
                '',
                ${row.debit},
                ${row.credit},
                ${row.currency_debit},
                ${row.currency_credit},
                ${row.currency},
                ${row.currency_rate},
                ${row.quantity},
                ${row.balance},
                ${row.currency_balance},
                ${row.amount},
                ${row.currency_amount},
                ${row.debit_balance},
                ${row.credit_balance},
                ${row.currency_debit_balance},
                ${row.currency_credit_balance}
            );`)
            });
        });

        //Sqlite(orgId,db,`UPDATE posting_data_tab SET status_id=${reverseFlg ? 2002 : 2001} WHERE id=${req.posting_data_id};`)

        Sqlite(orgId,db, 'COMMIT;');
    }
    catch (e) {
        Sqlite(orgId,db, 'ROLLBACK;');
        throw (e);
    }
    let end = Time();
    Log(`${end - start}`);
    Log('end');
}