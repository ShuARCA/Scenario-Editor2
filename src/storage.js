import { Sanitizer } from './sanitizer.js';

/**
 * ストレージロジック (ZIP)
 * プロジェクトの保存と読み込みを管理します。
 * 
 * 要件: 10.1, 10.2, 10.3, 10.4
 */
export class StorageManager {
  /**
   * @param {import('./editor.js').EditorManager} editorManager 
   * @param {import('./flowchart.js').FlowchartApp} flowchartApp 
   * @param {import('./settings.js').SettingsManager} settingsManager
   */
  constructor(editorManager, flowchartApp, settingsManager) {
    this.editorManager = editorManager;
    this.flowchartApp = flowchartApp;
    this.settingsManager = settingsManager;
    this.sanitizer = new Sanitizer();
    this.title = '無題のドキュメント';
    this.filename = 'document.zip';

    this.init();
  }

  init() {
    document.getElementById('saveBtn').addEventListener('click', () => this.save());
    document.getElementById('loadBtn').addEventListener('click', () => this.triggerLoad());

    // 非表示のファイル入力
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.zip';
    input.id = 'hidden-file-input';
    input.style.display = 'none';
    input.addEventListener('change', (e) => this.load(e));
    document.body.appendChild(input);

    // ショートカットキー
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        this.save();
      }
    });

    // タイトル編集機能の初期化
    this.initTitleEditing();
  }

  /**
   * タイトル編集機能を初期化します。
   * ヘッダーのタイトルをクリックすると編集モードに切り替わります。
   */
  initTitleEditing() {
    const filenameEl = document.getElementById('filename');
    if (!filenameEl) return;

    filenameEl.addEventListener('click', () => {
      this.startTitleEdit();
    });
  }

  /**
   * タイトル編集モードを開始します。
   */
  startTitleEdit() {
    const filenameEl = document.getElementById('filename');
    if (!filenameEl || filenameEl.querySelector('input')) return;

    const currentTitle = this.title;
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentTitle;
    input.className = 'title-edit-input';

    // 元のテキストを非表示にして入力フィールドを挿入
    filenameEl.textContent = '';
    filenameEl.appendChild(input);
    input.focus();
    input.select();

    // 確定時の処理
    const confirmEdit = () => {
      const newTitle = input.value.trim() || '無題のドキュメント';
      this.setTitle(newTitle);
    };

    // Enterキーで確定
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        input.blur();
      } else if (e.key === 'Escape') {
        // Escでキャンセル
        this.setTitle(currentTitle);
      }
    });

    // フォーカスアウトで確定
    input.addEventListener('blur', confirmEdit);
  }

  /**
   * タイトルを設定します。
   * @param {string} title - 新しいタイトル
   */
  setTitle(title) {
    this.title = title;
    const filenameEl = document.getElementById('filename');
    if (filenameEl) {
      filenameEl.textContent = title;
    }
    // ファイル名も更新（特殊文字をサニタイズ）
    this.filename = this.sanitizeFilename(title) + '.zip';
  }

  /**
   * ファイル名に使用できない文字を置換します。
   * @param {string} filename - 元のファイル名
   * @returns {string} サニタイズされたファイル名
   */
  sanitizeFilename(filename) {
    if (!filename || typeof filename !== 'string') {
      return 'document';
    }
    // Windowsで使用できない文字を置換
    return filename
      .replace(/[/\\:*?"<>|]/g, '_')
      .replace(/\s+/g, ' ')
      .trim() || 'document';
  }

  triggerLoad() {
    document.getElementById('hidden-file-input').click();
  }

  /**
   * ビューアHTMLを生成します。
   * 生成されるHTMLは読み取り専用のビューアとして機能し、
   * インラインスクリプトを含まない安全なHTML/CSSのみで構成されます。
   * 
   * 要件: 10.4
   * - ビューアHTMLはインラインスクリプトを含まない
   * - 安全なHTML/CSSのみで構成される
   * 
   * @param {string} editorContent - エディタのHTMLコンテンツ（サニタイズ済み）
   * @param {string} flowchartContent - フローチャートのHTMLコンテンツ
   * @param {string} css - 結合されたCSSスタイル
   * @param {Object} metadata - メタデータ
   * @param {string} metadata.title - ドキュメントタイトル
   * @returns {string} 生成されたビューアHTML
   */
  generateViewerHtml(editorContent, flowchartContent, css, metadata) {
    const { title } = metadata;

    // エディタコンテンツをサニタイズ（XSS対策）
    const sanitizedEditorContent = this.sanitizer.sanitize(editorContent);

    // フローチャートコンテンツもサニタイズ
    const sanitizedFlowchartContent = this.sanitizer.sanitize(flowchartContent);

    // ビューア用HTML構築（インラインスクリプトなし）
    const viewerHtml = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>${this.escapeHtml(title)}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    ${css}
    /* ビューワー用追加スタイル */
    body { overflow: auto; }
    #container { height: 100vh; }
    #flowchart-container { resize: none; border-bottom: 2px solid #ccc; }
    #editor { outline: none; }
    .flowchart-toolbar, .header-controls, #toggleSidebar, #float-toolbar { display: none !important; }
  </style>
</head>
<body>
  <header id="toolbar" style="justify-content: center;">
    <div id="filename">${this.escapeHtml(title)}</div>
  </header>
  <div id="container">
    <main id="main-content">
      <div id="flowchart-container" style="height: 40%; min-height: 200px;">
        <div id="flowchart-canvas">
          ${sanitizedFlowchartContent}
        </div>
      </div>
      <div id="editor-container">
        <div id="editor">
          ${sanitizedEditorContent}
        </div>
      </div>
    </main>
  </div>
</body>
</html>`;

    return viewerHtml;
  }

  /**
   * HTML特殊文字をエスケープします。
   * @param {string} text - エスケープ対象のテキスト
   * @returns {string} エスケープ後のテキスト
   */
  escapeHtml(text) {
    if (!text || typeof text !== 'string') {
      return '';
    }
    const escapeMap = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };
    return text.replace(/[&<>"']/g, char => escapeMap[char]);
  }

  /**
   * プロジェクトをZIPファイルとして保存します。
   * エディタの内容、フローチャートのデータ、画像アセットを同梱します。
   */
  async save() {
    const zip = new JSZip();
    const imgFolder = zip.folder("assets");

    // CSSの取得
    const cssFiles = ['styles/main.css', 'styles/editor.css', 'styles/flowchart.css'];
    const cssContents = await Promise.all(cssFiles.map(url => fetch(url).then(res => res.text())));
    const combinedCss = cssContents.join('\n');

    // エディタコンテンツの処理 (画像抽出)
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = document.getElementById('editor').innerHTML;
    const images = tempDiv.querySelectorAll('img');

    images.forEach((img, index) => {
      if (img.src.startsWith('data:')) {
        const extension = img.src.split(';')[0].split('/')[1];
        const filename = `image_${Date.now()}_${index}.${extension}`;

        // Data URL からデータを抽出して ZIP に追加
        const data = img.src.split(',')[1];
        imgFolder.file(filename, data, { base64: true });

        // src を相対パスに書き換え
        img.setAttribute('src', `assets/${filename}`);
      }
    });

    // 設定の保存 (ユーザー要望により全設定を保存)
    const settings = this.settingsManager.getSettings();

    // 背景画像の処理
    if (settings.backgroundImage && settings.backgroundImage.startsWith('data:')) {
      const bgImageFilename = 'assets/background.png';
      const bgData = settings.backgroundImage.split(',')[1];

      // PNGとして保存
      zip.file(bgImageFilename, bgData, { base64: true });

      // settingsオブジェクト内のパスを更新 (DataURLではなくZIP内パスを保存)
      settings.backgroundImage = bgImageFilename;
    } else {
      // 背景画像がない、またはDataURLでない場合はnullにしておく（あるいは既存のURLならそのまま）
      if (!settings.backgroundImage) {
        settings.backgroundImage = null;
      }
    }

    const processedEditorContent = tempDiv.innerHTML;
    const flowchartContent = document.getElementById('flowchart-canvas').innerHTML;

    // ビューワー用HTML構築（タイトルを使用）
    const viewerHtml = this.generateViewerHtml(
      processedEditorContent,
      flowchartContent,
      combinedCss,
      { title: this.title }
    );

    zip.file("content.html", viewerHtml);
    zip.file("content.md", document.getElementById('editor').innerText); // フォールバック

    // エディタ内容を個別に保存（読み込み用：画像パスは相対パスに変換済み）
    zip.file("editor.html", processedEditorContent);

    // フローチャートメタデータ（タイトルを含む）
    const metadata = {
      title: this.title,
      shapes: Array.from(this.flowchartApp.shapes.entries()),
      connections: this.flowchartApp.connections,
      zoomLevel: this.flowchartApp.zoomLevel || 1.0,
      settings: settings // 全設定を保存
    };
    zip.file("metadata.json", JSON.stringify(metadata, null, 2));

    // ZIPの生成
    const content = await zip.generateAsync({ type: "blob" });
    saveAs(content, this.filename);
  }

  /**
   * ZIPファイルを読み込み、プロジェクトを復元します。
   * @param {Event} e - ファイル入力イベント
   */
  async load(e) {
    const file = e.target.files[0];
    if (!file) return;
    this.filename = file.name;

    try {
      const zip = await JSZip.loadAsync(file);

      // エディタ内容の読み込み（editor.htmlから復元）
      const editorFile = zip.file("editor.html");
      if (editorFile) {
        let editorHtml = await editorFile.async("string");

        // 画像の復元 (assetsフォルダから読み込んでdataURLに戻す)
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = editorHtml;
        const images = tempDiv.querySelectorAll('img');

        for (const img of images) {
          const src = img.getAttribute('src');
          if (src && src.startsWith('assets/')) {
            const imgFile = zip.file(src);
            if (imgFile) {
              const base64 = await imgFile.async('base64');
              const ext = src.split('.').pop().toLowerCase();
              let mimeType = 'image/png';
              if (ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg';
              else if (ext === 'gif') mimeType = 'image/gif';
              else if (ext === 'webp') mimeType = 'image/webp';
              img.src = `data:${mimeType};base64,${base64}`;
            }
          }
        }

        // サニタイズしてセット
        const cleanHtml = this.sanitizer.sanitize(tempDiv.innerHTML);
        this.editorManager.editor.innerHTML = cleanHtml;

        this.editorManager.updateOutline();
      } else if (zip.file("content.md")) {
        // フォールバック: プレーンテキスト
        const text = await zip.file("content.md").async("string");
        this.editorManager.editor.innerText = text;
        this.editorManager.updateOutline();
      }

      // フローチャートデータの読み込み
      const flowFile = zip.file("metadata.json");
      if (flowFile) {
        const json = await flowFile.async("string");
        const data = JSON.parse(json);

        // タイトルの復元（metadata.jsonに保存されたタイトルを優先）
        if (data.title) {
          this.setTitle(data.title);
        } else {
          // フォールバック: ファイル名から復元
          this.setTitle(this.filename.replace('.zip', ''));
        }

        // 既存のフローチャート要素をクリア
        this.flowchartApp.shapesLayer.innerHTML = '';
        this.flowchartApp.connectionsLayer.querySelectorAll('path, text').forEach(el => el.remove());

        // Mapに復元
        this.flowchartApp.shapes = new Map(data.shapes);
        this.flowchartApp.connections = data.connections || [];

        // ズームレベルの復元
        if (data.zoomLevel) {
          this.flowchartApp.zoomLevel = data.zoomLevel;
          if (this.flowchartApp.canvasContent) {
            this.flowchartApp.canvasContent.style.transform = `scale(${data.zoomLevel})`;
            this.flowchartApp.canvasContent.style.transformOrigin = 'top left';
          }
        }

        // DOM要素の再生成
        this.flowchartApp.shapes.forEach(shape => {
          this.flowchartApp.createShapeElement(shape);
          // グループ化状態の復元
          this.flowchartApp.updateShapeStyle(shape);
          // 折りたたみ状態の復元
          if (shape.collapsed) {
            this.flowchartApp.setChildrenVisibility(shape, false);
            const toggle = shape.element.querySelector('.group-toggle');
            if (toggle) toggle.textContent = '+';
          }
        });

        // z-indexの更新
        this.flowchartApp.updateAllZIndexes();

        this.flowchartApp.drawConnections();

        // キャンバスサイズの更新
        this.flowchartApp.updateCanvasSize();

        // 設定の復元
        if (data.settings) {
          const settings = data.settings;
          // 背景画像の復元 (ZIP内パスの場合)
          if (settings.backgroundImage && !settings.backgroundImage.startsWith('data:')) {
            const bgFile = zip.file(settings.backgroundImage);
            if (bgFile) {
              const bgBase64 = await bgFile.async('base64');
              // mimeTypeは簡易的にpngとする
              settings.backgroundImage = `data:image/png;base64,${bgBase64}`;
            } else {
              // ファイルが見つからない場合はnull
              settings.backgroundImage = null;
            }
          }
          // 設定の一括適用
          this.settingsManager.importSettings(settings);
        } else if (data.backgroundImage) {
          // 後方互換性 (古い形式で保存された背景画像)
          // ユーザー要件では互換性不要とのことだが、念のため残しておくか、削除するか。
          // 指示には「互換性は持たせなくてよい」とあるので、古いフィールドのみの場合は無視する実装も可だが、
          // ここでは念のため残しておき、settingsオブジェクト形式に変換して適用する
          const bgFile = zip.file(data.backgroundImage);
          if (bgFile) {
            const bgBase64 = await bgFile.async('base64');
            this.settingsManager.importSettings({
              backgroundImage: `data:image/png;base64,${bgBase64}`
            });
          }
        }
      }

      alert('読み込み完了');
    } catch (err) {
      console.error(err);
      alert('読み込みに失敗しました: ' + err.message);
    }

    // inputをリセット
    e.target.value = '';
  }
}
