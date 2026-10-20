// Vercel entry: zero-config Hono detects `export default app` here and deploys it as one Node
// function (region in vercel.json). Local development uses src/server.ts.
import { app } from './app';

export default app;
