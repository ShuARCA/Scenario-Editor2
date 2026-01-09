/**
 * テスト環境の動作確認用サンプルテスト
 * 
 * このファイルはVitest + fast-checkの設定が正しく動作することを確認するためのものです。
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

describe('テスト環境の動作確認', () => {
  it('Vitestが正常に動作すること', () => {
    expect(1 + 1).toBe(2);
  });

  it('fast-checkが正常に動作すること', () => {
    // 任意の整数に対して、2倍した値は元の値より大きいか等しい（負の数の場合は小さい）
    fc.assert(
      fc.property(fc.integer(), (n) => {
        const doubled = n * 2;
        if (n >= 0) {
          return doubled >= n;
        } else {
          return doubled <= n;
        }
      }),
      { numRuns: 100 }
    );
  });

  it('文字列のプロパティテストが動作すること', () => {
    // 任意の文字列に対して、長さは0以上である
    fc.assert(
      fc.property(fc.string(), (s) => {
        return s.length >= 0;
      }),
      { numRuns: 100 }
    );
  });
});
