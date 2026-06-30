function ToJalali(date,timeFlg=true) {

     let gY=   date.getFullYear();
     let gM=   date.getMonth() + 1;
     let gD=   date.getDate();

     const h = date.getHours().toString().padStart(2, "0");
    const m = date.getMinutes().toString().padStart(2, "0");
    const s = date.getSeconds().toString().padStart(2, "0");


    var g_days_in_month = [31,28,31,30,31,30,31,31,30,31,30,31];
    var j_days_in_month = [31,31,31,31,31,31,30,30,30,30,30,29];

    var gy = gY - 1600;
    var gm = gM - 1;
    var gd = gD - 1;

    var g_day_no = 365*gy + Math.floor((gy+3)/4) - Math.floor((gy+99)/100) 
                + Math.floor((gy+399)/400);

    for (var i=0; i < gm; ++i)
        g_day_no += g_days_in_month[i];
    if (gm > 1 && ((gy % 4 === 0 && gy % 100 !== 0) || (gy % 400 === 0)))
        g_day_no++;

    g_day_no += gd;

    var j_day_no = g_day_no - 79;

    var j_np = Math.floor(j_day_no / 12053);
    j_day_no = j_day_no % 12053;

    var jy = 979 + 33*j_np + 4 * Math.floor(j_day_no / 1461);
    j_day_no %= 1461;

    if (j_day_no >= 366) {
        jy += Math.floor((j_day_no - 366) / 365);
        j_day_no = (j_day_no - 366) % 365;
    }

    var jm = 0;
    for (var i=0; i < 11 && j_day_no >= j_days_in_month[i]; ++i) {
        j_day_no -= j_days_in_month[i];
        jm++;
    }
    var jd = j_day_no + 1;

    if(timeFlg)
    {
        return `${jy}/${(jm+1).toString().padStart(2,"0")}/${jd.toString().padStart(2,"0")} - ${h}:${m}:${s}`;
    }
    else
    {
        return `${jy}/${(jm+1).toString().padStart(2,"0")}/${jd.toString().padStart(2,"0")}`;
    }
}

