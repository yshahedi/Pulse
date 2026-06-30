function Html2Base64(html)
{
    let fileName=`T${UUID()}`;
    CreateFile(`./tmp/`, `${fileName}.html`, html);
    
    let f = ReadFileBase64(`./tmp/${fileName}.html`);
    System(`rm ./tmp/${fileName}.html`);
    return f;
}