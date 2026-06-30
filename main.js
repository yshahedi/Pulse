

Log('Run Main.js...');
Serv('add_function', { name: 'AddFunction_', file_name: `./js/system/add_function.js`, refresh: true });
Log(Instance(`AddFunction_();`));
Log(Instance(`Init_();`));
response = "OK";


