import assert from 'node:assert/strict';

// The pinned PEM labels do NOT agree with the native bundle's rsaenc(mod, exp)
// argument positions. Match the verified call site rather than replacing each
// PEM field independently (which silently swaps the generated parameters).
export function nativeClientWithRsa(source, oldKey, rsa) {
    const previous = `BigInt("${oldKey.e}"),BigInt("${oldKey.n}")`;
    assert.equal(source.split(previous).length - 1, 1, 'Pinned native RSA call changed; review argument order before adapting it.');
    return source.replace(previous, `BigInt("${rsa.n}"),BigInt("${rsa.e}")`);
}

export function verifyNativeRsa(source, rsa) {
    assert(source.includes(`BigInt("${rsa.n}"),BigInt("${rsa.e}")`), 'Native RSA arguments must be modulus, exponent (PR #1 used reversed PEM labels).');
}
