function CheckGetFromToDates(input) {
    // 1405/01/01-1405/03/30
    if (input?.length < 15) throw ('⚠️ فرمت تاریخ درست نمیباشد');
    let inputs = input?.split('-');
    if (inputs?.length < 2) throw ('⚠️ فرمت تاریخ درست نمیباشد');
    let date1 = inputs[0]?.split('/');
    if (date1?.length < 3) throw ('⚠️ فرمت تاریخ درست نمیباشد');
    let date2 = inputs[1]?.split('/');
    if (date2?.length < 3) throw ('⚠️ فرمت تاریخ درست نمیباشد');
    if (!Number(date1?.[0]) || !Number(date1?.[1]) || !Number(date1?.[2])) throw ('⚠️ فرمت تاریخ درست نمیباشد');
    if (!Number(date2?.[0]) || !Number(date2?.[1]) || !Number(date2?.[2])) throw ('⚠️ فرمت تاریخ درست نمیباشد');
    let dateFrom = JalaliToDate(Number(date1?.[0]), Number(date1?.[1]), Number(date1?.[2]));
    let datethru = JalaliToDate(Number(date2?.[0]), Number(date2?.[1]), Number(date2?.[2]));
    
    return [dateFrom,datethru];
}