Log('Update Functions....');
Log(Instance(`AddFunction_();`));
/*let fielList = Ls('./js/generator');
fielList?.split(';')?.forEach(file_name => {
    const name = file_name.split("/").pop()?.split(".")?.[0];
    Log(`Reloading ${name} function from : ${file_name}`);
    Serv('add_function', { name, file_name });

})*/
Authorizer('create_data_model', {});
Base('create_data_model', {});
UserInterface('create_data_model', {});
response = ' Functions reloaded successfully';