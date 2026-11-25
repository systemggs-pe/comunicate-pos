import {readdirSync,rmSync} from 'node:fs';

// Netlify Functions use glibc on Linux x64. Keep other local builds intact.
if(process.platform!=='linux'||process.arch!=='x64')throw new Error('Build Netlify on Linux x64.');

const optionalModules=[
 '@napi-rs/canvas-linux-x64-musl',
 '@img/sharp-linuxmusl-x64',
 '@img/sharp-libvips-linuxmusl-x64',
];
for(const name of optionalModules)rmSync(`node_modules/${name}`,{recursive:true,force:true});

// The application uses Prisma's native PostgreSQL library engine.
const runtime='node_modules/@prisma/client/runtime';
for(const file of readdirSync(runtime)){
 if(file.endsWith('.map')||/^query_(compiler|engine)_bg\.(cockroachdb|mysql|sqlite|sqlserver)\./.test(file)){
  rmSync(`${runtime}/${file}`);
 }
}

const generated='node_modules/.prisma/client';
for(const file of readdirSync(generated)){
 if(file.startsWith('libquery_engine-')&&file!=='libquery_engine-rhel-openssl-3.0.x.so.node'){
  rmSync(`${generated}/${file}`);
 }
}
