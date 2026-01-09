/**
 * テスト環境のセットアップファイル
 * 
 * このファイルは各テストファイルの実行前に読み込まれ、
 * 共通のセットアップ処理を行います。
 */

// fast-checkのデフォルト設定
import * as fc from 'fast-check';

// プロパティベーステストのデフォルト実行回数を100回に設定
fc.configureGlobal({
  numRuns: 100,
  verbose: true
});

// グローバルなテストユーティリティをエクスポート
export { fc };
