/**
 * @license
 * Copyright (C) 2015 Vaadin Ltd.
 * This program is available under Commercial Vaadin Add-On License 3.0 (CVALv3).
 * See the file LICENSE.md distributed with this software for more information about licensing.
 * See [the website]{@link https://vaadin.com/license/cval-3} for the complete license.
 */

import { html, PolymerElement } from '@polymer/polymer/polymer-element';
import { timeOut } from '@polymer/polymer/lib/utils/async';
import { Debouncer } from '@polymer/polymer/lib/utils/debounce';
import { resetMouseCanceller } from '@polymer/polymer/lib/utils/gestures';
import { useShadow } from '@polymer/polymer/lib/utils/settings';
import { ThemableMixin } from '@vaadin/vaadin-themable-mixin';
import { ElementMixin } from '@vaadin/vaadin-element-mixin';
import '@vaadin/vaadin-button';
import '@vaadin/vaadin-confirm-dialog';
import '@vaadin/vaadin-text-field';
import '@vaadin/vaadin-license-checker/vaadin-license-checker';
import '@vaadin/vaadin-icons';
import './vendor/vaadin-quill';
import './vcf-enhanced-rich-text-editor-styles';
import './vcf-enhanced-rich-text-editor-toolbar-styles';

const Quill = window.Quill;
const BlockEmbed = Quill.import('blots/block/embed');
const Block = Quill.import('blots/block');
const Inline = Quill.import('blots/inline');
const TextBlot = Quill.import('blots/text');
const ListItem = Quill.import('formats/list/item');
const ListContainer = Quill.import('formats/list');

class ReadOnlyBlot extends Inline {
  static create(value) {
    const node = super.create(value);

    if (value) {
      node.setAttribute('contenteditable', 'false');
    } else {
      node.removeAttribute('contenteditable');
    }

    return node;
  }

  static formats() {
    return true;
  }
}
ReadOnlyBlot.blotName = 'readonly';
ReadOnlyBlot.tagName = 'span';
ReadOnlyBlot.className = 'readonly-section';
ReadOnlyBlot.allowedChildren = [Block, BlockEmbed, Inline, TextBlot, ListItem, ListContainer]; // [Inline, TextBlot];

Quill.register(ReadOnlyBlot);

class TabStopBlot extends BlockEmbed {
  static create(data) {
    const node = super.create(data);
    node.style.left = '100px';
    node.textContent = data;

    return node;
  }
}
TabStopBlot.blotName = 'tabstop';
TabStopBlot.tagName = 'span';
TabStopBlot.className = 'v-block';
TabStopBlot.allowedChildren = [Text];
Quill.register(TabStopBlot);

class TabBlot extends Inline {
  static create(level) {
    const node = super.create();

    node.innerHTML = '&#65279;';
    node.style.width = `1px`;
    node.setAttribute('contenteditable', false);

    node.setAttribute('level', level);
    return node;
  }

  static formats(node) {
    return node.getAttribute('level');
  }
}
TabBlot.blotName = 'tab';
TabBlot.tagName = 'tab';
Quill.register(TabBlot);

class PreTabBlot extends Inline {
  static create() {
    const node = super.create();

    node.innerHTML = '&#65279;';
    node.style.width = `1px`;
    node.setAttribute('contenteditable', false);
    return node;
  }
}
PreTabBlot.blotName = 'pre-tab';
PreTabBlot.tagName = 'pre-tab';
Quill.register(PreTabBlot);

class LinePartBlot extends Inline {
  static create() {
    const node = super.create();
    return node;
  }
}
LinePartBlot.blotName = 'line-part';
LinePartBlot.tagName = 'line-part';
Quill.register(LinePartBlot);

var emptyRegEx = new RegExp('\uFEFF', 'g');
class TabsContBlot extends Block {
  static create() {
    const node = super.create();

    return node;
  }

  static getPrevTab(preTab) {
    if (!preTab.previousElementSibling) {
      return null;
    }

    if (preTab.previousElementSibling.nodeName == TabBlot.tagName.toUpperCase()) {
      return preTab.previousElementSibling;
    }

    if (!preTab.previousElementSibling.previousElementSibling) {
      return null;
    }

    if (preTab.previousElementSibling.innerText.trim() === '' && preTab.previousElementSibling.previousElementSibling.nodeName == TabBlot.tagName.toUpperCase()) {
      return preTab.previousElementSibling.previousElementSibling;
    }

    return null;
  }

  static convertPreTabs(node) {
    const preTab = node.querySelector(PreTabBlot.tagName);
    if (preTab) {
      const tab = this.getPrevTab(preTab);
      if (tab) {
        if (!preTab.getAttribute('locked')) {
          preTab.setAttribute('locked', true);

          let level = parseInt(tab.getAttribute('level')) || 1;
          tab.setAttribute('level', ++level);
        }
        preTab.remove();
      } else {
        const tab = document.createElement(TabBlot.tagName);
        tab.innerHTML = preTab.innerHTML;
        tab.style.width = `1px`;
        tab.setAttribute('contenteditable', false);
        tab.setAttribute('level', 1);

        preTab.parentElement.replaceChild(tab, preTab);
      }
    }
  }

  static formats(node) {
    this.convertPreTabs(node);
    const separators = node.querySelectorAll(TabBlot.tagName);

    if (node.getAttribute('tabs-count') != separators.length) {
      node.setAttribute('tabs-count', separators.length);
      separators.forEach(separator => {
        const prev = separator.previousSibling;
        if (prev != null && prev.nodeName != LinePartBlot.tagName.toUpperCase()) {
          const leftEl = document.createElement('line-part');
          if (prev.nodeName == '#text') {
            leftEl.textContent = prev.textContent.replace(emptyRegEx, '');
          } else {
            const prevClone = prev.cloneNode(true);
            prevClone.innerHTML = prevClone.innerHTML.replace(emptyRegEx, '');
            leftEl.appendChild(prevClone);
          }

          separator.parentElement.replaceChild(leftEl, prev);
        }

        const next = separator.nextSibling;
        if (next != null) {
          if (next.nodeName != LinePartBlot.tagName.toUpperCase()) {
            const rightEl = document.createElement('line-part');

            if (next.nodeName == '#text') {
              rightEl.innerHTML = separator.textContent.replace(emptyRegEx, '') + next.textContent.replace(emptyRegEx, '');
            } else {
              const nextClone = next.cloneNode(true);
              // TODO check if not ZERO WIDTH NO-BREAK SPACE
              nextClone.innerHTML = separator.textContent.replace(emptyRegEx, '') + nextClone.innerHTML.replace(emptyRegEx, '');
              rightEl.appendChild(nextClone);
            }
            separator.parentElement.replaceChild(rightEl, next);
          }
        } else {
          const rightEl = document.createElement('line-part');
          rightEl.innerHTML = '&#65279;';
          if (separator.parentElement) {
            separator.parentElement.appendChild(rightEl);
          }
        }

        // TODO fix currsor shifting
        separator.innerHTML = '&#65279;';
      });
    }

    return TabsContBlot.tagName;
  }
}
TabsContBlot.blotName = 'tabs-cont';
TabsContBlot.tagName = 'tabs-cont';
Quill.register(TabsContBlot);

