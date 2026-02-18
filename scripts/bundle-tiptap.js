import * as esbuild from 'esbuild';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Tiptap バンドルビルドスクリプト
 * 
 * src/tiptap-bundle-entry.js をエントリーポイントとして、
 * assets/vendor/tiptap.bundle.js を生成します。
 */
const entryFile = path.join(__dirname, '../src/tiptap-bundle-entry.js');
const outfile = path.join(__dirname, '../assets/vendor/tiptap.bundle.js');


console.log('Building Tiptap bundle...');

try {
    await esbuild.build({
        entryPoints: [entryFile],
        bundle: true,
        outfile: outfile,
        format: 'esm',
        minify: true,
        sourcemap: true,
    });
    console.log('Tiptap bundle rebuilt successfully at ' + outfile);
} catch (e) {
    console.error(e);
    process.exit(1);
}
