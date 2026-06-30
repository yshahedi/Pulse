function JalaliToDate(jy, jm, jd) {
    let gy, gm, gd;
    let g_days_in_month = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let j_days_in_month = [31, 31, 31, 31, 31, 31, 30, 30, 30, 30, 30, 29];

    let jy_fixed = jy - 979;
    let jm_fixed = jm - 1;
    let jd_fixed = jd - 1;

    let j_day_no = 365 * jy_fixed + Math.floor(jy_fixed / 33) * 8 + Math.floor((jy_fixed % 33 + 3) / 4);
    for (let i = 0; i < jm_fixed; ++i) j_day_no += j_days_in_month[i];

    j_day_no += jd_fixed;

    let g_day_no = j_day_no + 79;

    gy = 1600 + 400 * Math.floor(g_day_no / 146097);
    g_day_no = g_day_no % 146097;

    let leap = true;
    if (g_day_no >= 36525) {
        g_day_no--;
        gy += 100 * Math.floor(g_day_no / 36524);
        g_day_no = g_day_no % 36524;

        if (g_day_no >= 365) {
            g_day_no++;
        } else {
            leap = false;
        }
    }

    gy += 4 * Math.floor(g_day_no / 1461);
    g_day_no %= 1461;

    if (g_day_no >= 366) {
        leap = false;
        g_day_no--;
        gy += Math.floor(g_day_no / 365);
        g_day_no = g_day_no % 365;
    }

    for (var i = 0; g_day_no >= g_days_in_month[i] + (i === 1 && leap); i++) {
        g_day_no -= g_days_in_month[i] + (i === 1 && leap);
    }
    gm = i + 1;
    gd = g_day_no + 1;

    return new Date(gy, gm - 1, gd);
}