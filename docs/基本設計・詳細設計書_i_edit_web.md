# iEditWeb 基本設計書 / 詳細設計書

> 参照元ファイル:
> - 要件定義: `/mnt/data/要件定義.txt`
> - 既存システム設計: `/mnt/data/system_design.md`
> - UI デザインガイドライン: `/mnt/data/ui_design.md`

---

## 1. 目的
要件定義に基づき、Markdownベースのリッチテキスト編集機能とフローチャート（アウトライン）を一つのドキュメント内で連携するPWA（クライアント完結）アプリケーションの**基本設計書**および**詳細設計書**を作成する。本書はAI仕様駆動開発（コンポーネント単位での自動生成や実装を想定）に渡すための最終的な実装仕様を含む。

## 2. 適用範囲
- ブラウザ上のSPA（React + TypeScript）
- オフライン対応（PWA）
- ローカル保存（IndexedDB + ZIPエクスポート）
- エディタ（Tiptap ベース）とフローチャート（React Flow）の双方向同期
- 日本語UI（i18n構造を取り込むが現状は日本語のみ）
- サーバーサイドは存在しない（認証・バックエンド無し）

## 3. 非機能要件（要約）
- レスポンス: 操作に対し0.5秒以内
- クロスブラウザ: Chromium系 / Firefox / Safari（最新）
- アクセシビリティ: ダーク/ライト、フォントサイズ可変、色覚対応
- セキュリティ: ローカルストレージ完結。保存/読み込み時にHTMLサニタイズ

---

# 基本設計

## 4. システム全体構成
- フロントエンド: React 18 + TypeScript
- ビルド: Vite
- UI: Tailwind CSS + shadcn/ui, Lucide for icons
- Editor: Tiptap（ProseMirrorベース）拡張でMarkdown互換（`@tiptap/extension-markdown` など）
- Flow: React Flow（ノード/エッジ編集）
- 状態管理: Zustand（シンプルなグローバルストア）
- 永続化: IndexedDB（idbライブラリ推奨） + ZIP入出力は JSZip / FileSaver
- PWA: Workbox または Vite PWA plugin
- テスト: Jest（ユニット） + Playwright（E2E）

## 5. データフォーマット
### 5.1 ZIP（保存）構成
```
<project>.zip
├ content.md            // Markdown テキスト（スタイルはメタデータで保持）
├ metadata.json         // アプリ固有メタデータ（下記スキーマ）
├ assets/
│  ├ img-0001.png
│  └ ...
└ viewer.html           // ビューア用 HTML（読み取り専用で表示）
```

### 5.2 metadata.json スキーマ（例）
```ts
interface MetadataJson {
  version: string; // セマンティックバージョン e.g. "1.0.0"
  createdAt: string; // ISO 8601
  updatedAt: string;
  editor: {
    cursorPosition?: number;
    scrollTop?: number;
    styles?: Record<string, TextStyleConfig>; // 節ごとのスタイル（見出しH1~H4 など）
  };
  flowchart: {
    nodes: NodeData[];
    edges: EdgeData[];
    viewport: { x: number; y: number; zoom: number };
  };
  assets: { fileName: string; mime: string; size: number; id: string }[];
}

interface TextStyleConfig { fontFamily?: string; fontSize?: number; color?: string; bg?: string }

interface NodeData {
  id: string;
  title: string; // 見出しテキスト
  headerLevel: number; // 1..4
  x: number; y: number; width?: number; height?: number;
  style?: { bg?: string; border?: string; textColor?: string };
  children?: string[]; // child node ids
  parent?: string | null;
  folded?: boolean;
}

interface EdgeData {
  id: string;
  source: string; target: string;
  style?: { color?: string; arrow?: 'none'|'source'|'target'|'both'; lineStyle?: 'solid'|'dashed' };
  label?: string;
}
```

> 注意: 上記は TypeScript のインターフェースで、実装はこの型を中心に行う。

## 6. 永続化 / IndexedDB
- DB名: `ieditweb_db` バージョン 1
- オブジェクトストア: `documents` (key: id) storing `{ id, title, metadata, contentMd, assets }`
- エクスポート: ZIP を作成してユーザーにダウンロードさせる
- インポート: ZIP 内を検査して `content.md`, `metadata.json`, `assets` を読み込み

