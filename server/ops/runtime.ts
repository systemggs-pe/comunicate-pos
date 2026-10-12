import type {Express} from 'express';
export function startHttp(app: Express, port: number, disconnect: () => Promise<void>, graceMs = 25000) {
  const server = app.listen(port, '127.0.0.1', () => console.log(JSON.stringify({event:'api.started',host:'loopback'})));
  server.requestTimeout = 30000;
  server.headersTimeout = 15000;
  let closing: Promise<void> | undefined;
  const shutdown = () => closing ??= new Promise<void>((resolve,reject) => {
    const force = setTimeout(() => server.closeAllConnections(), graceMs); force.unref();
    server.close(error => {
      clearTimeout(force);
      void disconnect().then(() => error ? reject(error) : resolve(), reject);
    });
    server.closeIdleConnections();
  });
  const signal = () => { void shutdown().catch(() => {console.error(JSON.stringify({event:'api.shutdown',status:'FAILED'}));process.exitCode=1;}); };
  process.once('SIGTERM', signal); process.once('SIGINT', signal);
  server.once('close', () => {process.off('SIGTERM',signal);process.off('SIGINT',signal);});
  return {server, shutdown};
}
