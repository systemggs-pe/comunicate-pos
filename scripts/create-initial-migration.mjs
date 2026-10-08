import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const result = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'diff', '--from-empty', '--to-schema-datamodel', 'prisma/schema.prisma', '--script'], { encoding: 'utf8' });
if (result.status !== 0) throw new Error(result.stderr);
const directory = 'prisma/migrations/20261007000100_foundation';
mkdirSync(directory, { recursive: true });
writeFileSync(`${directory}/migration.sql`, readFileSync('scripts/migration-prefix.sql', 'utf8') + '\n' + result.stdout + '\n' + readFileSync('scripts/migration-constraints.sql', 'utf8'));