## 7. PWA / Service Worker
- オフラインのコア資産（index.html, JS bundle, CSS）をキャッシュ
- IndexedDBのデータはサービスワーカーではなく、クライアントスクリプトで管理
- 更新戦略: `stale-while-revalidate` をベースにし、ユーザーが更新を明示的に行える通知を表示

---

# 詳細設計

## 8. フロントエンド コンポーネント設計（主要コンポーネント）
> コンポーネントはReact + TypeScriptで作成し、各PropsとStateを定義する。

### 8.1 AppTop
- 役割: 全体レイアウト、テーマ、PWA登録
- Props: none
- 内部状態: global store 参照
- 重要な責務: グローバルショートカット登録、ErrorBoundary

### 8.2 HeaderBar
- Props: `fileName: string`, `onOpen`, `onSaveAs`, `onSettings` (callbacks)
- UI: 左=アウトライン表示トグル、中央=ファイル名表示（編集可能）、右=開く/名前を付けて保存/設定

### 8.3 OutlineSidebar
- Props: none (store から取得)
- 機能: H1〜H4 をツリービューで表示、クリックでエディタをスクロール
- 実装要点: 仮想化（項目多数想定）、リアルタイム反映（Editor の Document を監視して差分更新）

### 8.4 FlowCanvas
- Props: none
- 内部: React Flow をラップ
- 機能:
  - Markdown 見出しからノード自動生成
  - ノードドラッグで座標を更新して store に保存
  - ノードの右クリックでスタイルメニュー（bg, border, textColor）
  - グループ化（親子）ロジック、折りたたみ/展開
  - 接続線のスタイルとラベル編集
- Node コンポーネント: `FlowNode` (props: NodeData, onUpdate)
- Edge コンポーネント: カスタムラベルレンダラー

### 8.5 EditorPane
- Props: none
- 内部: Tiptap Editor のインスタンス
- 機能:
  - Markdown 入力互換（見出しは H1..H4）
  - フローティングスタイルメニュー（選択範囲の直上に表示）
  - 画像のドラッグ＆ドロップ、クリップボード貼り付け、リサイズハンドル
  - 検索/置換 UI（正規表現サポート）
  - ルビ、色指定（カラーピッカー）等の拡張

#### Editor の拡張（Tiptap）
- 必要な拡張:
  - `StarterKit` (基本)
  - `BulletList/OrderedList` (リスト)
  - `Blockquote`, `CodeBlock`（言語指定含む）
  - `Image` (カスタム属性: id, widthPercent)
  - `TextStyle` (color, background)
  - カスタム `Ruby` extension（ルビ）
  - `Heading` 拡張に `data-header-level` 属性を保持して metadata との同期を容易に
- Undo/Redo: Tiptap の履歴プラグインを利用。フローチャートの操作は個別履歴だが、UIは Ctrl+Z/Ctrl+Y をグローバルに監視して各モジュールへ伝播。

## 9. ストア設計（Zustand）
- ファイル: `useStore.ts`
- 型: `AppState`

```ts
interface AppState {
  documentId?: string;
  title: string;
  contentMd: string;
  metadata: MetadataJson;
  nodes: Record<string, NodeData>;
  edges: Record<string, EdgeData>;
  editor: { cursor?: number; scrollTop?: number };
  ui: { leftOutlineOpen: boolean; theme: 'light'|'dark' };
  // アクション
  setContentMd: (md: string) => void;
  updateNode: (id: string, patch: Partial<NodeData>) => void;
  addNode: (node: NodeData) => void;
  removeNode: (id: string) => void;
  addEdge: (edge: EdgeData) => void;
  removeEdge: (id: string) => void;
  saveToIndexedDB: () => Promise<void>;
  exportZip: () => Promise<Blob>;
}
```

- 同期頻度: Editor からの更新は**デバウンス**（300ms）でストアへ流す。フローチャートの座標更新はドラッグ時はローカル表示のみ、ドラッグ終了時にまとめて保存。

## 10. Markdown ↔ フローチャート同期
- ルール:
  - Editor の H1..H4 をパーサーで検出して `NodeData` を生成/更新する。
  - Node の `title` を編集すると該当の見出しテキストを Editor 内で更新。
  - 見出しの追加/削除はリアルタイムでノード追加/削除を行う。
