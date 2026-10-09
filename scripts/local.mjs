import { spawn, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';

process.chdir(fileURLToPath(new URL('../', import.meta.url)));

function run(command, args, timeout = 180_000) {
  const result = spawnSync(command, args, { stdio: 'inherit', timeout, windowsHide: true });
  if (result.error || result.status !== 0) {
    throw new Error(`No se pudo ejecutar ${command} ${args.join(' ')}. ${result.error?.message ?? ''}`);
  }
}

function checkPort(port) {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', () => reject(new Error(`El puerto ${port} está ocupado. Cierra el servidor anterior y vuelve a iniciar.`)));
    probe.listen(port, '127.0.0.1', () => probe.close(resolve));
  });
}

try {
  if (!existsSync('node_modules/tsx/dist/cli.mjs')) {
    throw new Error('Instala Node.js 22.12 o superior y ejecuta npm install antes de iniciar.');
  }
  if (!existsSync('.env')) copyFileSync('.env.example', '.env');
  const { config } = await import('dotenv');
  config({ quiet: true });
  const database = new URL(process.env.DATABASE_URL);
  if (!['127.0.0.1', 'localhost'].includes(database.hostname) || database.port !== '55432' || database.pathname !== '/communicate_pos') {
    throw new Error('El inicio local requiere la base communicate_pos en 127.0.0.1:55432. Revisa .env; no se aplicaron migraciones.');
  }
  const apiPort = Number(process.env.PORT ?? 3001);
  if (!Number.isInteger(apiPort) || apiPort < 1 || apiPort > 65535 || apiPort === 5173) throw new Error('PORT debe ser un puerto válido distinto de 5173.');
  await checkPort(5173);
  await checkPort(apiPort);
  if (process.platform === 'win32' && process.argv.includes('--native')) {
    console.log('Preparando PostgreSQL nativo (sin Docker).');
    run('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', 'scripts/local-postgres.ps1'], 900_000);
  } else {
    console.log('Preparando PostgreSQL con Docker Desktop.');
    run('docker', ['compose', 'up', '-d', '--wait', '--wait-timeout', '180', 'postgres'], 240_000);
  }
  run(process.execPath, ['node_modules/prisma/build/index.js', 'generate']);
  run(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy']);
  run(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'scripts/local-admin.ts']);

  console.log('\nAbre http://127.0.0.1:5173 — Ctrl+C para detener la aplicación.');
  const children = [
    spawn(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'watch', 'server/local.ts'], { stdio: 'inherit', windowsHide: true }),
    spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5173', '--strictPort'], {
      stdio: 'inherit', windowsHide: true,
      env: { ...process.env, API_PROXY_TARGET: `http://127.0.0.1:${apiPort}` },
    }),
  ];
  let stopping = false;
  const stop = (code = 0) => {
    if (stopping) return;
    stopping = true;
    process.exitCode = code;
    for (const child of children) child.kill();
  };
  process.on('SIGINT', () => stop());
  process.on('SIGTERM', () => stop());
  for (const child of children) {
    child.on('error', (error) => { console.error(error.message); stop(1); });
    child.on('exit', (code) => stop(code ?? 0));
  }
} catch (error) {
  console.error(`\n${error.message}`);
  process.exitCode = 1;
}
