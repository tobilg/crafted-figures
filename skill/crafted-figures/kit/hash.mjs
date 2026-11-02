import { createHash } from 'node:crypto';
/** Hex SHA-256 used by manifests, ownership checks and release evidence.
 * @param {string|Uint8Array} value
 */
export const digest = value => createHash('sha256').update(value).digest('hex');
