import {mkdirSync,writeFileSync} from 'node:fs';
import {createDeclarationPdf} from '../server/documents/declaration.pdf.js';
import {declarationFixture} from '../tests/helpers/declaration.js';
mkdirSync('.test-results/phase6b',{recursive:true});
writeFileSync('.test-results/phase6b/declaration-test.pdf',Buffer.from(createDeclarationPdf(declarationFixture).output('arraybuffer')));
