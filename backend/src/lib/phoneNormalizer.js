const normalize = (phone) => {
    let digits = phone.replace(/\D/g, '').trim();
    if(digits.length == 0) return digits;

    if(digits.startsWith('55') && digits.length >= 12) {
        return `+${digits}`;
    } else if(digits.length >= 10 && digits.length <= 11) {
        return `+55${digits}`;
    } else {
        return `+${digits}`;
    }
}

module.exports = { normalize };