- 実装:
  1. Editor の Document を変更（デバウンス 300ms）
  2. Markdown を構文解析（既存 Markdown AST ライブラリ `remark` 系統）で見出し列を抽出
  3. 現在の nodes と比較して差分（追加/削除/変更）を決定
  4. 差分を反映して store を更新

## 11. グループ化（親子）ロジックと制約
### 11.1 グループ化操作
- ユーザーが child ノードを parent ノード上へドラッグ＆ドロップすることでグループ化
- 実装: ドロップイベントで `parentId` を設定。親領域への重なり判定は `bounding box` を使う。

### 11.2 循環防止（必須）
- ノード A を B の親にする際、B が A の先祖である場合は操作を拒否。
- 実装: 親チェーンを辿って存在チェック。見つかった場合は UI でトースト表示し、操作をキャンセル。

### 11.3 折りたたみ／展開時のレイアウト調整
- 折りたたみ時: 子ノードを非表示にし、親ノードのサイズは**展開前**のサイズを保持する（要件に合わせる）。
- 展開/折りたたみにより変化する幅と高さを算出し、キャンバス上の他ノードを自動移動して重なりを回避する。
- 衝突回避アルゴリズム（簡易）:
  1. 変更領域の AABB（axis-aligned bounding box）を計算
  2. 他ノードが重なっている場合、一定方向（右→下の優先）へオフセットを徐々に移動させる
  3. 再帰的に衝突を解消（深さ制限あり）
- 場合によってはレイアウトスナップ／グリッドを利用して安定した移動を行う。

## 12. 画像挿入／編集
- 画像挿入: ドラッグ＆ドロップ、クリップボード貼り付けに対応
- 画像は `assets/` に保存（IndexedDB の Blob 参照または ZIP エクスポート）
- リサイズ: UI 上は % 幅指定（例: 25%, 50%, 100%）で保持。実サイズは `Image` node 属性に保持。
- 画像削除: キー削除でノード削除（エディタの標準操作）

## 13. スタイル編集フローティングメニュー
- 選択範囲に対してテキスト直上にフローティングメニュー表示
- 表示要件:
  - メニューは選択範囲に被らない位置に出す（viewport 内に必ず表示）
  - 現在のスタイルがアイコンで活性表示
- メニュー項目: 太字、斜体、下線、箇条書き、番号リスト、引用、コード、見出しプルダウン、文字色（カラーピッカー）、ハイライト、ルビ
- カラーピッカー: RGB/HEX 入力をサポート

## 14. 検索・置換
- 検索: 正規表現対応、ハイライト（リアルタイム）
- 置換: 単一／一括（確認ダイアログ）
- 実装: Editor のテキストレンジを使って操作。Tiptap のドキュメント API で安全に置換する。

## 15. ファイル読み書きアルゴリズム
### 15.1 保存（ZIP エクスポート）
1. `contentMd` を取得
2. `metadata` を JSON にシリアライズ
3. `assets` をバイナリで収集
4. JSZip にファイルを追加
5. `viewer.html` をテンプレートで生成（読み取り専用用）
6. generateAsync -> Blob を FileSaver でダウンロード

### 15.2 読込（ZIP インポート）
1. 選択された ZIP を JSZip で読み込む
2. `content.md`, `metadata.json` を検査。必須ファイルがなければエラー
3. assets を `assets/` に展開し、IndexedDB に Blob とメタを保存
4. store に metadata と content をロード

## 16. ビューア（viewer.html）生成仕様
- 目的: ZIP を展開せず、ダブルクリックで読み取り専用に開ける HTML を提供
- 実装要点:
  - 単一ファイルで参照される相対パスを使用
  - 編集用スクリプトは含めず、最小限の読み込みでレンダリング
  - XSS リスク低減のため HTML はサニタイズ済み

## 17. i18n（国際化）
- ライブラリ: i18next + react-i18next
- 設計: `locales/{lang}/common.json` 形式。現状は `ja/` を含む。
- 将来対応: 英語追加時は `locales/en` を追加するだけで UI テキストが切替可能

