import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
const manifest=JSON.parse(await readFile('dist/.vite/manifest.json','utf8'));
const seen=new Set();
function visit(key){if(seen.has(key))return;seen.add(key);for(const dependency of manifest[key].imports??[])visit(dependency);}
for(const [key,item] of Object.entries(manifest))if(item.isEntry)visit(key);
const files=await Promise.all([...seen].map(async key=>{const file=manifest[key].file,bytes=await readFile(`dist/${file}`);return {file,bytes:bytes.length,gzipBytes:gzipSync(bytes).length};}));
const result={initialJavaScript:files,totalBytes:files.reduce((n,f)=>n+f.bytes,0),totalGzipBytes:files.reduce((n,f)=>n+f.gzipBytes,0),measuredAt:new Date().toISOString()};
await mkdir('.test-results/phase9',{recursive:true});
await writeFile(`.test-results/phase9/bundle-${process.argv[2]??'final'}.json`,JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
