function GenerateFile(template,data)
{
    let t = ReadFile(`./template/${template}`);
    Object.keys(data).forEach(x=>{
        t=t?.replaceAll(`##${x.toUpperCase()}##`,data[x]);
    });
    return t;
}