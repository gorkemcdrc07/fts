export const tarihFormatla = (d) => {
    if (!d) return '-';
    return new Date(d).toLocaleString('tr-TR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
};

export const hucreFormatla = (value, saatGoster = false) => {
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
        return saatGoster ? value.replace('T', ' ').substring(0, 16) : value.split('T')[0];
    }
    return value ?? '-';
};
