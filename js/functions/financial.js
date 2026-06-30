function Financial(orgId, userId, action, req) {
    let db = 'financial.db';
    switch (action) {
        case 'balance':
            try {
                let cp = req?.code_parts?.split(';')?.filter(Boolean);
                let cpv = req?.code_part_values?.split(';')?.filter(Boolean);
                let conditions = cp?.map((x,idx)=>{
                    return ` AND ((code_part_1=${x} AND code_part_value_1='${cpv[idx]}') OR (code_part_2=${x} AND code_part_value_2='${cpv[idx]}') OR (code_part_3=${x} AND code_part_value_3='${cpv[idx]}') OR (code_part_4=${x} AND code_part_value_4='${cpv[idx]}') OR (code_part_5=${x} AND code_part_value_5='${cpv[idx]}') )`
                })?.join(' ')??'';
                return Sqlite(orgId, db, `SELECT sum(ac.amount_balance) as bal FROM accounting_balance_tab ac WHERE ac.account_id_fk=${req?.account_id ?? 0} AND ac.currency_code_id_fk=${req?.currency_id ?? 0}  ${req?.accounting_period_id ? ` AND accounting_period_id_fk = ${req?.accounting_period_id ?? 0}` : ''} ${req?.accounting_year_id ? ` AND accounting_year_id_fk = ${req?.accounting_year_id ?? 0}` : ''} ${conditions}`)?.[0]?.bal ?? 0;
            }
            catch (e) {
                throw (e);
            }
        case 'balance_thru':
            try {
                let cp = req?.code_parts?.split(';')?.filter(Boolean);
                let cpv = req?.code_part_values?.split(';')?.filter(Boolean);
                let conditions = cp?.map((x,idx)=>{
                    return ` AND ((code_part_1=${x} AND code_part_value_1='${cpv[idx]}') OR (code_part_2=${x} AND code_part_value_2='${cpv[idx]}') OR (code_part_3=${x} AND code_part_value_3='${cpv[idx]}') OR (code_part_4=${x} AND code_part_value_4='${cpv[idx]}') OR (code_part_5=${x} AND code_part_value_5='${cpv[idx]}') )`
                })?.join(' ')??'';
                let period =Sqlite(orgId, db, `SELECT * FROM accounting_period_tab p WHERE p.id=${req?.accounting_period_id??0}`)?.[0];
                if(!period) throw('accounting period not found');
                return Sqlite(orgId, db, `SELECT sum(ac.amount_balance) as bal FROM accounting_balance_tab ac,accounting_period_tab ap WHERE ap.id=ac.accounting_period_id_fk AND ac.account_id_fk=${req?.account_id ?? 0} AND ac.currency_code_id_fk=${req?.currency_id ?? 0}  ${req?.accounting_year_id ? ` AND accounting_year_id_fk = ${req?.accounting_year_id ?? 0}` : ''} AND ap.thru_date<='${period?.thru_date}' ${conditions}`)?.[0]?.bal ?? 0;
            }
            catch (e) {
                throw (e);
            }
        case 'get_vouchers':
            try {
                
                return Sqlite(orgId, db, `SELECT v.* FROM voucher_tab v WHERE  v.is_reverse<>1 AND v.voucher_ref_id_fk IS NULL ${req?.id? ` AND id=${req?.id??0} ` :''} ${req?.transaction_id? ` AND transaction_id=${req?.transaction_id??0} ` :''} ${req?.business_event_posting_type_id?` AND v.business_event_posting_type_id_fk=${req?.business_event_posting_type_id??0}`:''} ${req?.voucher_type_id ? ` AND v.voucher_type_id_fk = ${req?.voucher_type_id ?? 0}` : ''} ${req?.accounting_period_id ? ` AND v.accounting_period_id_fk = ${req?.accounting_period_id ?? 0}` : ''} ${req?.accounting_year_id ? ` AND v.accounting_year_id_fk = ${req?.accounting_year_id ?? 0}  ORDER BY id DESC LIMIT ${req?.limit??10};`:''}`);
            }
            catch (e) {
                throw (e);
            }
         case 'get_voucher_rows':
            try {
                let cp = req?.code_parts?.split(';')?.filter(Boolean);
                let cpv = req?.code_part_values?.split(';')?.filter(Boolean);
                let conditions = cp?.map((x,idx)=>{
                    return ` AND ((r.code_part_1=${x} AND r.code_part_value_1='${cpv[idx]}') OR (r.code_part_2=${x} AND r.code_part_value_2='${cpv[idx]}') OR (r.code_part_3=${x} AND r.code_part_value_3='${cpv[idx]}') OR (r.code_part_4=${x} AND r.code_part_value_4='${cpv[idx]}') OR (r.code_part_5=${x} AND r.code_part_value_5='${cpv[idx]}') )`
                })?.join(' ')??'';
                return Sqlite(orgId, db, `SELECT r.* FROM voucher_tab v,voucher_row_tab r WHERE r.voucher_id_fk=v.id AND v.is_reverse<>1 AND v.voucher_ref_id_fk IS NULL  ${req?.business_event_posting_type_id?` AND v.business_event_posting_type_id_fk=${req?.business_event_posting_type_id??0}`:''} ${req?.voucher_type_id ? ` AND v.voucher_type_id_fk = ${req?.voucher_type_id ?? 0}` : ''} ${req?.accounting_period_id ? ` AND v.accounting_period_id_fk = ${req?.accounting_period_id ?? 0}` : ''} ${req?.accounting_year_id ? ` AND v.accounting_year_id_fk = ${req?.accounting_year_id ?? 0} ${conditions} `:''}`);
            }
            catch (e) {
                throw (e);
            }
         case 'get_current_period':
            try {
                return Sqlite(orgId, db, `SELECT * FROM accounting_period_tab p WHERE DATETIME('now','localtime') BETWEEN from_date AND thru_date ;`)?.[0];
            }
            catch (e) {
                throw (e);
            }
        case 'get_last_period':
            try {
                let thruDate=`datetime('now','localtime')`;
                if(req?.currrent_period_id)
                {
                    let period =  Sqlite(orgId, db, `SELECT * FROM accounting_period_tab p WHERE id=${req?.currrent_period_id}`)?.[0];
                    thruDate=`'${period.thru_date}'`;
                }
                return Sqlite(orgId, db, `SELECT *
                                            FROM accounting_period_tab
                                            WHERE thru_date < ${thruDate}
                                            ORDER BY thru_date DESC
                                            LIMIT 1;`)?.[0];
            }
            catch (e) {
                throw (e);
            }
            
        
    }
}