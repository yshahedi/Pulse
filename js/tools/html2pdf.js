function Html2Pdf(html)
{
    let fileName=`T${UUID()}`;
    CreateFile(`./tmp/`, `${fileName}.html`, html);
    System(`google-chrome   --headless   --disable-gpu   --disable-software-rasterizer   --no-sandbox   --disable-dev-shm-usage    --print-to-pdf=./tmp/${fileName}.pdf ./tmp/${fileName}.html`);
    let f = ReadFileBase64(`./tmp/${fileName}.pdf`);
    System(`rm ./tmp/${fileName}.pdf`);
    System(`rm ./tmp/${fileName}.html`);
    return f;
}