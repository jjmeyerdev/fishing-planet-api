import { handle } from '@hono/node-server/vercel'
import { app } from '../src/app.js'

// Vercel serverless entry point. The @hono/node-server bootstrap in src/index.ts
// runs the long-lived container/local server; on Vercel every request is routed
// to this one function by the catch-all rewrite in vercel.json.
//
// The function runs on Vercel's Node runtime (pg / the Prisma driver adapter
// can't run on Edge), so it uses the @hono/node-server/vercel adapter, which
// bridges the Node (req, res) signature to the Hono app. hono/vercel's handle is
// for the Edge runtime and fails here with `this.raw.headers.get is not a
// function` (it hands Hono a Node request with plain-object headers).
export default handle(app)