// Non-breaking space
class Nbsp extends Inline {
  static create(value) {
    const node = super.create(value);
    node.innerHTML = '&nbsp;';
    return node;
  }
}
Nbsp.blotName = 'nbsp';
Nbsp.tagName = 'span';
Quill.register({
  'formats/nbsp': Nbsp
});

Inline.order.push(ReadOnlyBlot.blotName, LinePartBlot.blotName, TabBlot.blotName, PreTabBlot.blotName);

(function() {
  'use strict';

  const Quill = window.Quill;

  const HANDLERS = ['bold', 'italic', 'underline', 'strike', 'header', 'script', 'list', 'align', 'blockquote', 'code-block'];

  const TOOLBAR_BUTTON_GROUPS = {
    history: ['undo', 'redo'],
    emphasis: ['bold', 'italic', 'underline', 'strike'],
    heading: ['h1', 'h2', 'h3'],
    'glyph-transformation': ['subscript', 'superscript'],
    list: ['listOrdered', 'listBullet'],
    alignment: ['alignLeft', 'alignCenter', 'alignRight'],
    'rich-text': ['image', 'link'],
    block: ['blockquote', 'codeBlock'],
    format: ['readonly', 'clean']
  };

  const SOURCE = {
    USER: 'user',
    SILENT: 'silent'
  };

  const STATE = {
    DEFAULT: 0,
    FOCUSED: 1,
    CLICKED: 2
  };

  const TAB_KEY = 9;
  const QL_EDITOR_PADDING_LEFT = 16;

  /**
   * `<vcf-enhanced-rich-text-editor>` is a Web Component for rich text editing.
   * It provides a set of toolbar controls to apply formatting on the content,
   * which is stored and can be accessed as HTML5 or JSON string.
   *
   * ```
   * <vcf-enhanced-rich-text-editor></vcf-enhanced-rich-text-editor>
   * ```
   *
   * Vaadin Rich Text Editor focuses on the structure, not the styling of content.
   * Therefore, the semantic HTML5 tags such as <h1>, <strong> and <ul> are used,
   * and CSS usage is limited to most common cases, like horizontal text alignment.
   *
   * ### Styling
   *
   * The following state attributes are available for styling:
   *
   * Attribute    | Description | Part name
   * -------------|-------------|------------
   * `disabled`   | Set to a disabled text editor | :host
   * `readonly`   | Set to a readonly text editor | :host
   * `on`         | Set to a toolbar button applied to the selected text | toolbar-button
   *
   * The following shadow DOM parts are available for styling:
   *
   * Part name                            | Description
   * -------------------------------------|----------------
   * `content`                            | The content wrapper
   * `toolbar`                            | The toolbar wrapper
   * `toolbar-group`                      | The group for toolbar controls
   * `toolbar-group-history`              | The group for histroy controls
   * `toolbar-group-emphasis`             | The group for emphasis controls
   * `toolbar-group-heading`              | The group for heading controls
   * `toolbar-group-glyph-transformation` | The group for glyph transformation controls
   * `toolbar-group-group-list`           | The group for group list controls
   * `toolbar-group-alignment`            | The group for alignment controls
   * `toolbar-group-rich-text`            | The group for rich text controls
   * `toolbar-group-block`                | The group for preformatted block controls
   * `toolbar-group-format`               | The group for format controls
   * `toolbar-button`                     | The toolbar button (applies to all buttons)
   * `toolbar-button-undo`                | The "undo" button
   * `toolbar-button-redo`                | The "redo" button
   * `toolbar-button-bold`                | The "bold" button
   * `toolbar-button-italic`              | The "italic" button
   * `toolbar-button-underline`           | The "underline" button
   * `toolbar-button-strike`              | The "strike-through" button
   * `toolbar-button-h1`                  | The "header 1" button
   * `toolbar-button-h2`                  | The "header 2" button
   * `toolbar-button-h3`                  | The "header 3" button
   * `toolbar-button-subscript`           | The "subscript" button
   * `toolbar-button-superscript`         | The "superscript" button
   * `toolbar-button-list-ordered`        | The "ordered list" button
   * `toolbar-button-list-bullet`         | The "bullet list" button
   * `toolbar-button-align-left`          | The "left align" button
   * `toolbar-button-align-center`        | The "center align" button
   * `toolbar-button-align-right`         | The "right align" button
   * `toolbar-button-image`               | The "image" button
   * `toolbar-button-link`                | The "link" button
   * `toolbar-button-blockquote`          | The "blockquote" button
   * `toolbar-button-code-block`          | The "code block" button
   * `toolbar-button-clean`               | The "clean formatting" button
   *
   * See [ThemableMixin – how to apply styles for shadow parts](https://github.com/vaadin/vaadin-themable-mixin/wiki)
   *
   * @memberof Vaadin
   * @mixes Vaadin.ElementMixin
   * @mixes Vaadin.ThemableMixin
   * @demo demo/index.html
   */
  class VcfEnhancedRichTextEditor extends ElementMixin(ThemableMixin(PolymerElement)) {
    static get template() {
      return html`
        <style include="vcf-enhanced-rich-text-editor-styles">
          :host {
            display: flex;
            flex-direction: column;
            box-sizing: border-box;
            overflow: hidden;
          }

          :host([hidden]) {
            display: none !important;
          }

          .announcer {
            position: fixed;
            clip: rect(0, 0, 0, 0);
          }

          input[type='file'] {
            display: none;
          }

          .vcf-enhanced-rich-text-editor-container {
            display: flex;
            flex-direction: column;
            min-height: inherit;
            max-height: inherit;
            flex: auto;
          }

          .readonly-section {
            color: #676767;
            /* background: #f9f9f9; */
            background: #f1f1f1;
            border-radius: 0.1em;
          }

          /* FIXME (Yuriy): workaround for auto-grow feature in flex layout for IE11 */
          @media all and (-ms-high-contrast: none) {
            .ql-editor {
              flex: auto;
            }
          }
        </style>

        <div class="vcf-enhanced-rich-text-editor-container">
          <!-- Create toolbar container -->
          <div part="toolbar">
            <span part="toolbar-group toolbar-group-history" style="display: [[_buttonGroupDisplay(toolbarButtons, 'history')]];">
              <!-- Undo and Redo -->
              <button type="button" part="toolbar-button toolbar-button-undo" on-click="_undo" title$="[[i18n.undo]]" style="display: [[_buttonDisplay(toolbarButtons, 'undo')]];"></button>
              <button type="button" part="toolbar-button toolbar-button-redo" on-click="_redo" title$="[[i18n.redo]]" style="display: [[_buttonDisplay(toolbarButtons, 'redo')]];"></button>
            </span>

            <span part="toolbar-group toolbar-group-emphasis" style="display: [[_buttonGroupDisplay(toolbarButtons, 'emphasis')]];">
              <!-- Bold -->
              <button class="ql-bold" part="toolbar-button toolbar-button-bold" title$="[[i18n.bold]]" style="display: [[_buttonDisplay(toolbarButtons, 'bold')]];"></button>

              <!-- Italic -->
              <button class="ql-italic" part="toolbar-button toolbar-button-italic" title$="[[i18n.italic]]" style="display: [[_buttonDisplay(toolbarButtons, 'italic')]];"></button>

              <!-- Underline -->
              <button class="ql-underline" part="toolbar-button toolbar-button-underline" title$="[[i18n.underline]]" style="display: [[_buttonDisplay(toolbarButtons, 'underline')]];"></button>

              <!-- Strike -->
              <button class="ql-strike" part="toolbar-button toolbar-button-strike" title$="[[i18n.strike]]" style="display: [[_buttonDisplay(toolbarButtons, 'strike')]];"></button>
            </span>

            <span part="toolbar-group toolbar-group-heading" style="display: [[_buttonGroupDisplay(toolbarButtons, 'heading')]];">
              <!-- Header buttons -->
              <button type="button" class="ql-header" value="1" part="toolbar-button toolbar-button-h1" title$="[[i18n.h1]]" style="display: [[_buttonDisplay(toolbarButtons, 'h1')]];"></button>
              <button type="button" class="ql-header" value="2" part="toolbar-button toolbar-button-h2" title$="[[i18n.h2]]" style="display: [[_buttonDisplay(toolbarButtons, 'h2')]];"></button>
              <button type="button" class="ql-header" value="3" part="toolbar-button toolbar-button-h3" title$="[[i18n.h3]]" style="display: [[_buttonDisplay(toolbarButtons, 'h3')]];"></button>
            </span>

            <span part="toolbar-group toolbar-group-glyph-transformation" style="display: [[_buttonGroupDisplay(toolbarButtons, 'glyph-transformation')]];">
              <!-- Subscript and superscript -->
              <button class="ql-script" value="sub" part="toolbar-button toolbar-button-subscript" title$="[[i18n.subscript]]" style="display: [[_buttonDisplay(toolbarButtons, 'subscript')]];"></button>
              <button class="ql-script" value="super" part="toolbar-button toolbar-button-superscript" title$="[[i18n.superscript]]" style="display: [[_buttonDisplay(toolbarButtons, 'superscript')]];"></button>
            </span>

            <span part="toolbar-group toolbar-group-list" style="display: [[_buttonGroupDisplay(toolbarButtons, 'list')]];">
              <!-- List buttons -->
              <button type="button" class="ql-list" value="ordered" part="toolbar-button toolbar-button-list-ordered" title$="[[i18n.listOrdered]]" style="display: [[_buttonDisplay(toolbarButtons, 'listOrdered')]];"></button>
              <button type="button" class="ql-list" value="bullet" part="toolbar-button toolbar-button-list-bullet" title$="[[i18n.listBullet]]" style="display: [[_buttonDisplay(toolbarButtons, 'listBullet')]];"></button>
            </span>

            <span part="toolbar-group toolbar-group-alignment" style="display: [[_buttonGroupDisplay(toolbarButtons, 'alignment')]];">
              <!-- Align buttons -->
              <button type="button" class="ql-align" value="" part="toolbar-button toolbar-button-align-left" title$="[[i18n.alignLeft]]" style="display: [[_buttonDisplay(toolbarButtons, 'alignLeft')]];"></button>
              <button type="button" class="ql-align" value="center" part="toolbar-button toolbar-button-align-center" title$="[[i18n.alignCenter]]" style="display: [[_buttonDisplay(toolbarButtons, 'alignCenter')]];"></button>
              <button type="button" class="ql-align" value="right" part="toolbar-button toolbar-button-align-right" title$="[[i18n.alignRight]]" style="display: [[_buttonDisplay(toolbarButtons, 'alignRight')]];"></button>
            </span>

            <span part="toolbar-group toolbar-group-rich-text" style="display: [[_buttonGroupDisplay(toolbarButtons, 'rich-text')]];">
              <!-- Image -->
              <button type="button" part="toolbar-button toolbar-button-image" title$="[[i18n.image]]" on-touchend="_onImageTouchEnd" on-click="_onImageClick" style="display: [[_buttonDisplay(toolbarButtons, 'image')]];"></button>
              <!-- Link -->
              <button type="button" part="toolbar-button toolbar-button-link" title$="[[i18n.link]]" on-click="_onLinkClick" style="display: [[_buttonDisplay(toolbarButtons, 'link')]];"></button>
            </span>

            <span part="toolbar-group toolbar-group-block" style="display: [[_buttonGroupDisplay(toolbarButtons, 'block')]];">
              <!-- Blockquote -->
              <button type="button" class="ql-blockquote" part="toolbar-button toolbar-button-blockquote" title$="[[i18n.blockquote]]" style="display: [[_buttonDisplay(toolbarButtons, 'blockquote')]];"></button>

              <!-- Code block -->
              <button type="button" class="ql-code-block" part="toolbar-button toolbar-button-code-block" title$="[[i18n.codeBlock]]" style="display: [[_buttonDisplay(toolbarButtons, 'codeBlock')]];"></button>
            </span>

            <span part="toolbar-group toolbar-group-format" style="display: [[_buttonGroupDisplay(toolbarButtons, 'format')]];">
              <!-- Read-only -->
              <button type="button" class="rte-readonly" part="toolbar-button toolbar-button-readonly" title$="[[i18n.readonly]]" style="display: [[_buttonDisplay(toolbarButtons, 'readonly')]];" on-click="_onReadonlyClick">
                <iron-icon icon="vaadin:lock"></iron-icon>
              </button>

              <!-- Clean -->
              <button type="button" class="ql-clean" part="toolbar-button toolbar-button-clean" title$="[[i18n.clean]]" style="display: [[_buttonDisplay(toolbarButtons, 'clean')]];"></button>
            </span>

            <input id="fileInput" type="file" accept="image/png, image/gif, image/jpeg, image/bmp, image/x-icon" on-change="_uploadImage" />
          </div>

          <div style="overflow: hidden; box-sizing: content-box; width: 100% !important; height: 15px !important; flex-shrink: 0; display: flex;">
            <div style="overflow: hidden; box-sizing: content-box; border-color: rgb(158, 170, 182); border-style: solid; border-width: 0 1px 1px 0; width: 14px !important; height: 14px !important;"></div>
            <div style="position:relative; overflow: hidden; box-sizing: content-box; background: url('[[_rulerHori]]') repeat-x; flex-grow: 1; height: 15px !important; padding: 0;" on-click="_addTabStop" part="horizontalRuler"></div>
          </div>

          <div style="display: flex; flex-grow: 1;">
            <div style="overflow: hidden; box-sizing: content-box; background: url('[[_rulerVert]]') repeat-y; width: 15px !important; flex-shrink: 0;"></div>
            <div part="content"></div>
          </div>

          <div class="announcer" aria-live="polite"></div>
        </div>

        <vaadin-confirm-dialog id="linkDialog" opened="{{_linkEditing}}" header="[[i18n.linkDialogTitle]]">
          <vaadin-text-field id="linkUrl" value="{{_linkUrl}}" style="width: 100%;" on-keydown="_onLinkKeydown"> </vaadin-text-field>
          <vaadin-button id="confirmLink" slot="confirm-button" theme="primary" on-click="_onLinkEditConfirm">
            [[i18n.ok]]
          </vaadin-button>
          <vaadin-button id="removeLink" slot="reject-button" theme="error" on-click="_onLinkEditRemove" hidden$="[[!_linkRange]]">
            [[i18n.remove]]
          </vaadin-button>
          <vaadin-button id="cancelLink" slot="cancel-button" on-click="_onLinkEditCancel">
            [[i18n.cancel]]
          </vaadin-button>
        </vaadin-confirm-dialog>
      `;
    }

    static get is() {
      return 'vcf-enhanced-rich-text-editor';
    }

    static get version() {
      return '1.2.1';
    }

    static get properties() {
      return {
        /**
         * Value is a list of the operations which describe change to the document.
         * Each of those operations describe the change at the current index.
         * They can be an `insert`, `delete` or `retain`. The format is as follows:
         *
         * ```js
         *  [
         *    { insert: 'Hello World' },
         *    { insert: '!', attributes: { bold: true }}
         *  ]
         * ```
         *
         * See also https://github.com/quilljs/delta for detailed documentation.
         */
        value: {
          type: String,
          notify: true,
          value: ''
        },

        /**
         * HTML representation of the rich text editor content.
         */
        htmlValue: {
          type: String,
          notify: true,
          readOnly: true
        },

        /**
         * When true, the user can not modify, nor copy the editor content.
         */
        disabled: {
          type: Boolean,
          value: false,
          reflectToAttribute: true
        },

        /**
         * When true, the user can not modify the editor content, but can copy it.
         */
        readonly: {
          type: Boolean,
          value: false,
          reflectToAttribute: true
        },

        /**
         * An object used to localize this component. The properties are used
         * e.g. as the tooltips for the editor toolbar buttons.
         *
         * @default {English/US}
         */
        i18n: {
          type: Array,
          value: () => {
            return {
              undo: 'undo',
              redo: 'redo',
              bold: 'bold',
              italic: 'italic',
              underline: 'underline',
              strike: 'strike',
              h1: 'h1',
              h2: 'h2',
              h3: 'h3',
              subscript: 'subscript',
              superscript: 'superscript',
              listOrdered: 'list ordered',
              listBullet: 'list bullet',
              alignLeft: 'align left',
              alignCenter: 'align center',
              alignRight: 'align right',
              image: 'image',
              link: 'link',
              blockquote: 'blockquote',
              codeBlock: 'code block',
              readonly: 'readonly',
              clean: 'clean',
              linkDialogTitle: 'Link address',
              ok: 'OK',
              cancel: 'Cancel',
              remove: 'Remove'
            };
          }
        },

        /**
         * An object used to show/hide toolbar buttons.
         * Default value of any unspecified button is true.
         */
        toolbarButtons: {
          type: Object,
          value: {}
        },

        tabStops: {
          type: Array,
          notify: true,
          value: [
            // {
            //   direction: 'left', // left, right, middle
            //   position: 120 // px
            // }
          ]
        },

        _editor: {
          type: Object
        },

        /**
         * Stores old value
         */
        __oldValue: String,

        __lastCommittedChange: {
          type: String,
          value: ''
        },

        _linkEditing: {
          type: Boolean
        },

        _linkRange: {
          type: Object,
          value: null
        },

        _linkIndex: {
          type: Number,
          value: null
        },

        _linkUrl: {
          type: String,
          value: ''
        },

        _rulerHori: {
          type: String,
          value:
            // eslint-disable-next-line max-len
            'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAV4AAAAPBAMAAABeoLrPAAAAA3NCSVQICAjb4U/gAAAAHlBMVEXS0tLR0dHQ0NCerLmfq7eeqrafqbOdqbWcqLT///9ePaWcAAAACnRSTlP///////////8AsswszwAAAAlwSFlzAAALEgAACxIB0t1+/AAAACB0RVh0U29mdHdhcmUATWFjcm9tZWRpYSBGaXJld29ya3MgTVi7kSokAAAAFnRFWHRDcmVhdGlvbiBUaW1lADA1LzEwLzEyhpCxGgAAAKtJREFUeJztksENgCAMRXt1BEZgICdwBvco3NxWqwYDFGMrajT2QOD/0v8kwvCugqcBhPXzXluf4XViA+uNKmfIeX09Q5Eh5y0+o9xQZFT8H24xINgXLwmMdtl4fVjcruYO9nEans6YeA2NMSQaEtedYzQMx0RLbkTzbHmeImPibWhrY8cy2to3IyRalM7P89ldVQZk39ksPZhpXJ9hUHfeDanlVAZ0ffumGgEWlrgeDxx/xAAAAABJRU5ErkJggg=='
        },

        _rulerVert: {
          type: String,
          value:
            // eslint-disable-next-line max-len
            'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA8AAAAyBAMAAABxHJwKAAAAA3NCSVQICAjb4U/gAAAAG1BMVEXS0tLR0dHQ0NCfq7eeqradq7idqbWcqLT///+TeDeAAAAACXRSTlP//////////wBTT3gSAAAACXBIWXMAAAsSAAALEgHS3X78AAAAIHRFWHRTb2Z0d2FyZQBNYWNyb21lZGlhIEZpcmV3b3JrcyBNWLuRKiQAAAAWdEVYdENyZWF0aW9uIFRpbWUAMDUvMTAvMTKGkLEaAAAATklEQVR4nGPogIAABijDAMZwQGM0CqKLYGNAtDcK4lOcgGGyAS4pDF1NgoIJuJ2KLtKIUIxpcgKGmzHV4AkNTClc2pFDo4Bq4awoCAYOAKbZvafXusxYAAAAAElFTkSuQmCC'
        }
      };
    }

    _buttonDisplay(toolbarButtons, button) {
      if (toolbarButtons[button] == false) return 'none';
      return '';
    }

    _buttonGroupDisplay(toolbarButtons, group) {
      var visible = false;
      TOOLBAR_BUTTON_GROUPS[group].forEach(button => {
        if (toolbarButtons[button] != false) {
          visible = true;
          return;
        }
      });

      return visible ? '' : 'none';
    }

    _cleanUpLineParts() {
      const lineParts = this.shadowRoot.querySelectorAll(LinePartBlot.tagName);
      lineParts.forEach(line => {
        if (!line.previousElementSibling || line.previousElementSibling.nodeName != TabBlot.tagName.toUpperCase()) {
          line.style.paddingLeft = '0px';
        }
        if (line.nextElementSibling && line.nextElementSibling.nodeName != TabBlot.tagName.toUpperCase() && line.textContent.trim().length == 0) {
          line.remove();
        }
      });
    }

    _simulateTabs() {
      const allTabsConts = this.shadowRoot.querySelectorAll(TabsContBlot.tagName);
      allTabsConts.forEach(tabsCont => {
        const tabElements = tabsCont.querySelectorAll(TabBlot.tagName);
        let tabNumber = 0;
        tabElements.forEach(tabElement => {
          let el = tabElement.nextSibling;
          if (el) {
            if (el.nodeName == '#text') {
              const linePart = document.createElement('line-part');
              linePart.innerText = el.wholeText;
              el.replaceWith(linePart);
              el = linePart;
            }
            tabNumber += tabElement.getAttribute('level') ? parseInt(tabElement.getAttribute('level')) : 1;
            const tabInfo = this.tabStops[tabNumber - 1];
            if (tabInfo) {
              let newPadding = tabInfo.position - QL_EDITOR_PADDING_LEFT - (el.offsetLeft - tabsCont.offsetLeft);

              if (tabInfo.direction == 'right' || tabInfo.direction == 'middle') {
                const prevPadding = el.style.paddingLeft ? parseInt(el.style.paddingLeft.split('px')[0]) : 0;
                let elWidth = el.offsetWidth - prevPadding;

                if (tabInfo.direction == 'middle') {
                  elWidth /= 2;
                }
                newPadding -= elWidth;
              }

              el.style.paddingLeft = newPadding + 'px';
            } else {
              const strTab = document.createElement('line-part');
              strTab.innerHTML = String.fromCharCode(9);
              tabElement.replaceWith(strTab);
            }
          }
        });
      });
    }

    static get observers() {
      return ['_valueChanged(value, _editor)', '_disabledChanged(disabled, readonly, _editor)', '_tabStopsChanged(tabStops, _editor)'];
    }

    ready() {
      super.ready();

      const editor = this.shadowRoot.querySelector('[part="content"]');
      const toolbarConfig = this._prepareToolbar();
      this._toolbar = toolbarConfig.container;

      this._addToolbarListeners();

      this._editor = new Quill(editor, {
        modules: {
          toolbar: toolbarConfig
        }
      });
      const _editor = this._editor;

      this._editor.on('text-change', function(delta, oldDelta, source) {
        if (source === 'user' && delta.ops.some(o => !!o.delete)) {
          // Prevent user to delete a readonly Blot
          const currentDelta = _editor.getContents().ops;
          if (oldDelta.ops.some(v => !!v.insert && v.insert.readonly)) {
            // There were sections in the previous value. Check for them in the new value.
            const readonlySectionsCount = oldDelta.ops.filter(v => !!v.insert && v.insert.readonly).length;
            const newReadonlySectionsCount = currentDelta.filter(v => !!v.insert && v.insert.readonly).length;

            if (readonlySectionsCount != newReadonlySectionsCount) {
              _editor.setContents(oldDelta);
              _editor.setSelection(delta.ops[0].retain + 1, 0);
            }
          }
        }
      });

      this.__patchToolbar();
      this.__patchKeyboard();

      /* istanbul ignore if */
      if (navigator.userAgent.toLowerCase().indexOf('firefox') > -1 && useShadow) {
        this.__patchFirefoxFocus();
      }

      this.$.linkDialog.$.dialog.$.overlay.addEventListener('vaadin-overlay-open', () => {
        this.$.linkUrl.focus();
      });

      const editorContent = editor.querySelector('.ql-editor');

      editorContent.setAttribute('role', 'textbox');
      editorContent.setAttribute('aria-multiline', 'true');

      this._editor.on('text-change', () => {
        const timeout = 200;
        this.__debounceSetValue = Debouncer.debounce(this.__debounceSetValue, timeOut.after(timeout), () => {
          this.value = JSON.stringify(this._editor.getContents().ops);
        });
      });

      this._editor.on('text-change', () => {
        this._cleanUpLineParts();
        this._simulateTabs();
      });

      editorContent.addEventListener('focusout', () => {
        if (this._toolbarState === STATE.FOCUSED) {
          this._cleanToolbarState();
        } else {
          this.__emitChangeEvent();
        }
      });

      editorContent.addEventListener('focus', () => {
        // format changed, but no value changed happened
        if (this._toolbarState === STATE.CLICKED) {
          this._cleanToolbarState();
        }
      });

      this._editor.on('selection-change', this.__announceFormatting.bind(this));

      this._editor.emitter.emit('text-change');
    }

    _prepareToolbar() {
      const clean = Quill.imports['modules/toolbar'].DEFAULTS.handlers.clean;
      const self = this;

      const toolbar = {
        container: this.shadowRoot.querySelector('[part="toolbar"]'),
        handlers: {
          clean: function() {
            self._markToolbarClicked();
            clean.call(this);
          }
        }
      };

      HANDLERS.forEach(handler => {
        toolbar.handlers[handler] = value => {
          this._markToolbarClicked();
          this._editor.format(handler, value, SOURCE.USER);
        };
      });

      return toolbar;
    }

    _addToolbarListeners() {
      const buttons = this._toolbarButtons;
      const toolbar = this._toolbar;

      // Disable tabbing to all buttons but the first one
      buttons.forEach((button, index) => index > 0 && button.setAttribute('tabindex', '-1'));

      toolbar.addEventListener('keydown', e => {
        // Use roving tab-index for the toolbar buttons
        if ([37, 39].indexOf(e.keyCode) > -1) {
          e.preventDefault();
          let index = buttons.indexOf(e.target);
          buttons[index].setAttribute('tabindex', '-1');
          if (e.keyCode === 39 && ++index === buttons.length) {
            index = 0;
          } else if (e.keyCode === 37 && --index === -1) {
            index = buttons.length - 1;
          }
          buttons[index].removeAttribute('tabindex');
          buttons[index].focus();
        }
        // Esc and Tab focuses the content
        if (e.keyCode === 27 || (e.keyCode === TAB_KEY && !e.shiftKey)) {
          e.preventDefault();
          this._editor.focus();
        }
      });

      // mousedown happens before editor focusout
      toolbar.addEventListener('mousedown', e => {
        if (buttons.indexOf(e.composedPath()[0]) > -1) {
          this._markToolbarFocused();
        }
      });
    }

    _markToolbarClicked() {
      this._toolbarState = STATE.CLICKED;
    }

    _markToolbarFocused() {
      this._toolbarState = STATE.FOCUSED;
    }

    _cleanToolbarState() {
      this._toolbarState = STATE.DEFAULT;
    }

    __createFakeFocusTarget() {
      const isRTL = document.documentElement.getAttribute('dir') == 'rtl';
      const elem = document.createElement('textarea');
      // Reset box model
      elem.style.border = '0';
      elem.style.padding = '0';
      elem.style.margin = '0';
      // Move element out of screen horizontally
      elem.style.position = 'absolute';
      elem.style[isRTL ? 'right' : 'left'] = '-9999px';
      // Move element to the same position vertically
      const yPosition = window.pageYOffset || document.documentElement.scrollTop;
      elem.style.top = `${yPosition}px`;
      return elem;
    }

    __patchFirefoxFocus() {
      // in Firefox 63 with native Shadow DOM, when moving focus out of
      // contenteditable and back again within same shadow root, cursor
      // disappears. See https://jsfiddle.net/webpadawan/g6vku9L3/
      const editorContent = this.shadowRoot.querySelector('.ql-editor');
      let isFake = false;

      const focusFake = () => {
        isFake = true;
        this.__fakeTarget = this.__createFakeFocusTarget();
        document.body.appendChild(this.__fakeTarget);
        // let the focus step out of shadow root!
        this.__fakeTarget.focus();
        return new Promise(resolve => setTimeout(resolve));
      };

      const focusBack = (offsetNode, offset) => {
        this._editor.focus();
        if (offsetNode) {
          this._editor.selection.setNativeRange(offsetNode, offset);
        }
        document.body.removeChild(this.__fakeTarget);
        delete this.__fakeTarget;
        isFake = false;
      };

      editorContent.addEventListener('mousedown', e => {
        if (!this._editor.hasFocus()) {
          const { x, y } = e;
          const { offset, offsetNode } = document.caretPositionFromPoint(x, y);
          focusFake().then(() => {
            focusBack(offsetNode, offset);
          });
        }
      });

      editorContent.addEventListener('focusin', () => {
        if (isFake === false) {
          focusFake().then(() => focusBack());
        }
      });
    }

    __patchToolbar() {
      const toolbar = this._editor.getModule('toolbar');
      const update = toolbar.update;

      // add custom link button to toggle state attribute
      const linkButton = this.shadowRoot.querySelector('[part~="toolbar-button-link"]');
      if (linkButton) {
        toolbar.controls.push(['link', linkButton]);
      }

      const readonlyButton = this.shadowRoot.querySelector('[part~="toolbar-button-readonly"]');
      if (readonlyButton) {
        toolbar.controls.push(['readonly', readonlyButton]);
      }

      toolbar.update = function(range) {
        update.call(toolbar, range);

        toolbar.controls.forEach(pair => {
          const input = pair[1];
          if (input.classList.contains('ql-active')) {
            input.setAttribute('on', '');
          } else {
            input.removeAttribute('on');
          }
        });
      };
    }

    __patchKeyboard() {
      const focusToolbar = () => {
        this._markToolbarFocused();
        this._toolbar.querySelector('button:not([tabindex])').focus();
      };

      const keyboard = this._editor.getModule('keyboard');
      const bindings = keyboard.bindings[TAB_KEY];

      // exclude Quill shift-tab bindings, except for code block,
      // as some of those are breaking when on a newline in the list
      // https://github.com/vaadin/vcf-enhanced-rich-text-editor/issues/67
      const originalBindings = bindings.filter(b => !b.shiftKey || (b.format && b.format['code-block']));
      const moveFocusBinding = { key: TAB_KEY, shiftKey: true, handler: focusToolbar };
      const self = this;
      // Binding for tabstop functionality.
      const tabStopBinding = {
        key: TAB_KEY,
        handler: function() {
          if (self.tabStops.length > 0) {
            const selection = self._editor.getSelection();
            self._editor.format(PreTabBlot.blotName, true);
            self._editor.format(TabsContBlot.blotName, true);
            setTimeout(() => {
              selection.length = 0;
              selection.index += 2;
              self._editor.focus();
              self._editor.setSelection(selection, 'user');
            }, 0);

            // If we have tabstops defined in the component, the default tab functionality should be overriden.
            return false;
          } else {
            // In case we have no tabstops, go ahead with the default functionality.
            return true;
          }
        }
      };

      keyboard.bindings[TAB_KEY] = [tabStopBinding, ...originalBindings, moveFocusBinding];

      // alt-f10 focuses a toolbar button
      keyboard.addBinding({ key: 121, altKey: true, handler: focusToolbar });

      // Shift+Space inserts a non-breaking space.
      keyboard.addBinding({ key: ' ', shiftKey: true }, () => {
        var index = this.quill.getSelection().index;
        this.quill.insertEmbed(index, 'nbsp', '');
      });
    }

    __emitChangeEvent() {
      this.__debounceSetValue && this.__debounceSetValue.flush();

      if (this.__lastCommittedChange !== this.value) {
        this.dispatchEvent(new CustomEvent('change', { bubbles: true, cancelable: false }));
        this.__lastCommittedChange = this.value;
      }
    }

    _onReadonlyClick() {
      const range = this._editor.getSelection();
      if (range) {
        const [readOnlySection] = this._editor.scroll.descendant(ReadOnlyBlot, range.index);
        // if (readOnlySection != null) {
        //   // existing readonly section
        //   this._editor.formatText(range.index, range.length + 1, 'readonly', false, 'user');
        // } else {
        //   this._editor.formatText(range.index, range.length + 1, 'readonly', true, 'user');
        // }

        this._editor.formatText(range.index, range.length + 1, 'readonly', readOnlySection == null, 'user');
      }
    }

    _onLinkClick() {
      const range = this._editor.getSelection();
      if (range) {
        const LinkBlot = Quill.imports['formats/link'];
        const [link, offset] = this._editor.scroll.descendant(LinkBlot, range.index);
        if (link != null) {
          // existing link
          this._linkRange = { index: range.index - offset, length: link.length() };
          this._linkUrl = LinkBlot.formats(link.domNode);
        } else if (range.length === 0) {
          this._linkIndex = range.index;
        }
        this._linkEditing = true;
      }
    }

    _applyLink(link) {
      if (link) {
        this._markToolbarClicked();
        this._editor.format('link', link, SOURCE.USER);
        this._editor.getModule('toolbar').update(this._editor.selection.savedRange);
      }
      this._closeLinkDialog();
    }

    _insertLink(link, position) {
      if (link) {
        this._markToolbarClicked();
        this._editor.insertText(position, link, { link });
        this._editor.setSelection(position, link.length);
      }
      this._closeLinkDialog();
    }

    _updateLink(link, range) {
      this._markToolbarClicked();
      this._editor.formatText(range, 'link', link, SOURCE.USER);
      this._closeLinkDialog();
    }

    _removeLink() {
      this._markToolbarClicked();
      if (this._linkRange != null) {
        this._editor.formatText(this._linkRange, { link: false, color: false }, SOURCE.USER);
      }
      this._closeLinkDialog();
    }

    _closeLinkDialog() {
      this._linkEditing = false;
      this._linkUrl = '';
      this._linkIndex = null;
      this._linkRange = null;
    }

    _onLinkEditConfirm() {
      if (this._linkIndex != null) {
        this._insertLink(this._linkUrl, this._linkIndex);
      } else if (this._linkRange) {
        this._updateLink(this._linkUrl, this._linkRange);
      } else {
        this._applyLink(this._linkUrl);
      }
    }

    _onLinkEditCancel() {
      this._closeLinkDialog();
      this._editor.focus();
    }

    _onLinkEditRemove() {
      this._removeLink();
      this._closeLinkDialog();
    }

    _onLinkKeydown(e) {
      if (e.keyCode === 13) {
        e.preventDefault();
        e.stopPropagation();
        this.$.confirmLink.click();
      }
    }

    __updateHtmlValue() {
      const className = 'ql-editor';
      const editor = this.shadowRoot.querySelector(`.${className}`);
      let content = editor.innerHTML;

      // Remove style-scoped classes that are appended when ShadyDOM is enabled
      Array.from(editor.classList).forEach(c => (content = content.replace(new RegExp('\\s*' + c, 'g'), '')));

      // Remove Quill classes, e.g. ql-syntax, except for align
      content = content.replace(/\s*ql-(?!align)[\w\-]*\s*/g, '');

      // Replace Quill align classes with inline styles
      ['right', 'center', 'justify'].forEach(align => {
        content = content.replace(new RegExp(` class=[\\\\]?"\\s?ql-align-${align}[\\\\]?"`, 'g'), ` style="text-align: ${align}"`);
      });

      content = content.replace(/ class=""/g, '');

      this._setHtmlValue(content);
    }

    __announceFormatting() {
      const timeout = 200;

      const announcer = this.shadowRoot.querySelector('.announcer');
      announcer.textContent = '';

      this.__debounceAnnounceFormatting = Debouncer.debounce(this.__debounceAnnounceFormatting, timeOut.after(timeout), () => {
        const formatting = Array.from(this.shadowRoot.querySelectorAll('[part="toolbar"] .ql-active'))
          .map(button => button.getAttribute('title'))
          .join(', ');
        announcer.textContent = formatting;
      });
    }

    get _toolbarButtons() {
      return Array.from(this.shadowRoot.querySelectorAll('[part="toolbar"] button')).filter(btn => {
        return btn.clientHeight > 0;
      });
    }

    _clear() {
      this._editor.deleteText(0, this._editor.getLength(), SOURCE.SILENT);
      this.__updateHtmlValue();
    }

    _undo(e) {
      e.preventDefault();
      this._editor.history.undo();
      this._editor.focus();
    }

    _redo(e) {
      e.preventDefault();
      this._editor.history.redo();
      this._editor.focus();
    }

    _toggleToolbarDisabled(disable) {
      const buttons = this._toolbarButtons;
      if (disable) {
        buttons.forEach(btn => btn.setAttribute('disabled', 'true'));
      } else {
        buttons.forEach(btn => btn.removeAttribute('disabled'));
      }
    }

    _onImageTouchEnd(e) {
      // Cancel the event to avoid the following click event
      e.preventDefault();
      // FIXME(platosha): workaround for Polymer Gestures mouseCanceller
      // cancelling the following synthetic click. See also:
      // https://github.com/Polymer/polymer/issues/5289
      this.__resetMouseCanceller();
      this._onImageClick();
    }

    __resetMouseCanceller() {
      resetMouseCanceller();
    }

    _onImageClick() {
      this.$.fileInput.value = '';
      this.$.fileInput.click();
    }

    _uploadImage(e) {
      const fileInput = e.target;
      // NOTE: copied from https://github.com/quilljs/quill/blob/1.3.6/themes/base.js#L128
      // needs to be updated in case of switching to Quill 2.0.0
      if (fileInput.files != null && fileInput.files[0] != null) {
        const reader = new FileReader();
        reader.onload = e => {
          const image = e.target.result;
          const range = this._editor.getSelection(true);
          this._editor.updateContents(
            new Quill.imports.delta()
              .retain(range.index)
              .delete(range.length)
              .insert({ image }),
            SOURCE.USER
          );
          this._markToolbarClicked();
          this._editor.setSelection(range.index + 1, SOURCE.SILENT);
          fileInput.value = '';
        };
        reader.readAsDataURL(fileInput.files[0]);
      }
    }

    _disabledChanged(disabled, readonly, editor) {
      if (disabled === undefined || readonly === undefined || editor === undefined) {
        return;
      }

      if (disabled || readonly) {
        editor.enable(false);

        if (disabled) {
          this._toggleToolbarDisabled(true);
        }
      } else {
        editor.enable();

        if (this.__oldDisabled) {
          this._toggleToolbarDisabled(false);
        }
      }

      this.__oldDisabled = disabled;
    }

    _tabStopsChanged(tabStops, _editor) {
      const horizontalRuler = this.shadowRoot.querySelector('[part="horizontalRuler"]');
      if (horizontalRuler) {
        horizontalRuler.innerHTML = '';
      }

      tabStops.forEach(stop => {
        this._addTabStopIcon(stop);
      });
      if (_editor) {
        _editor.emitter.emit('text-change');
      }
    }

    _valueChanged(value, editor) {
      if (editor === undefined) {
        return;
      }

      if (value == null || value == '[{"insert":"\\n"}]') {
        this.value = '';
        return;
      }

      if (value === '') {
        this._clear();
        return;
      }

      let parsedValue;
      try {
        parsedValue = JSON.parse(value);
        if (Array.isArray(parsedValue)) {
          this.__oldValue = value;
        } else {
          throw new Error('expected JSON string with array of objects, got: ' + value);
        }
      } catch (err) {
        // Use old value in case new one is not suitable
        this.value = this.__oldValue;
        console.error('Invalid value set to rich-text-editor:', err);
        return;
      }
      const delta = new Quill.imports.delta(parsedValue);
      // suppress text-change event to prevent infinite loop
      if (JSON.stringify(editor.getContents()) !== JSON.stringify(delta)) {
        editor.setContents(delta, SOURCE.SILENT);
        // in case we have tabstops, they will be rendered in on text-change, so we need to trigger it
        editor.emitter.emit('text-change');
      }
      this.__updateHtmlValue();

      if (this._toolbarState === STATE.CLICKED) {
        this._cleanToolbarState();
        this.__emitChangeEvent();
      } else if (!this._editor.hasFocus()) {
        // value changed from outside
        this.__lastCommittedChange = this.value;
      }
    }

    _addTabStopIcon(tabStop) {
      var icon = document.createElement('iron-icon');
      let iconIcon;
      if (tabStop.direction == 'left') {
        iconIcon = 'vaadin:caret-right';
      } else if (tabStop.direction == 'right') {
        iconIcon = 'vaadin:caret-left';
      } else {
        iconIcon = 'vaadin:dot-circle';
      }

      icon.setAttribute('icon', iconIcon);
      icon.style.width = '15px';
      icon.style.height = '15px';
      icon.style.position = 'absolute';
      icon.style.top = '0px';
      icon.style.left = tabStop.position - 7 + 'px';
      const horizontalRuler = this.shadowRoot.querySelector('[part="horizontalRuler"]');
      horizontalRuler.appendChild(icon);
      icon.tabStop = tabStop;

      var self = this;
      icon.onclick = function(iconEvent) {
        var icon = iconEvent.target;
        var index = self.tabStops.indexOf(icon.tabStop);

        if (icon.getAttribute('icon') == 'vaadin:caret-right') {
          icon.setAttribute('icon', 'vaadin:caret-left');
          icon.tabStop.direction = 'right';
          self.tabStops[index] = icon.tabStop;
        } else if (icon.getAttribute('icon') == 'vaadin:caret-left') {
          icon.setAttribute('icon', 'vaadin:dot-circle');
          icon.tabStop.direction = 'middle';
          self.tabStops[index] = icon.tabStop;
        } else {
          self.tabStops.splice(index, 1);
          icon.parentElement.removeChild(icon);
          icon.remove();
        }

        self.tabStops = Object.assign([], self.tabStops);

        iconEvent.stopPropagation();
        self._editor.emitter.emit('text-change');
      };
    }

    _addTabStop(event) {
      const tabStop = { direction: 'left', position: event.offsetX };
      this.tabStops.push(tabStop);
      this.tabStops.sort((a, b) => a['position'] - b['position']);
      this.tabStops = Object.assign([], this.tabStops);
      this._editor.emitter.emit('text-change');
    }

    /**
     * Fired when the user commits a value change.
     *
     * @event change
     */

    /**
     * @protected
     */
    static _finalizeClass() {
      super._finalizeClass();

      const devModeCallback = window.Vaadin.developmentModeCallback;
      const licenseChecker = devModeCallback && devModeCallback['vaadin-license-checker'];
      if (typeof licenseChecker === 'function') {
        licenseChecker(VcfEnhancedRichTextEditor);
      }
    }
  }

  customElements.define(VcfEnhancedRichTextEditor.is, VcfEnhancedRichTextEditor);

  /**
   * @namespace Vaadin
   */
  window.Vaadin.VcfEnhancedRichTextEditor = VcfEnhancedRichTextEditor;
})();