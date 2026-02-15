/**
 * Color Picker Component
 * 
 * Based on the implementation in color-picker.html
 */

/* ColorMath: 色変換・解析ユーティリティ */
const ColorMath = (() => {
    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
    const compHex = n => Math.round(clamp(n, 0, 255)).toString(16).padStart(2, '0').toUpperCase();
    const alphaHex = a => compHex(Math.round(clamp(a, 0, 1) * 255));
    const rgbaToHex = ({ r, g, b, a }, noAlpha = false) => '#' + compHex(r) + compHex(g) + compHex(b) + (noAlpha ? '' : alphaHex(a));

    /**
     * 色文字列を解析して {r, g, b, a} を返す
     * 対応形式: hex, rgb, rgba, transparent, createPattern (キャンバス経由の名前付きカラー)
     */
    function parseColor(str) {
        if (!str) return null;
        str = str.trim().toLowerCase();

        if (str === 'transparent') {
            return { r: 255, g: 255, b: 255, a: 0 };
        }

        // HEX (#RRGGBB / #RRGGBBAA)
        if (str.startsWith('#')) {
            const s = str.replace(/^#/, '');
            if (!(s.length === 6 || s.length === 8)) return null;
            if (!/^[0-9a-f]+$/.test(s)) return null;
            const r = parseInt(s.slice(0, 2), 16);
            const g = parseInt(s.slice(2, 4), 16);
            const b = parseInt(s.slice(4, 6), 16);
            const a = s.length === 8 ? parseInt(s.slice(6, 8), 16) / 255 : 1;
            return { r, g, b, a };
        }

        // RGBA / RGB
        if (str.startsWith('rgb')) {
            const match = str.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d\.]+))?\s*\)$/);
            if (match) {
                return {
                    r: parseInt(match[1]),
                    g: parseInt(match[2]),
                    b: parseInt(match[3]),
                    a: match[4] !== undefined ? parseFloat(match[4]) : 1
                };
            }
        }

        // フォールバック: Canvas APIを使用して名前付きカラー等を解析
        try {
            const ctx = document.createElement('canvas').getContext('2d');
            ctx.fillStyle = str;
            const fill = ctx.fillStyle;
            if (fill && fill !== '#000000') {
                // 省略時の黒(#000000)と、意図的な黒入力を区別
                if (fill === '#000000' && !['black', '#000', '#000000', 'rgb(0,0,0)', 'rgba(0,0,0,1)'].includes(str.replace(/\s+/g, ''))) {
                    return null;
                }
                if (fill.startsWith('#')) {
                    const r = parseInt(fill.slice(1, 3), 16);
                    const g = parseInt(fill.slice(3, 5), 16);
                    const b = parseInt(fill.slice(5, 7), 16);
                    return { r, g, b, a: 1 };
                }
                if (fill.startsWith('rgba')) {
                    const match = fill.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d\.]+))?\s*\)$/);
                    if (match) {
                        return {
                            r: parseInt(match[1]),
                            g: parseInt(match[2]),
                            b: parseInt(match[3]),
                            a: match[4] !== undefined ? parseFloat(match[4]) : 1
                        };
                    }
                }
            }
        } catch (e) {
            // 解析不能時は無視
        }

        return null;
    }

    function rgbToHsv(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
        let h = 0;
        if (d !== 0) {
            if (max === r) h = ((g - b) / d) % 6;
            else if (max === g) h = (b - r) / d + 2;
            else h = (r - g) / d + 4;
            h *= 60;
            if (h < 0) h += 360;
        }
        const s = max === 0 ? 0 : d / max * 100;
        const v = max * 100;
        return { h, s, v };
    }

    function hsvToRgb(h, s, v) {
        h = ((h % 360) + 360) % 360; s /= 100; v /= 100;
        const c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c;
        let r1 = 0, g1 = 0, b1 = 0;
        if (0 <= h && h < 60) [r1, g1, b1] = [c, x, 0];
        else if (60 <= h && h < 120) [r1, g1, b1] = [x, c, 0];
        else if (120 <= h && h < 180) [r1, g1, b1] = [0, c, x];
        else if (180 <= h && h < 240) [r1, g1, b1] = [0, x, c];
        else if (240 <= h && h < 300) [r1, g1, b1] = [x, 0, c];
        else[r1, g1, b1] = [c, 0, x];
        return { r: Math.round((r1 + m) * 255), g: Math.round((g1 + m) * 255), b: Math.round((b1 + m) * 255) };
    }

    function rgbToHsl(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
        let h = 0, s = 0;
        if (d !== 0) {
            s = d / (1 - Math.abs(2 * l - 1));
            if (max === r) h = ((g - b) / d) % 6;
            else if (max === g) h = (b - r) / d + 2;
            else h = (r - g) / d + 4;
            h *= 60;
            if (h < 0) h += 360;
        }
        return { h, s: s * 100, l: l * 100 };
    }

    function hslToRgb(h, s, l) {
        h = ((h % 360) + 360) % 360; s /= 100; l /= 100;
        const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2;
        let r1 = 0, g1 = 0, b1 = 0;
        if (0 <= h && h < 60) [r1, g1, b1] = [c, x, 0];
        else if (60 <= h && h < 120) [r1, g1, b1] = [x, c, 0];
        else if (120 <= h && h < 180) [r1, g1, b1] = [0, c, x];
        else if (180 <= h && h < 240) [r1, g1, b1] = [0, x, c];
        else if (240 <= h && h < 300) [r1, g1, b1] = [x, 0, c];
        else[r1, g1, b1] = [c, 0, x];
        return { r: Math.round((r1 + m) * 255), g: Math.round((g1 + m) * 255), b: Math.round((b1 + m) * 255) };
    }

    return { clamp, rgbaToHex, parseColor, rgbToHsv, hsvToRgb, rgbToHsl, hslToRgb };
})();

