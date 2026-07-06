import { handle } from 'hono/vercel'
import { app } from '../src/app.js'

// Vercel serverless entry point. The @hono/node-server bootstrap in src/index.ts
// runs the long-lived container/local server; on Vercel every request is routed
// to this one function by the catch-all rewrite in vercel.json, and handle()
// adapts the Hono app to Vercel's Node (Web Request/Response) runtime. Node is
// the default runtime for api/*.ts — Edge won't work here (pg / the Prisma
// driver adapter need Node).
export default handle(app)
