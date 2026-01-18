import { Sanitizer } from './sanitizer.js';

/**
 * ストレージロジック (ZIP)
 * プロジェクトの保存と読み込みを管理します。
 * 
 * 責務:
 * - ZIPファイルへのプロジェクト保存
 * - ZIPファイルからのプロジェクト読み込み
 * - 画像アセットの管理（Base64/ZIP内パス変換）
 * - メタデータ（タイトル、設定等）の永続化
 */
export class StorageManager {
  // ========================================
  // 初期化
  // ========================================

  /**
   * @param {import('./editorTiptap.js').EditorManager} editorManager 
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

    // File System Access API のサポート状況
    this.supportsFileSystemAccess = 'showSaveFilePicker' in window;

    this._init();
  }

  /**
   * イベントリスナーを初期化します。
   * @private
   */
  _init() {
    // 保存・読み込みボタン
    this._addEventListenerIfExists('saveBtn', 'click', () => this.save());
    this._addEventListenerIfExists('loadBtn', 'click', () => this.triggerLoad());

    // 非表示のファイル入力を作成（フォールバック用）
    this._createHiddenFileInput();

    // キーボードショートカット
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        this.save();
      }
    });

    // タイトル編集機能
    this._initTitleEditing();

    // 前回のファイル名を復元
    this._restoreLastFilename();
  }

  /**
   * 前回保存/読み込みしたファイル名を復元します。
   * @private
   */
  _restoreLastFilename() {
    const lastFilename = localStorage.getItem('ieditweb-last-filename');
    if (lastFilename) {
      this.filename = lastFilename;
    }
  }

  /**
   * 要素が存在する場合のみイベントリスナーを追加します。
   * @private
   */
  _addEventListenerIfExists(elementId, eventType, handler) {
    const element = document.getElementById(elementId);
    if (element) {
      element.addEventListener(eventType, handler);
    }
  }

  /**
   * 非表示のファイル入力を作成します。
   * @private
   */
  _createHiddenFileInput() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.zip';
    input.id = 'hidden-file-input';
    input.style.display = 'none';
    input.addEventListener('change', (e) => this.load(e));
    document.body.appendChild(input);
  }

  // ========================================
  // タイトル管理
  // ========================================

  /**
   * タイトル編集機能を初期化します。
   * @private
   */
  _initTitleEditing() {
    const filenameEl = document.getElementById('filename');
    if (filenameEl) {
      filenameEl.addEventListener('click', () => this._startTitleEdit());
    }
  }

  /**
   * タイトル編集モードを開始します。
   * @private
   */
  _startTitleEdit() {
    const filenameEl = document.getElementById('filename');
    if (!filenameEl || filenameEl.querySelector('input')) return;

    const currentTitle = this.title;
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentTitle;
    input.className = 'title-edit-input';

    filenameEl.textContent = '';
    filenameEl.appendChild(input);
    input.focus();
    input.select();

    const confirmEdit = () => {
      const newTitle = input.value.trim() || '無題のドキュメント';
      this.setTitle(newTitle);
    };

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        input.blur();
      } else if (e.key === 'Escape') {
        this.setTitle(currentTitle);
      }
    });

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
    this.filename = this._sanitizeFilename(title) + '.zip';
  }

  /**
   * ファイル名に使用できない文字を置換します。
   * @private
   * @param {string} filename - 元のファイル名
   * @returns {string} サニタイズされたファイル名
   */
  _sanitizeFilename(filename) {
    if (!filename || typeof filename !== 'string') {
      return 'document';
    }
    return filename
      .replace(/[/\\:*?"<>|]/g, '_')
      .replace(/\s+/g, ' ')
      .trim() || 'document';
  }

  /**
   * ファイル選択ダイアログを開きます。
   * File System Access API が利用可能な場合はネイティブダイアログを使用します。
   */
  async triggerLoad() {
    if (this.supportsFileSystemAccess) {
      await this._loadWithFilePicker();
    } else {
      // フォールバック: 従来の input[type=file]
      const input = document.getElementById('hidden-file-input');
      if (input) {
        input.click();
      }
    }
  }

  /**
   * File System Access API を使用してファイルを読み込みます。
   * @private
   */
  async _loadWithFilePicker() {
    try {
      const [handle] = await window.showOpenFilePicker({
        types: [{
          description: 'ZIPファイル',
          accept: { 'application/zip': ['.zip'] }
        }],
        multiple: false
      });

      const file = await handle.getFile();
      this.filename = file.name;

      // ファイルを処理
      await this._processLoadedFile(file);

      // ファイル名を localStorage に保存
      localStorage.setItem('ieditweb-last-filename', file.name);

    } catch (error) {
      if (error.name === 'AbortError') {
        // ユーザーがキャンセルした場合は何もしない
        return;
      }
      console.error('読み込みエラー:', error);
      alert('読み込みに失敗しました: ' + error.message);
    }
  }

  // ========================================
  // 保存機能
  // ========================================

  /**
   * プロジェクトをZIPファイルとして保存します。
   * File System Access API が利用可能な場合は「名前を付けて保存」ダイアログを表示します。
   */
  async save() {
    try {
      const zip = new JSZip();
      const imgFolder = zip.folder('assets');

      // エディタコンテンツを取得し、画像を処理
      const editorContent = await this._processEditorContentForSave(imgFolder);

      // 背景画像を処理
      const settings = await this._processSettingsForSave(zip);

      // メタデータを作成
      const metadata = this._createMetadata(settings);

      // ZIPに各ファイルを追加
      zip.file('editor.html', editorContent);
      zip.file('content.md', this._getEditorPlainText());
      zip.file('metadata.json', JSON.stringify(metadata, null, 2));

      // ZIPを生成
      const content = await zip.generateAsync({ type: 'blob' });

      // File System Access API が利用可能な場合は「名前を付けて保存」
      if (this.supportsFileSystemAccess) {
        await this._saveWithFilePicker(content);
      } else {
        // フォールバック: 従来のダウンロード
        saveAs(content, this.filename);
      }

    } catch (error) {
      if (error.name === 'AbortError') {
        // ユーザーがキャンセルした場合は何もしない
        return;
      }
      console.error('保存エラー:', error);
      alert('保存に失敗しました: ' + error.message);
    }
  }

  /**
   * File System Access API を使用してファイルを保存します。
   * 毎回「名前を付けて保存」ダイアログを表示します。
   * @private
   * @param {Blob} blob - 保存するデータ
   */
  async _saveWithFilePicker(blob) {
    const options = {
      suggestedName: this.filename,
      types: [{
        description: 'ZIPファイル',
        accept: { 'application/zip': ['.zip'] }
      }]
    };

    // 保存ダイアログを表示
    const fileHandle = await window.showSaveFilePicker(options);
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();

    // タイトルとファイル名を更新
    const newFilename = fileHandle.name;
    const titleFromFilename = newFilename.replace(/\.zip$/i, '');
    this.setTitle(titleFromFilename);

    // ファイル名を localStorage に保存
    localStorage.setItem('ieditweb-last-filename', newFilename);
    console.log('ファイルを保存しました:', newFilename);
  }


  /**
   * エディタコンテンツを処理し、画像をZIPに追加します。
   * @private
   * @param {JSZip} imgFolder - 画像フォルダ
   * @returns {Promise<string>} 処理済みのHTMLコンテンツ
   */
  async _processEditorContentForSave(imgFolder) {
    // Tiptap APIを通じてHTMLを取得
    const html = this.editorManager.getContent();

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    const images = tempDiv.querySelectorAll('img');

    images.forEach((img, index) => {
      const src = img.getAttribute('src');
      if (src && src.startsWith('data:')) {
        const { filename, data } = this._extractImageData(src, index);
        imgFolder.file(filename, data, { base64: true });
        img.setAttribute('src', `assets/${filename}`);
      }
    });

    return tempDiv.innerHTML;
  }

  /**
   * Data URLから画像データを抽出します。
   * @private
   */
  _extractImageData(dataUrl, index) {
    const extension = dataUrl.split(';')[0].split('/')[1] || 'png';
    const filename = `image_${Date.now()}_${index}.${extension}`;
    const data = dataUrl.split(',')[1];
    return { filename, data };
  }

  /**
   * 設定を処理し、背景画像があればZIPに追加します。
   * @private
   */
  async _processSettingsForSave(zip) {
    const settings = this.settingsManager.getSettings();

    if (settings.backgroundImage && settings.backgroundImage.startsWith('data:')) {
      const bgImageFilename = 'assets/background.png';
      const bgData = settings.backgroundImage.split(',')[1];
      zip.file(bgImageFilename, bgData, { base64: true });
      settings.backgroundImage = bgImageFilename;
    } else if (!settings.backgroundImage) {
      settings.backgroundImage = null;
    }

    return settings;
  }

  /**
   * メタデータオブジェクトを作成します。
   * @private
   */
  _createMetadata(settings) {
    return {
      title: this.title,
      shapes: Array.from(this.flowchartApp.shapes.entries()),
      connections: this.flowchartApp.connections,
      zoomLevel: this.flowchartApp.zoomLevel || 1.0,
      settings: settings,
      customColors: this.editorManager.getCustomColors()
    };
  }

  /**
   * エディタのプレーンテキストを取得します。
   * @private
   */
  _getEditorPlainText() {
    const editor = document.getElementById('editor');
    return editor ? editor.innerText : '';
  }

  // ========================================
  // 読み込み機能
  // ========================================

  /**
   * ZIPファイルを読み込み、プロジェクトを復元します。
   * input[type=file] からの読み込み用（フォールバック）
   * @param {Event} e - ファイル入力イベント
   */
  async load(e) {
    const file = e.target.files[0];
    if (!file) return;

    this.filename = file.name;
    this.fileHandle = null; // input[type=file] からの読み込みはハンドルなし

    try {
      await this._processLoadedFile(file);

      // ファイル名を localStorage に保存
      localStorage.setItem('ieditweb-last-filename', file.name);

    } catch (error) {
      console.error('読み込みエラー:', error);
      alert('読み込みに失敗しました: ' + error.message);
    } finally {
      // ファイル入力をリセット
      e.target.value = '';
    }
  }

  /**
   * 読み込んだファイルを処理します。
   * @private
   * @param {File} file - 読み込むファイル
   */
  async _processLoadedFile(file) {
    const zip = await JSZip.loadAsync(file);

    // 各コンポーネントを順次復元
    await this._restoreEditorContent(zip);
    await this._restoreFlowchartData(zip);

    alert('読み込み完了');
  }

  /**
   * エディタコンテンツを復元します。
   * @private
   */
  async _restoreEditorContent(zip) {
    const editorFile = zip.file('editor.html');

    if (editorFile) {
      let editorHtml = await editorFile.async('string');
      editorHtml = await this._restoreImages(editorHtml, zip);

      // Tiptap APIを通じてコンテンツを設定
      this.editorManager.setContent(editorHtml);

    } else {
      // フォールバック: プレーンテキスト
      const mdFile = zip.file('content.md');
      if (mdFile) {
        const text = await mdFile.async('string');
        this.editorManager.setContent(`<p>${text}</p>`);
      }
    }
  }

  /**
   * HTML内の画像パスをBase64に復元します。
   * @private
   */
  async _restoreImages(html, zip) {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    const images = tempDiv.querySelectorAll('img');

    for (const img of images) {
      const src = img.getAttribute('src');
      if (src && src.startsWith('assets/')) {
        const imgFile = zip.file(src);
        if (imgFile) {
          const base64 = await imgFile.async('base64');
          const mimeType = this._getMimeType(src);
          img.src = `data:${mimeType};base64,${base64}`;
        }
      }
    }

    return tempDiv.innerHTML;
  }

  /**
   * ファイル拡張子からMIMEタイプを取得します。
   * @private
   */
  _getMimeType(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const mimeTypes = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'png': 'image/png'
    };
    return mimeTypes[ext] || 'image/png';
  }

  /**
   * フローチャートデータを復元します。
   * @private
   */
  async _restoreFlowchartData(zip) {
    const metadataFile = zip.file('metadata.json');
    if (!metadataFile) return;

    const json = await metadataFile.async('string');
    const data = JSON.parse(json);

    // タイトルを復元
    this._restoreTitle(data);

    // フローチャートを復元
    this._restoreFlowchart(data);

    // ズームレベルを復元
    this._restoreZoomLevel(data);

    // 設定を復元
    await this._restoreSettings(data, zip);

    // カスタムカラーを復元
    this._restoreCustomColors(data);
  }

  /**
   * タイトルを復元します。
   * @private
   */
  _restoreTitle(data) {
    if (data.title) {
      this.setTitle(data.title);
    } else {
      this.setTitle(this.filename.replace('.zip', ''));
    }
  }

  /**
   * フローチャートを復元します。
   * @private
   */
  _restoreFlowchart(data) {
    // 既存要素をクリア
    this.flowchartApp.shapesLayer.innerHTML = '';
    this.flowchartApp.connectionsLayer.querySelectorAll('path, text').forEach(el => el.remove());

    // データを復元
    this.flowchartApp.shapes = new Map(data.shapes || []);
    this.flowchartApp.connections = data.connections || [];

    // DOM要素を再生成
    this.flowchartApp.shapes.forEach(shape => {
      this.flowchartApp.createShapeElement(shape);
      this.flowchartApp.updateShapeStyle(shape);

      if (shape.collapsed) {
        this.flowchartApp.setChildrenVisibility(shape, false);
        const toggle = shape.element?.querySelector('.group-toggle');
        if (toggle) toggle.textContent = '+';
      }
    });

    this.flowchartApp.updateAllZIndexes();
    this.flowchartApp.drawConnections();
    this.flowchartApp.updateCanvasSize();
  }

  /**
   * ズームレベルを復元します。
   * @private
   */
  _restoreZoomLevel(data) {
    if (data.zoomLevel && this.flowchartApp.canvasContent) {
      this.flowchartApp.zoomLevel = data.zoomLevel;
      this.flowchartApp.canvasContent.style.transform = `scale(${data.zoomLevel})`;
      this.flowchartApp.canvasContent.style.transformOrigin = 'top left';
    }
  }

  /**
   * 設定を復元します。
   * @private
   */
  async _restoreSettings(data, zip) {
    if (!data.settings) return;

    const settings = data.settings;

    // 背景画像がZIP内パスの場合はBase64に変換
    if (settings.backgroundImage && !settings.backgroundImage.startsWith('data:')) {
      const bgFile = zip.file(settings.backgroundImage);
      if (bgFile) {
        const bgBase64 = await bgFile.async('base64');
        settings.backgroundImage = `data:image/png;base64,${bgBase64}`;
      } else {
        settings.backgroundImage = null;
      }
    }

    this.settingsManager.importSettings(settings);
  }

  /**
   * カスタムカラーを復元します。
   * @private
   */
  _restoreCustomColors(data) {
    if (!data.customColors) return;

    // 新形式（オブジェクト）
    if (data.customColors.text || data.customColors.highlight) {
      this.editorManager.setCustomColors(data.customColors);
    }
    // 旧形式（配列）: 文字色として扱う
    else if (Array.isArray(data.customColors)) {
      this.editorManager.setCustomColors({
        text: data.customColors,
        highlight: []
      });
    }
  }
}
