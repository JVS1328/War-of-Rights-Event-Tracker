import { timingSafeEqual } from 'node:crypto';

/**
 * Write access to the database is a single-owner affair: one shared secret in
 * the `ADMIN_PASS` environment variable, presented as `Authorization: Bearer
 * <pass>`. There are no accounts to manage because there is exactly one person
 * who edits events and imports rounds — everyone else only ever reads.
 *
 * It travels in a header rather than the query string so it never lands in a
 * browser history entry, a referrer, or a platform access log. Twelve characters
 * is the floor: this is one secret guarding every write, and it is typed once
 * and then remembered, so there is no reason for it to be short.
 */

const MIN_LENGTH = 12;

/** True when the deployment has an admin pass configured at all. */
export function adminConfigured() {
  return typeof process.env.ADMIN_PASS === 'string' && process.env.ADMIN_PASS.length >= MIN_LENGTH;
}

/** Constant-time string compare, safe on differing lengths. */
function sameSecret(a, b) {
  const left = Buffer.from(String(a), 'utf8');
  const right = Buffer.from(String(b), 'utf8');
  // timingSafeEqual throws on a length mismatch, which would itself leak the
  // length; compare equal-sized digests of the two instead by padding to the
  // longer of the pair and folding the length check into the result.
  const size = Math.max(left.length, right.length, 1);
  const l = Buffer.alloc(size);
  const r = Buffer.alloc(size);
  left.copy(l);
  right.copy(r);
  return timingSafeEqual(l, r) && left.length === right.length;
}

/** Pull the bearer credential out of a request, or '' when absent/malformed. */
export function bearerFrom(req) {
  const header = req?.headers?.authorization ?? req?.headers?.Authorization ?? '';
  const match = /^Bearer (.+)$/.exec(String(header));
  return match ? match[1].trim() : '';
}

/**
 * True when the request carries the owner's pass. Fails closed: a deployment
 * with none configured accepts no writes at all, rather than silently letting
 * the world edit the database.
 */
export function isAdmin(req) {
  if (!adminConfigured()) return false;
  const presented = bearerFrom(req);
  if (!presented) return false;
  return sameSecret(presented, process.env.ADMIN_PASS);
}
