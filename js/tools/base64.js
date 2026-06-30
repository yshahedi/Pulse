/**
 * Base64Encode(str) — encode a UTF-8 string to standard base64.
 * Base64Decode(str) — decode a base64 (or base64url) string back to UTF-8.
 *
 * Pure JavaScript; no Buffer / btoa / atob dependency.
 * Registered globally so both route files and function files can call them.
 */

function Base64Encode(str) {
    // Charset is declared locally (not at module top-level) because this file is
    // registered twice in add_function.js (once per exported function). A top-level
    // `const` would collide on the second load: "Identifier already declared".
    const _B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

    // Convert the JS string to a sequence of UTF-8 bytes.
    const bytes = [];
    for (let i = 0; i < str.length; i++) {
        let code = str.charCodeAt(i);
        if (code < 0x80) {
            bytes.push(code);
        } else if (code < 0x800) {
            bytes.push(0xC0 | (code >> 6));
            bytes.push(0x80 | (code & 0x3F));
        } else {
            bytes.push(0xE0 | (code >> 12));
            bytes.push(0x80 | ((code >> 6) & 0x3F));
            bytes.push(0x80 | (code & 0x3F));
        }
    }

    let result = '';
    for (let i = 0; i < bytes.length; i += 3) {
        const a = bytes[i];
        const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
        const c = i + 2 < bytes.length ? bytes[i + 2] : 0;

        result += _B64_CHARS[a >> 2];
        result += _B64_CHARS[((a & 3) << 4) | (b >> 4)];
        result += i + 1 < bytes.length ? _B64_CHARS[((b & 15) << 2) | (c >> 6)] : '=';
        result += i + 2 < bytes.length ? _B64_CHARS[c & 63] : '=';
    }
    return result;
}

function Base64Decode(str) {
    const _B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

    // Accept base64url (- and _) as well as standard base64 (+ and /).
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    // Strip padding so the loop math is simpler.
    str = str.replace(/=+$/, '');

    const bytes = [];
    for (let i = 0; i < str.length; i += 4) {
        const e1 = _B64_CHARS.indexOf(str[i]);
        const e2 = _B64_CHARS.indexOf(str[i + 1]);
        const e3 = i + 2 < str.length ? _B64_CHARS.indexOf(str[i + 2]) : 0;
        const e4 = i + 3 < str.length ? _B64_CHARS.indexOf(str[i + 3]) : 0;

        bytes.push((e1 << 2) | (e2 >> 4));
        if (i + 2 < str.length) bytes.push(((e2 & 15) << 4) | (e3 >> 2));
        if (i + 3 < str.length) bytes.push(((e3 & 3) << 6) | e4);
    }

    // Decode UTF-8 bytes back to a JS string.
    let result = '';
    let i = 0;
    while (i < bytes.length) {
        const b = bytes[i++];
        if (b < 0x80) {
            result += String.fromCharCode(b);
        } else if ((b & 0xE0) === 0xC0) {
            result += String.fromCharCode(((b & 0x1F) << 6) | (bytes[i++] & 0x3F));
        } else {
            result += String.fromCharCode(
                ((b & 0x0F) << 12) | ((bytes[i++] & 0x3F) << 6) | (bytes[i++] & 0x3F)
            );
        }
    }
    return result;
}
