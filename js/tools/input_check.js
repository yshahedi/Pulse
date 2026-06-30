function InputCheck(type, input) {
    switch (type) {
        case 'CARD':
            {
                const sanitized = input.replace(/[\s-]/g, '');
                if (!/^\d{16}$/.test(sanitized)) {
                    return false;
                }
                let sum = 0;
                for (let i = 0; i < 16; i++) {
                    let digit = parseInt(sanitized[i]);
                    if (i % 2 === 0) {
                        digit *= 2;
                        if (digit > 9) {
                            digit -= 9;
                        }
                    }
                    sum += digit;
                }
                return sum % 10 === 0;
            }
            break;
        case 'IBAN':
            {
                shaba = input.replace(/\s+/g, '').toUpperCase();
                if (shaba.startsWith("IR")) {
                    shaba = shaba.slice(2);
                }
                if (!/^\d{24}$/.test(shaba)) return false;
                let iban = "IR" + shaba;
                let rearranged = iban.slice(4) + iban.slice(0, 4);
                let converted = "";
                for (let ch of rearranged) {
                    if (/[A-Z]/.test(ch)) {
                        converted += (ch.charCodeAt(0) - 55);
                    } else {
                        converted += ch;
                    }
                }
                let remainder = converted;
                while (remainder.length > 2) {
                    remainder = (parseInt(remainder.slice(0, 9)) % 97) + remainder.slice(9);
                }

                return parseInt(remainder) % 97 === 1;
            }
            break;
        case 'NATIONAL_ID':
            {
                return true;
            }
            break;
        case 'PHONE':
            {
            const pattern = /^(\+98|0|98)?9\d{9}$/;
                    const sanitized = input.replace(/[\s-]/g, '');
                    return pattern.test(sanitized);
            }
            break;
    }
    return false;
}