export class ColorPicker {
    /**
     * @param {HTMLElement} container - ピッカーを表示するコンテナ要素（またはappend先）
     * @param {Object} options - オプション
     * @param {string} options.color - 初期色 (#RRGGBB または #RRGGBBAA)
     * @param {boolean} options.hasAlpha - アルファチャンネルを有効にするか (default: true)
     * @param {Function} options.onChange - 色変更時のコールバック (hexString) => {}
     */
    constructor(container, options = {}) {
        this.container = container;
        this.onChange = options.onChange || (() => { });
        this.hasAlpha = options.hasAlpha !== false; // デフォルトは true

        this.color = { r: 59, g: 130, b: 246, a: 1 }; // デフォルトの青
        this.hsv = ColorMath.rgbToHsv(this.color.r, this.color.g, this.color.b);
        this.currentMode = 'rgba';

        // DOM構築
        this.element = this._createDOM();
        this.container.appendChild(this.element);

        // 参照取得とイベント設定
        this._bindEvents();

        // 初期色設定
        // 指定があれば設定、なければデフォルト色で描画
        if (options.color) {
            this.setColorStr(options.color);
        }

        // 初期化時の描画保証（パース失敗時もデフォルト色で表示するため）
        this._render();
    }

    /**
     * 外部から色を設定する（再描画含む）
     * @param {string} colorStr HEX または RGBA 文字列
     */
    setColorStr(colorStr) {
        let p = ColorMath.parseColor(colorStr);
        if (p) {
            if (!this.hasAlpha) {
                p.a = 1; // アルファ無効時は強制的に1
            }
            this._updateState(p, false); // 通知なしで更新
            this._render();
        }
    }

    /**
     * 現在の色をHEX文字列で取得
     */
    getColorStr() {
        return ColorMath.rgbaToHex(this.color, !this.hasAlpha).toUpperCase();
    }

    /**
     * 状態更新
     */
    _updateState(partialColor, notify = true) {
        this.color = { ...this.color, ...partialColor };
        if (!this.hasAlpha) {
            this.color.a = 1;
        }
        this.hsv = ColorMath.rgbToHsv(this.color.r, this.color.g, this.color.b);
        if (notify) {
            this.onChange(this.getColorStr());
        }
    }

    _updateHsv(partialHsv, notify = true) {
        this.hsv = { ...this.hsv, ...partialHsv };
        const rgb = ColorMath.hsvToRgb(this.hsv.h, this.hsv.s, this.hsv.v);
        this.color = { ...rgb, a: this.color.a };
        if (!this.hasAlpha) {
            this.color.a = 1;
        }
        if (notify) {
            this.onChange(this.getColorStr());
        }
    }

