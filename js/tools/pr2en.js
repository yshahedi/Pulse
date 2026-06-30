function Pr2En(str) {
  if(!str || !isNaN(str)) return str;
  
  const persianNumbers = [/۰/g, /۱/g, /۲/g, /۳/g, /۴/g, /۵/g, /۶/g, /۷/g, /۸/g, /۹/g];
  const arabicNumbers = [/٠/g, /١/g, /٢/g, /٣/g, /٤/g, /٥/g, /٦/g, /٧/g, /٨/g, /٩/g];
  
  let result = str;
  
  for (let i = 0; i < 10; i++) {
    result = result.replace(persianNumbers[i], i).replace(arabicNumbers[i], i);
  }
  
  return result;
}