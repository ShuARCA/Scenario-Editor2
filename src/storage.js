import { Sanitizer } from './sanitizer.js';

/**
 * ストレージロジック (ZIP)
 */
export class StorageManager {
  constructor(editorManager, flowchartApp) {
    this.editorManager = editorManager;
    this.flowchartApp = flowchartApp;
    this.sanitizer = new Sanitizer();
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
  }

  triggerLoad() {
    document.getElementById('hidden-file-input').click();
  }

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

    const processedEditorContent = tempDiv.innerHTML;
    const flowchartContent = document.getElementById('flowchart-canvas').innerHTML;
    const filename = this.filename.replace('.zip', '');

    // ビューワー用HTML構築
    const viewerHtml = `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>${filename}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    ${combinedCss}
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
    <div id="filename">${filename}</div>
  </header>
  <div id="container">
    <main id="main-content">
      <div id="flowchart-container" style="height: 40%; min-height: 200px;">
        <div id="flowchart-canvas">
          ${flowchartContent}
        </div>
      </div>
      <div id="editor-container">
        <div id="editor">
          ${processedEditorContent}
        </div>
      </div>
    </main>
  </div>
</body>
</html>`;

    zip.file("content.html", viewerHtml);
    zip.file("content.md", document.getElementById('editor').innerText); // フォールバック

    // 2. メタデータ
    const metadata = {
      shapes: Array.from(this.flowchartApp.shapes.entries()),
      connections: this.flowchartApp.connections
    };
    zip.file("metadata.json", JSON.stringify(metadata, null, 2));

    // ZIPの生成
    const content = await zip.generateAsync({ type: "blob" });
    saveAs(content, this.filename);
  }

  async load(e) {
    const file = e.target.files[0];
    if (!file) return;
    this.filename = file.name;

    try {
      const zip = await JSZip.loadAsync(file);

      // HTMLの読み込み
      const htmlFile = zip.file("content.html");
      if (htmlFile) {
        let html = await htmlFile.async("string");

        // 画像の復元 (assetsフォルダから読み込んでdataURLに戻す)
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const images = doc.querySelectorAll('img');

        for (const img of images) {
          const src = img.getAttribute('src');
          if (src && src.startsWith('assets/')) {
            const imgFile = zip.file(src);
            if (imgFile) {
              const base64 = await imgFile.async('base64');
              const mimeType = src.endsWith('.png') ? 'image/png' : 'image/jpeg'; // 簡易判定
              img.src = `data:${mimeType};base64,${base64}`;
            }
          }
        }

        // サニタイズしてセット
        const cleanHtml = this.sanitizer.sanitize(doc.body.innerHTML);
        this.editorManager.editor.innerHTML = cleanHtml;

        // タイトル更新
        const h1 = this.editorManager.editor.querySelector('h1');
        if (h1) {
          document.getElementById('filename').textContent = h1.textContent;
        } else {
          document.getElementById('filename').textContent = this.filename.replace('.zip', '');
        }

        this.editorManager.updateOutline();
      } else if (zip.file("content.md")) {
        const text = await zip.file("content.md").async("string");
        this.editorManager.editor.innerText = text;
        this.editorManager.updateOutline();
      }

      // フローチャートデータの読み込み
      const flowFile = zip.file("flowchart.json") || zip.file("metadata.json"); // metadata.json for backward compatibility
      if (flowFile) {
        const json = await flowFile.async("string");
        const data = JSON.parse(json);

        // Mapに復元
        this.flowchartApp.shapes = new Map(data.shapes);
        this.flowchartApp.connections = data.connections || [];

        // DOM要素の再生成
        this.flowchartApp.shapesLayer.innerHTML = '';
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
        this.flowchartApp.drawConnections();
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
