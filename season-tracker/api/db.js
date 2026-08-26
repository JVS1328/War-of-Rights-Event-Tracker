// The whole database API is one function. Routing to it is declared explicitly
// in vercel.json rather than left to a `[...path]` filename, because the
// filesystem catch-all matched only single-segment paths on the deployment:
// /api/db/events reached the handler, /api/db/events/<slug>/tracker got the
// platform's own 404 before it ever ran.
//
// The implementation sits in api/_lib (underscore-prefixed, therefore not
// itself deployed) where it can be unit tested without a platform request.
export { default } from './_lib/router.js';
