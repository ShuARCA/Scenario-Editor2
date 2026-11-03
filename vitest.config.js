import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  resolve: {
    alias: {
      tiptap: path.resolve(__dirname, 'assets/vendor/tiptap.bundle.js'),
      pdfjs: path.resolve(__dirname, 'assets/lib/pdf.min.mjs')
    }
  },
  test: {
    // テスト環境の設定
    environment: 'jsdom',
    
    // テストファイルのパターン
    include: ['tests/**/*.test.js'],
    
    // グローバル設定
    globals: true,
    
    // カバレッジ設定
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.js'],
      exclude: ['src/config.js']
    },
    
    // プロパティベーステストの設定
    // fast-checkのデフォルト実行回数を100回に設定
    testTimeout: 30000,
    
    // レポーター設定
    reporters: ['verbose']
  }
});
