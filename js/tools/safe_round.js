function SafeRound(number, decimalPlaces=5) {
    if(isNaN(number) || number===null || number===undefined) return number;
    const factor = Math.pow(10, decimalPlaces);
    return Math.round((number + Number.EPSILON) * factor) / factor;
}