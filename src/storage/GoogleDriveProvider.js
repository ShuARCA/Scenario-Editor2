/**
 * Google Drive プロバイダー
 * Google Drive API を使用したファイルの保存・読み込みを管理します。
 *
 * 責務:
 * - GIS (Google Identity Services) による認証フロー管理
 * - GAPI クライアントライブラリの初期化
 * - Google Drive API を使用したファイルの読み書き
 * - Google Picker によるファイル選択UI
 *
 * 必要な外部スクリプト (index.html に記載):
 * - https://accounts.google.com/gsi/client
 * - https://apis.google.com/js/api.js
 */

// ========================================
// 定数
// ========================================

/** Google Cloud Console で取得した OAuth 2.0 クライアントID */
const CLIENT_ID = '702245562904-32p57rnr2t8pk270lvpo3d57ojp386mj.apps.googleusercontent.com';

/** Google Cloud Console で取得した API キー */
const API_KEY = 'AIzaSyDxjpNKu29RFrshEbx_U0cw-WHkdcjaSSs';

/** Google Drive API で要求するスコープ */
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

/** Google Drive API のディスカバリーDoc URL */
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';

/** Google Picker のアプリID（通常はクライアントIDのプロジェクト番号） */
const APP_ID = '';

// ========================================
// GoogleDriveProvider クラス
// ========================================

export class GoogleDriveProvider {
    constructor() {
        /** @type {boolean} GAPI クライアントが初期化済みか */
        this._gapiInitialized = false;

        /** @type {boolean} GIS トークンクライアントが初期化済みか */
        this._gisInitialized = false;

        /** @type {Object|null} GIS tokenClient インスタンス */
        this._tokenClient = null;

        /** @type {string|null} 現在のアクセストークン */
        this._accessToken = null;

        /** @type {Function|null} 認証完了時のコールバック（resolveを一時保持） */
        this._authResolve = null;

        /** @type {Function|null} 認証失敗時のコールバック（rejectを一時保持） */
        this._authReject = null;
    }

    // ========================================
    // 初期化
    // ========================================

    /**
     * GIS/GAPI スクリプトをロードし、クライアントを初期化します。
     * 2回目以降の呼び出しは何もしません。
     * @returns {Promise<void>}
     */
    async initialize() {
        if (this._gapiInitialized && this._gisInitialized) {
            return;
        }

        // GAPI の初期化
        if (!this._gapiInitialized) {
            await this._initGapiClient();
        }

        // GIS の初期化
        if (!this._gisInitialized) {
            this._initGisClient();
        }
    }

    /**
     * GAPI クライアントライブラリを初期化します。
     * @private
     * @returns {Promise<void>}
     */
    async _initGapiClient() {
        await this._waitForGapi();

        await new Promise((resolve, reject) => {
            gapi.load('client:picker', {
                callback: resolve,
                onerror: () => reject(new Error('GAPI クライアントの読み込みに失敗しました')),
            });
        });

        await gapi.client.init({
            apiKey: API_KEY,
            discoveryDocs: [DISCOVERY_DOC],
        });

        this._gapiInitialized = true;
    }

