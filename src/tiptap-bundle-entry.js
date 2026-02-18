/**
 * Tiptap バンドル エントリーポイント
 * 
 * このファイルは Tiptap バンドルの構成定義 (Source of Truth) です。
 * 生成されるバンドルファイルに含まれるモジュールをここで決定します。
 * 
 * 注意: このファイルは静的に管理されています。ビルドスクリプト等で上書きしないでください。
 */

// Core (必須)
export * from '@tiptap/core';
import { Node, mergeAttributes, Extension, Mark } from '@tiptap/core';
import { DOMParser } from '@tiptap/pm/model';

// Extensions (拡張機能)
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import TextAlign from '@tiptap/extension-text-align';
import Image from '@tiptap/extension-image';

// アプリケーションで必要なものすべてをエクスポート
export {
    // カスタム拡張機能 (ruby.js等) で必要な Core エクスポート
    Node,
    mergeAttributes,
    Extension,
    Mark,
    DOMParser,

    // バンドルする拡張機能
    StarterKit,
    Underline,
    TextStyle,
    Color,
    Highlight,
    TaskList,
    TaskItem,
    TextAlign,
    Image
};