    /**
     * DOM生成
     */
    _createDOM() {
        // アルファ関連の表示制御スタイル
        const alphaStyle = this.hasAlpha ? '' : 'display:none;';

        const el = document.createElement('div');
        el.className = 'cp-picker';
        el.innerHTML = `
            <div class="cp-sv" id="cp-sv" aria-label="彩度・明度パネル">
                <div class="cp-cursor" id="cp-cursor" aria-hidden="true"></div>
            </div>
            <div class="cp-controls">
                <div class="cp-top">
                    <div class="cp-preview" aria-hidden="true">
                        <div class="cp-checker"></div>
                        <div class="cp-preview-fill" id="cp-preview-fill"></div>
                    </div>
                    <div class="cp-hex">
                        <input class="cp-hex-input" id="cp-hex-input" placeholder="${this.hasAlpha ? '#FFFFFF00' : '#FFFFFF'}">
                    </div>
                    <button class="cp-btn" id="cp-eye-btn" title="スポイト">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 -960 960 960" fill="#8B8B8B"><path d="M120-120v-190l358-358-58-56 58-56 76 76 124-124q5-5 12.5-8t15.5-3q8 0 15 3t13 8l94 94q5 6 8 13t3 15q0 8-3 15.5t-8 12.5L705-555l76 78-57 57-56-58-358 358H120Zm80-80h78l332-334-76-76-334 332v78Zm447-410 96-96-37-37-96 96 37 37Zm0 0-37-37 37 37Z"/></svg>
                    </button>
                </div>
                <div>
                    <div class="cp-bar" id="cp-hue-bar" tabindex="0"><div class="cp-handle" id="cp-hue-handle"></div></div>
                </div>
                <div style="${alphaStyle}">
                    <div class="cp-bar cp-alpha-wrap" id="cp-alpha-bar">
                        <div class="cp-checker" style="opacity:1;position:absolute;inset:0"></div>
                        <div class="cp-alpha-grad" id="cp-alpha-grad"></div>
                        <div class="cp-handle" id="cp-alpha-handle"></div>
                    </div>
                    <div class="cp-range-wrap"><input class="cp-alpha-range" id="cp-alpha-range" type="range" min="0" max="1" step="0.01" value="1"></div>
                </div>
                <div class="cp-compact">
                    <div class="cp-group" id="cp-inputs">
                        <div class="cp-box"><div class="cp-value"><input id="cp-i1" type="number"></div><div id="cp-l1" class="cp-label-small">R</div></div>
                        <div class="cp-box"><div class="cp-value"><input id="cp-i2" type="number"></div><div id="cp-l2" class="cp-label-small">G</div></div>
                        <div class="cp-box"><div class="cp-value"><input id="cp-i3" type="number"></div><div id="cp-l3" class="cp-label-small">B</div></div>
                        <div class="cp-box" style="${alphaStyle}"><div class="cp-value"><input id="cp-i4" type="number" min="0" max="100"></div><div id="cp-l4" class="cp-label-small">A</div></div>
                    </div>
                    <button class="cp-toggle" id="cp-mode-toggle" title="切替"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 -960 960 960" fill="#8B8B8B"><path d="M320-440v-287L217-624l-57-56 200-200 200 200-57 56-103-103v287h-80ZM600-80 400-280l57-56 103 103v-287h80v287l103-103 57 56L600-80Z"/></svg></button>
                </div>
            </div>
        `;
        return el;
    }