    /**
     * GIS トークンクライアントを初期化します。
     * @private
     */
    _initGisClient() {
        this._waitForGis();

        this._tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID,
            scope: SCOPES,
            callback: (response) => this._onTokenResponse(response),
            error_callback: (error) => this._onTokenError(error),
        });

        this._gisInitialized = true;
    }

    /**
     * gapi がグローバルに利用可能になるまで待機します。
     * @private
     * @returns {Promise<void>}
     */
    _waitForGapi() {
        return new Promise((resolve, reject) => {
            if (typeof gapi !== 'undefined') {
                resolve();
                return;
            }

            let attempts = 0;
            const maxAttempts = 50; // 最大5秒待機
            const interval = setInterval(() => {
                attempts++;
                if (typeof gapi !== 'undefined') {
                    clearInterval(interval);
                    resolve();
                } else if (attempts >= maxAttempts) {
                    clearInterval(interval);
                    reject(new Error(
                        'Google API スクリプトが読み込まれていません。\n' +
                        'index.html に <script src="https://apis.google.com/js/api.js"> が追加されているか確認してください。'
                    ));
                }
            }, 100);
        });
    }

    /**
     * GIS (google.accounts) がグローバルに利用可能になるまで待機します。
     * @private
     */
    _waitForGis() {
        if (typeof google === 'undefined' || !google.accounts) {
            throw new Error(
                'Google Identity Services スクリプトが読み込まれていません。\n' +
                'index.html に <script src="https://accounts.google.com/gsi/client"> が追加されているか確認してください。'
            );
        }
    }

    // ========================================
    // 認証
    // ========================================

    /**
     * GIS トークンのコールバック処理。
     * @private
     * @param {Object} response - トークンレスポンス
     */
    _onTokenResponse(response) {
        if (response.error) {
            if (this._authReject) {
                this._authReject(new Error(`認証エラー: ${response.error}`));
                this._authReject = null;
                this._authResolve = null;
            }
            return;
        }

        this._accessToken = response.access_token;

        if (this._authResolve) {
            this._authResolve();
            this._authResolve = null;
            this._authReject = null;
        }
    }

    /**
     * GIS トークンリクエストのエラーコールバック。
     * @private
     * @param {Object} error - エラーオブジェクト
     */
    _onTokenError(error) {
        if (error.type === 'popup_closed' || error.type === 'popup_failed_to_open') {
            // ユーザーがポップアップを閉じた場合はキャンセル扱い
            if (this._authReject) {
                const cancelError = new Error('認証がキャンセルされました');
                cancelError.name = 'AbortError';
                this._authReject(cancelError);
                this._authReject = null;
                this._authResolve = null;
            }
            return;
        }

        if (this._authReject) {
            this._authReject(new Error(`認証エラー: ${error.type || '不明なエラー'}`));
            this._authReject = null;
            this._authResolve = null;
        }
    }

    /**
     * ユーザー認証を要求します。
     * 既に有効なトークンがある場合はスキップします。
     * @returns {Promise<void>}
     */
    async authenticate() {
        await this.initialize();

        // 既に有効なトークンがあればスキップ
        if (this._accessToken && gapi.client.getToken()) {
            return;
        }

        return new Promise((resolve, reject) => {
            this._authResolve = resolve;
            this._authReject = reject;
            this._tokenClient.requestAccessToken({ prompt: '' });
        });
    }

    /**
     * 認証済みかどうかを返します。
     * @returns {boolean}
     */
    isAuthenticated() {
        return !!this._accessToken;
    }

    // ========================================
    // ファイル操作
    // ========================================

    /**
     * ZIP ファイルを Google Drive に保存します。
     *
     * @param {Blob} blob - 保存するZIPデータ
     * @param {string} filename - ファイル名
     * @param {string|null} [existingFileId=null] - 既存ファイルIDがある場合は上書き
     * @returns {Promise<{id: string, name: string}>} 保存されたファイルの情報
     */
    async saveFile(blob, filename, existingFileId = null) {
        await this.authenticate();

        if (existingFileId) {
            return this._updateFile(existingFileId, blob, filename);
        } else {
            return this._createFile(blob, filename);
        }
    }

    /**
     * Google Drive にファイルを新規作成します。
     * @private
     * @param {Blob} blob - ファイルデータ
     * @param {string} filename - ファイル名
     * @returns {Promise<{id: string, name: string}>}
     */
    async _createFile(blob, filename) {
        const metadata = {
            name: filename,
            mimeType: 'application/zip',
        };

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', blob);

        const response = await fetch(
            'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name',
            {
                method: 'POST',
                headers: { Authorization: `Bearer ${this._accessToken}` },
                body: form,
            }
        );

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`Google Drive への保存に失敗しました: ${errorData.error?.message || response.statusText}`);
        }

        return response.json();
    }

    /**
     * Google Drive 上の既存ファイルを上書き更新します。
     * @private
     * @param {string} fileId - 更新対象のファイルID
     * @param {Blob} blob - ファイルデータ
     * @param {string} filename - ファイル名
     * @returns {Promise<{id: string, name: string}>}
     */
    async _updateFile(fileId, blob, filename) {
        const metadata = {
            name: filename,
        };

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', blob);

        const response = await fetch(
            `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart&fields=id,name`,
            {
                method: 'PATCH',
                headers: { Authorization: `Bearer ${this._accessToken}` },
                body: form,
            }
        );

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`Google Drive の更新に失敗しました: ${errorData.error?.message || response.statusText}`);
        }

        return response.json();
    }

    /**
     * Google Drive からファイルをダウンロードします。
     *
     * @param {string} fileId - ダウンロード対象のファイルID
     * @returns {Promise<{blob: Blob, name: string}>} ファイルのBlobと名前
     */
    async loadFile(fileId) {
        await this.authenticate();

        // ファイルメタデータを取得（ファイル名用）
        const metaResponse = await fetch(
            `https://www.googleapis.com/drive/v3/files/${fileId}?fields=name`,
            {
                headers: { Authorization: `Bearer ${this._accessToken}` },
            }
        );

        if (!metaResponse.ok) {
            throw new Error('Google Drive からファイル情報の取得に失敗しました');
        }

        const meta = await metaResponse.json();

        // ファイルコンテンツをダウンロード
        const contentResponse = await fetch(
            `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
            {
                headers: { Authorization: `Bearer ${this._accessToken}` },
            }
        );

        if (!contentResponse.ok) {
            throw new Error('Google Drive からファイルのダウンロードに失敗しました');
        }

        const blob = await contentResponse.blob();
        return { blob, name: meta.name };
    }

    /**
     * Google Picker を表示し、ユーザーにファイルを選択させます。
     * .zip ファイルのみを表示します。
     *
     * @returns {Promise<{id: string, name: string}|null>} 選択されたファイル情報、キャンセル時はnull
     */
    async pickFile() {
        await this.authenticate();

        return new Promise((resolve) => {
            const view = new google.picker.DocsView(google.picker.ViewId.DOCS);
            view.setMimeTypes('application/zip');
            view.setMode(google.picker.DocsViewMode.LIST);

            const picker = new google.picker.PickerBuilder()
                .addView(view)
                .setOAuthToken(this._accessToken)
                .setDeveloperKey(API_KEY)
                .setCallback((data) => {
                    if (data.action === google.picker.Action.PICKED) {
                        const file = data.docs[0];
                        resolve({ id: file.id, name: file.name });
                    } else if (data.action === google.picker.Action.CANCEL) {
                        resolve(null);
                    }
                })
                .setTitle('Google Drive からファイルを選択')
                .build();

            if (APP_ID) {
                // APP_ID が設定されている場合のみ指定
                // PickerBuilder に setAppId がない場合もあるため安全にチェック
            }

            picker.setVisible(true);
        });
    }
}
