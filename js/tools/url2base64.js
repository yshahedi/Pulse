function Url2Base64(url)
{
    let fileName=`T${UUID()}`;
    System('mkdir ./tmp;');
    System(`curl -o ./tmp/${fileName}.b64 ${url};`)
    //System(`base64 ./tmp/${fileName}.tmp > ./tmp/${fileName}.b64`)
    let f = ReadFileBase64(`./tmp/${fileName}.b64`);
    System(`rm ./tmp/${fileName}.b64`);
    //System(`rm ./tmp/${fileName}.b64`);
    return f;
}