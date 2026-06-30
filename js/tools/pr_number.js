function PrNumber(num,seperatorFlg=true,roundFlg=false)
{
    const persianDigits = ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹'];
    if(!isNaN(num) && roundFlg) num=Math.round(num);
    let prNum=String(num);
    if(seperatorFlg) prNum= prNum.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return `${'\u200E'}${prNum.replace(/\d/g, d => persianDigits[d])}`;
}