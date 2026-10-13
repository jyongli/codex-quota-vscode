import assert from 'node:assert/strict';

export const MAX_ICON_BYTES = 1024 * 1024;

export function verifyIcon(icon) {
  assert.ok(Buffer.isBuffer(icon) && icon.length >= 24
    && icon.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    && icon.subarray(12, 16).toString('ascii') === 'IHDR', 'The Marketplace icon must be a PNG');
  assert.ok(icon.length <= MAX_ICON_BYTES,
    `The Marketplace icon must not exceed 1024 KB (${MAX_ICON_BYTES} bytes); received ${icon.length} bytes`);
  const width = icon.readUInt32BE(16);
  const height = icon.readUInt32BE(20);
  assert.ok(width >= 128 && height >= 128, 'The icon must be at least 128×128');
  assert.equal(width, height, 'Use a square Marketplace icon');
  return { width, height, bytes: icon.length };
}
