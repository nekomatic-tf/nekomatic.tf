export function exponentialBackoff(n, base = 1000) {
    return Math.pow(2, n) * base + Math.floor(Math.random() * base);
}

export function parseJSON(json) {
    try {
        return JSON.parse(json);
    } catch (err) {
        return null;
    }
}
