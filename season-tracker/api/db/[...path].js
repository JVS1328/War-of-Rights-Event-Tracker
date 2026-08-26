// Vercel deploys one function per file under api/, so the entire database API
// lives behind this single catch-all; the implementation sits in api/_lib
// (underscore-prefixed, therefore not itself deployed) where it can be unit
// tested without a platform request object.
export { default } from '../_lib/router.js';
