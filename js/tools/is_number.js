function IsNumber(value) {
    return value !== null &&
           value !== "" &&
           !isNaN(value) &&
           !isNaN(parseFloat(value));
}