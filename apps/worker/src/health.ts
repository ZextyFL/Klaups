import { createServer } from 'node:http';

// Tiny HTTP endpoint so hosts that expect a listening port (Render web
// services, Fly health checks) keep the worker alive, and so an operator can
// curl /health to see how many rooms are joined. Off entirely if PORT is unset.
export function startHealthServer(snapshot: () => Record<string, unknown>) {
  const port = Number(process.env.PORT);
  if (!Number.isFinite(port) || port <= 0) return;

  createServer((req, res) => {
    if (req.url === '/health' || req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, ...snapshot() }));
      return;
    }
    res.writeHead(404);
    res.end();
  }).listen(port, () => console.log(`health server on :${port}`));
}