    _bindEvents() {
        const q = (sel) => this.element.querySelector(sel);
        this.refs = {
            sv: q('#cp-sv'), cursor: q('#cp-cursor'),
            hueBar: q('#cp-hue-bar'), hueHandle: q('#cp-hue-handle'),
            alphaBar: q('#cp-alpha-bar'), alphaHandle: q('#cp-alpha-handle'),
            alphaGrad: q('#cp-alpha-grad'), alphaRange: q('#cp-alpha-range'),
            preview: q('#cp-preview-fill'), hexInput: q('#cp-hex-input'), eyeBtn: q('#cp-eye-btn'),
            i1: q('#cp-i1'), i2: q('#cp-i2'), i3: q('#cp-i3'), i4: q('#cp-i4'),
            l1: q('#cp-l1'), l2: q('#cp-l2'), l3: q('#cp-l3'), l4: q('#cp-l4'),
            modeToggle: q('#cp-mode-toggle'),
            inputs: q('#cp-inputs')
        };
        const { refs } = this;

        refs.hueBar.style.background = 'linear-gradient(to right,#ff0000 0%,#ffff00 17%,#00ff00 33%,#00ffff 50%,#0000ff 67%,#ff00ff 83%,#ff0000 100%)';

        // Drag helpers
        const wire = (el, start) => {
            const rel = (e, el) => {
                const r = el.getBoundingClientRect();
                return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
            };
            el.addEventListener('pointerdown', ev => {
                ev.preventDefault();
                try { el.setPointerCapture(ev.pointerId); } catch (e) { }
                const h = start(ev, rel(ev, el)) || {};
                const move = e => { e.preventDefault(); if (h.onMove) h.onMove(rel(e, el), e); };
                const up = e => { try { el.releasePointerCapture(ev.pointerId); } catch (e) { } el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); };
                el.addEventListener('pointermove', move); el.addEventListener('pointerup', up);
            });
        };

        // SV
        wire(refs.sv, (ev, pos) => {
            this._updateHsv({ s: pos.x * 100, v: (1 - pos.y) * 100 });
            this._render();
            return { onMove: p => { this._updateHsv({ s: p.x * 100, v: (1 - p.y) * 100 }); this._render(); } };
        });

        // Hue
        wire(refs.hueBar, (ev, pos) => {
            this._updateHsv({ h: pos.x * 360 });
            this._render();
            return { onMove: p => { this._updateHsv({ h: p.x * 360 }); this._render(); } };
        });

        // Alpha
        wire(refs.alphaBar, (ev, pos) => {
            const a = Math.min(1, Math.max(0, pos.x));
            this._updateState({ a });
            this._render();
            return { onMove: p => { this._updateState({ a: Math.min(1, Math.max(0, p.x)) }); this._render(); } };
        });

        // Alpha Range
        refs.alphaRange.addEventListener('input', e => {
            this._updateState({ a: parseFloat(e.target.value) });
            this._render();
        });

        // Hex Input
        const onHex = () => {
            const p = ColorMath.parseColor(refs.hexInput.value || '');
            if (p) {
                if (!this.hasAlpha) p.a = 1; // アルファ無効時は強制的に1
                this._updateState(p);
                this._render();
            } else {
                refs.hexInput.value = ColorMath.rgbaToHex(this.color, !this.hasAlpha).toUpperCase();
            }
        };
        refs.hexInput.addEventListener('change', onHex);
        refs.hexInput.addEventListener('blur', onHex);
        refs.hexInput.addEventListener('keydown', e => { if (e.key === 'Enter') refs.hexInput.blur(); });

        // EyeDropper
        refs.eyeBtn.addEventListener('click', async () => {
            if (!('EyeDropper' in window)) { alert('EyeDropper 未対応のブラウザです'); return; }
            try {
                const eye = new EyeDropper();
                const res = await eye.open();
                if (res && res.sRGBHex) {
                    const p = ColorMath.parseColor(res.sRGBHex);
                    if (p) {
                        p.a = this.hasAlpha ? this.color.a : 1; // alphaは維持または1
                        this._updateState(p);
                        this._render();
                    }
                }
            } catch (e) {
                // キャンセル等は無視
            }
        });

        // Mode Toggle
        refs.modeToggle.addEventListener('click', () => {
            this.currentMode = this.currentMode === 'rgba' ? 'hsla' : 'rgba';
            this._render();
        });

        // Inputs
        const inputs = [refs.i1, refs.i2, refs.i3, refs.i4];
        const clampInt = (v, min, max) => Math.min(max, Math.max(min, Number.isFinite(Number(v)) ? Math.round(Number(v)) : 0));