## 18. ショートカット一覧（主要）
- Ctrl/Cmd + Z : Undo
- Ctrl/Cmd + Y or Ctrl+Shift+Z : Redo
- Ctrl/Cmd + S : 保存（IndexedDB に保存 / PWA はオフライン対応）
- Ctrl/Cmd + O : 開く（Zip インポートダイアログ）
- Ctrl/Cmd + F : 検索
- Ctrl/Cmd + B : 太字
- Ctrl/Cmd + I : 斜体
- Ctrl/Cmd + K : リンク挿入

## 19. セキュリティ（XSS対策）
- 保存/読み込み時に `content.md` の HTML 変換結果は必ずサニタイズ（DOMPurify）
- `viewer.html` はインラインスクリプトを除去し、外部スクリプト参照をしない（安全な CSS + HTML でレンダリング）

## 20. エラーハンドリング
- 保存失敗、パースエラー時はユーザーへ詳細メッセージを表示し、該当箇所をハイライト（可能なら）
- 例外は Sentry 等の外部送信は行わない（ローカルのみ）。ログは IndexedDB の `error_logs` ストアへ保存可能。

## 21. テスト計画
- 単体テスト: 各ユーティリティ（Markdown パーサ、ZIP処理、循環チェックなど）に Jest
- 結合テスト: Editor ↔ Flow の同期シナリオ
- E2E: Playwright のシナリオ（ファイル保存/読み込み、画像貼付、グループ化、折りたたみ、検索/置換）
- アクセシビリティ: axe-core を用いた自動チェック

## 22. パフォーマンス最適化
- エディタ変更はデバウンス 300ms
- フローチャートのノード大規模時は仮想化（ノードのレンダリングを遅延）
- 非同期処理は Web Worker を検討（大規模 Markdown 解析 / ZIP 圧縮）

## 23. CI / デリバリ
- GitHub Actions: Lint(ESLint), TypeCheck(tsc), Unit Tests, E2E (scheduled / PR)
- Release: Vite ビルド → GitHub Releases（dist）, または単一 `index.html` 配布

## 24. 開発者向け引き渡し（AI仕様駆動向け）
- 提供ファイル:
  - TypeScript インターフェースファイル（`types.ts`）
  - JSON スキーマ（metadata.json の schema）
  - Component API ドキュメント（各コンポーネントの Props / Events / CSS 変数）
  - Playwright の E2E シナリオ（YAML/TS）
- コード生成向けメタデータ
  - 各コンポーネントの `props` 型、`events` 名、`store` の操作名を一覧化した JSON を提供してください。

---

# 付録 — 主要 TypeScript 型定義（推奨実装）
```ts
// types.ts
export type Lang = 'ja' | 'en';

export interface TextStyleConfig { fontFamily?: string; fontSize?: number; color?: string; background?: string }

export interface NodeData {
  id: string;
  title: string;
  headerLevel: number; // 1..4
  x: number; y: number; width: number; height: number;
  style?: { bg?: string; border?: string; textColor?: string };
  parent?: string | null;
  children?: string[];
  folded?: boolean;
}

export interface EdgeData { id: string; source: string; target: string; label?: string; style?: any }

export interface MetadataJson { version: string; createdAt: string; updatedAt: string; editor: any; flowchart: { nodes: NodeData[]; edges: EdgeData[] } }

export interface AppState {
  documentId?: string;
  title: string;
  contentMd: string;
  metadata: MetadataJson;
  nodes: Record<string, NodeData>;
  edges: Record<string, EdgeData>;
  // actions...
}
```

---

# 引き渡しチェックリスト（開発チーム向け）
1. この設計書（本ドキュメント）をリポジトリの `docs/` に配置
2. `types.ts` と `json-schema` を作成
3. コンポーネント一覧に従ってスキャフォールドを生成（React + Vite）
4. Tiptap の拡張（Image, Ruby, TextStyle）を実装
5. React Flow のカスタム node/edge を実装
6. ZIP のエクスポート/インポートを実装
7. viewer.html テンプレートを実装
8. E2E テストを作成

---

# 参考資料（プロジェクト内）
- 要件定義: `/mnt/data/要件定義.txt`
- システム設計（草案）: `/mnt/data/system_design.md`
- UI デザイン: `/mnt/data/ui_design.md`

---

以上。必要なら別フォーマット（PDF / Excel）に変換して出力します。変更点や追加要望があればそのまま反映して更新します。

