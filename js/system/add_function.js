function AddFunction_() {
    Log('Add Tools Function...');
    Serv('add_function', { name: 'Sqlite', file_name: `./js/tools/sqlite.js` });
    Serv('add_function', { name: 'SendBot', file_name: `./js/tools/send_bot.js` });
    Serv('add_function', { name: 'Sms', file_name: `./js/tools/sms.js` });
    Serv('add_function', { name: 'PushSMS', file_name: `./js/tools/push_sms.js` });
    Serv('add_function', { name: 'ToJalali', file_name: `./js/tools/to_jalali.js` });
    Serv('add_function', { name: 'JalaliToDate', file_name: `./js/tools/jalali_to_date.js` });
    Serv('add_function', { name: 'Pr2En', file_name: `./js/tools/pr2en.js` });
    Serv('add_function', { name: 'InputCheck', file_name: `./js/tools/input_check.js` });
    Serv('add_function', { name: 'PrNumber', file_name: `./js/tools/pr_number.js` });
    Serv('add_function', { name: 'Html2Pdf', file_name: `./js/tools/html2pdf.js` });
    Serv('add_function', { name: 'Html2Png', file_name: `./js/tools/html2png.js` });
    Serv('add_function', { name: 'Html2Base64', file_name: `./js/tools/html2base64.js` });
    Serv('add_function', { name: 'Url2Base64', file_name: `./js/tools/url2base64.js` });
    Serv('add_function', { name: 'ClearFile', file_name: `./js/tools/clear_file.js` });
    Serv('add_function', { name: 'GenerateFile', file_name: `./js/tools/generate_file.js` });
    Serv('add_function', { name: 'IsSqlInjection', file_name: `./js/tools/is_sql_injection.js` });
    Serv('add_function', { name: 'IsNumber', file_name: `./js/tools/is_number.js` });
    Serv('add_function', { name: 'SafeRound', file_name: `./js/tools/safe_round.js` });
    Serv('add_function', { name: 'ShuffleArray', file_name: `./js/tools/shuffle_array.js` });
    Serv('add_function', { name: 'CheckGetFromToDates', file_name: `./js/tools/check_get_from_to_date.js` });
    Serv('add_function', { name: 'V0', file_name: `./js/tools/v0.js` });
    Serv('add_function', { name: 'ToSnakeCase', file_name: `./js/tools/to_snake_case.js` });
    Serv('add_function', { name: 'Claude', file_name: `./js/tools/claude.js` });
    Serv('add_function', { name: 'GetFilePathName', file_name: `./js/tools/get_file_path_name.js` });
    Serv('add_function', { name: 'Base64Encode', file_name: `./js/tools/base64.js` });
    Serv('add_function', { name: 'Base64Decode', file_name: `./js/tools/base64.js` });

    Log('Add Business Function...');
    Serv('add_function', { name: 'IssueVoucher', file_name: `./js/functions/issue_voucher.js` });
    Serv('add_function', { name: 'ReverseVoucher', file_name: `./js/functions/reverse_voucher.js` });
    Serv('add_function', { name: 'Base', file_name: `./js/functions/base.js` });
    Serv('add_function', { name: 'Authorizer', file_name: `./js/functions/authorizer.js` });
    Serv('add_function', { name: 'Financial', file_name: `./js/functions/financial.js` });
    Serv('add_function', { name: 'UserInterface', file_name: `./js/functions/user_interface.js` });

    Log('Add System Function...');
    Serv('add_function', { name: 'AddRoutes_', file_name: `./js/system/add_route.js` });
    Serv('add_function', { name: 'LoadOrg_', file_name: `./js/system/load_org.js` });
    Serv('add_function', { name: 'LoadBot_', file_name: `./js/system/load_bot.js` });
    Serv('add_function', { name: 'Init_', file_name: `./js/system/init.js` });
}