        inputs.forEach((el, idx) => {
            if (!this.hasAlpha && idx === 3) return; // アルファ入力はスキップ

            el.addEventListener('keydown', e => { if (e.key === 'Enter') el.blur(); });
            el.addEventListener('focus', e => e.target.select());
            el.addEventListener('change', () => {
                const val = el.value;
                if (this.currentMode === 'rgba') {
                    if (idx === 0) this._updateState({ r: clampInt(val, 0, 255) });
                    if (idx === 1) this._updateState({ g: clampInt(val, 0, 255) });
                    if (idx === 2) this._updateState({ b: clampInt(val, 0, 255) });
                    if (idx === 3 && this.hasAlpha) this._updateState({ a: clampInt(val, 0, 100) / 100 });
                } else {
                    // HSLA
                    let nh = this.hsv.h, ns = 0, nl = 0, na = this.color.a;
                    const curHsl = ColorMath.rgbToHsl(this.color.r, this.color.g, this.color.b);
                    if (idx === 0) nh = ((clampInt(val, 0, 360)) % 360 + 360) % 360; else nh = curHsl.h;
                    if (idx === 1) ns = clampInt(val, 0, 100); else ns = curHsl.s;
                    if (idx === 2) nl = clampInt(val, 0, 100); else nl = curHsl.l;
                    if (idx === 3 && this.hasAlpha) na = clampInt(val, 0, 100) / 100;

                    const rgb = ColorMath.hslToRgb(nh, ns, nl);
                    this._updateState({ ...rgb, a: na });
                }
                this._render();
            });
        });

        // Labels click to separate logic if needed, but here simple toggle is default via button
    }

    _render() {
        const { color, hsv, refs, currentMode, hasAlpha } = this;
        const rgbStr = `${color.r},${color.g},${color.b}`;
        refs.preview.style.background = `rgba(${rgbStr},${color.a})`;

        const hr = ColorMath.hsvToRgb(hsv.h, 100, 100);
        refs.sv.style.background = `linear-gradient(to top,#000,rgba(0,0,0,0)), linear-gradient(to right,#fff, rgb(${hr.r},${hr.g},${hr.b}))`;
        refs.cursor.style.left = `${hsv.s}%`;
        refs.cursor.style.top = `${100 - hsv.v}%`;

        refs.hueHandle.style.left = `${(hsv.h / 360) * 100}%`;
        refs.hueHandle.style.background = `rgb(${rgbStr})`;

        if (hasAlpha) {
            refs.alphaGrad.style.background = `linear-gradient(to right, rgba(${rgbStr},0), rgb(${rgbStr}))`;
            refs.alphaHandle.style.left = `${color.a * 100}%`;
            refs.alphaHandle.style.background = `rgb(${rgbStr})`;
            refs.alphaRange.value = String(Number(color.a).toFixed(2));
        }

        const hx = ColorMath.rgbaToHex(color, !hasAlpha).toUpperCase();
        if (document.activeElement !== refs.hexInput) {
            refs.hexInput.value = hx;
        }

        // Inputs
        const active = document.activeElement;
        if (currentMode === 'rgba') {
            if (active !== refs.i1) refs.i1.value = color.r;
            if (active !== refs.i2) refs.i2.value = color.g;
            if (active !== refs.i3) refs.i3.value = color.b;
            if (hasAlpha && active !== refs.i4) refs.i4.value = Math.round(color.a * 100);

            // ラベル切り替え
            refs.l1.textContent = 'R'; refs.l2.textContent = 'G'; refs.l3.textContent = 'B';
            if (hasAlpha) refs.l4.textContent = 'A';
        } else {
            const hsl = ColorMath.rgbToHsl(color.r, color.g, color.b);
            if (active !== refs.i1) refs.i1.value = Math.round(hsl.h);
            if (active !== refs.i2) refs.i2.value = Math.round(hsl.s);
            if (active !== refs.i3) refs.i3.value = Math.round(hsl.l);
            if (hasAlpha && active !== refs.i4) refs.i4.value = Math.round(color.a * 100);

            // ラベル切り替え
            refs.l1.textContent = 'H'; refs.l2.textContent = 'S'; refs.l3.textContent = 'L';
            if (hasAlpha) refs.l4.textContent = 'A';
        }
    }
}
