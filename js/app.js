/* ========================================
   Neiki's Markdown Editor — app.js
   ======================================== */

(function () {
  'use strict';

  // ─── DOM refs ───
  const editor = document.getElementById('editor');
  const preview = document.getElementById('preview');
  const previewPane = document.getElementById('preview-pane');
  const editorPane = document.getElementById('editor-pane');
  const divider = document.getElementById('divider');
  const splitContainer = document.getElementById('split-container');
  const btnReset = document.getElementById('btn-reset');
  const btnExport = document.getElementById('btn-export');
  const btnTheme = document.getElementById('btn-theme');
  const toolbar = document.getElementById('toolbar');
  const htmlEl = document.documentElement;

  // ─── Configure markdown-it ───
  const md = window.markdownit({
    html: true,
    linkify: true,
    typographer: false,
    breaks: true,
    highlight: function (str, lang) {
      if (lang && hljs.getLanguage(lang)) {
        try {
          return '<pre class="hljs"><code>' +
            hljs.highlight(str, { language: lang, ignoreIllegals: true }).value +
            '</code></pre>';
        } catch (_) {}
      }
      return '<pre class="hljs"><code>' + md.utils.escapeHtml(str) + '</code></pre>';
    }
  });

  // Task list support via inline rule
  md.core.ruler.after('inline', 'task-lists', function (state) {
    var tokens = state.tokens;
    for (var i = 2; i < tokens.length; i++) {
      if (tokens[i].type === 'inline' &&
          tokens[i - 1].type === 'paragraph_open' &&
          tokens[i - 2].type === 'list_item_open') {
        var content = tokens[i].content;
        if (/^\[[ xX]\]\s/.test(content)) {
          var checked = /^\[[xX]\]/.test(content);
          tokens[i].content = content.replace(/^\[[ xX]\]\s/, '');
          tokens[i].children && tokens[i].children.forEach(function (child) {
            if (child.type === 'text' && /^\[[ xX]\]\s/.test(child.content)) {
              child.content = child.content.replace(/^\[[ xX]\]\s/, '');
            }
          });
          var checkbox = '<input type="checkbox" disabled' + (checked ? ' checked' : '') + '> ';
          tokens[i - 2].attrSet('class', 'task-list-item');
          tokens[i - 2].attrSet('style', 'list-style:none');
          // Prepend checkbox HTML to inline content
          var inlineToken = new state.Token('html_inline', '', 0);
          inlineToken.content = checkbox;
          tokens[i].children.unshift(inlineToken);
        }
      }
    }
  });

  // ─── Render preview ───
  let renderTimer = null;

  function renderPreview() {
    const raw = editor.value;
    const html = md.render(raw);
    const clean = DOMPurify.sanitize(html, {
      ADD_TAGS: ['input'],
      ADD_ATTR: ['checked', 'disabled', 'type', 'class', 'style']
    });
    preview.innerHTML = clean;
  }

  function scheduleRender() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(renderPreview, 80);
  }

  editor.addEventListener('input', scheduleRender);

  // ─── Toolbar actions ───
  const toolbarActions = {
    h1:            { before: '# ',            after: '',            placeholder: 'Heading 1',  wrap: false },
    h2:            { before: '## ',           after: '',            placeholder: 'Heading 2',  wrap: false },
    h3:            { before: '### ',          after: '',            placeholder: 'Heading 3',  wrap: false },
    bold:          { before: '**',            after: '**',          placeholder: 'bold text',  wrap: true },
    italic:        { before: '*',             after: '*',           placeholder: 'italic text', wrap: true },
    strikethrough: { before: '~~',            after: '~~',          placeholder: 'strikethrough', wrap: true },
    inlinecode:    { before: '`',             after: '`',           placeholder: 'code',       wrap: true },
    codeblock:     { before: '```\n',         after: '\n```',       placeholder: 'code here',  wrap: true },
    blockquote:    { before: '> ',            after: '',            placeholder: 'quote',      wrap: false },
    ul:            { before: '- ',            after: '',            placeholder: 'List item',  wrap: false },
    ol:            { before: '1. ',           after: '',            placeholder: 'List item',  wrap: false },
    tasklist:      { before: '- [ ] ',        after: '',            placeholder: 'Task item',  wrap: false },
    hr:            { before: '\n---\n',       after: '',            placeholder: '',            wrap: false },
    link:          { before: '[',             after: '](url)',      placeholder: 'link text',  wrap: true },
    image:         { before: '![',            after: '](url)',      placeholder: 'alt text',   wrap: true },
    table:         { before: '| Header | Header |\n| ------ | ------ |\n| Cell   | Cell   |\n', after: '', placeholder: '', wrap: false }
  };

  function insertMarkdown(action) {
    const cfg = toolbarActions[action];
    if (!cfg) return;

    editor.focus();
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const text = editor.value;
    const selected = text.substring(start, end);

    let insert;
    if (cfg.wrap && selected.length > 0) {
      insert = cfg.before + selected + cfg.after;
    } else {
      insert = cfg.before + (selected || cfg.placeholder) + cfg.after;
    }

    editor.setRangeText(insert, start, end, 'end');

    // If placeholder was used, select it
    if (!selected && cfg.placeholder) {
      const pStart = start + cfg.before.length;
      const pEnd = pStart + cfg.placeholder.length;
      editor.setSelectionRange(pStart, pEnd);
    }

    scheduleRender();
  }

  toolbar.addEventListener('click', function (e) {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    insertMarkdown(btn.dataset.action);
  });

  // ─── Keyboard shortcuts ───
  editor.addEventListener('keydown', function (e) {
    // Tab insertion
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = editor.selectionStart;
      const end = editor.selectionEnd;
      editor.setRangeText('\t', start, end, 'end');
      scheduleRender();
      return;
    }

    // Ctrl/Cmd shortcuts
    if (e.ctrlKey || e.metaKey) {
      switch (e.key.toLowerCase()) {
        case 'b':
          e.preventDefault();
          insertMarkdown('bold');
          break;
        case 'i':
          e.preventDefault();
          insertMarkdown('italic');
          break;
        case 'k':
          e.preventDefault();
          insertMarkdown('link');
          break;
        case 'e':
          e.preventDefault();
          insertMarkdown('inlinecode');
          break;
      }
    }
  });

  // ─── Reset ───
  btnReset.addEventListener('click', function () {
    if (editor.value.trim() === '') return;
    if (!confirm('Are you sure you want to clear the editor?')) return;
    editor.value = '';
    renderPreview();
  });

  // ─── Export ───
  btnExport.addEventListener('click', function () {
    const content = editor.value;
    // Try to derive filename from first heading
    let filename = 'untitled.md';
    const match = content.match(/^#+\s+(.+)$/m);
    if (match) {
      filename = match[1]
        .trim()
        .replace(/[^a-zA-Z0-9\s_-]/g, '')
        .replace(/\s+/g, '-')
        .toLowerCase()
        .substring(0, 60) + '.md';
    }

    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  // ─── Dark / Light Mode ───
  function applyTheme(mode) {
    htmlEl.setAttribute('data-color-mode', mode);

    const isLight = mode === 'light';

    document.getElementById('github-md-light').disabled = !isLight;
    document.getElementById('github-md-dark').disabled = isLight;
    document.getElementById('hljs-light').disabled = !isLight;
    document.getElementById('hljs-dark').disabled = isLight;

    localStorage.setItem('neiki-md-theme', mode);

    // Re-render preview so code blocks pick up new theme
    renderPreview();
  }

  btnTheme.addEventListener('click', function () {
    const current = htmlEl.getAttribute('data-color-mode') || 'light';
    applyTheme(current === 'light' ? 'dark' : 'light');
  });

  // Restore saved theme
  (function () {
    const saved = localStorage.getItem('neiki-md-theme');
    applyTheme(saved || 'light');
  })();

  // ─── Draggable divider ───
  let isDragging = false;

  divider.addEventListener('mousedown', function (e) {
    e.preventDefault();
    isDragging = true;
    divider.classList.add('dragging');
    document.body.classList.add('no-select');
  });

  document.addEventListener('mousemove', function (e) {
    if (!isDragging) return;
    const containerRect = splitContainer.getBoundingClientRect();
    const offset = e.clientX - containerRect.left;
    const total = containerRect.width;
    const dividerWidth = divider.offsetWidth;

    // Clamp between 15% and 85%
    const minPx = total * 0.15;
    const maxPx = total * 0.85;
    const clamped = Math.max(minPx, Math.min(maxPx, offset));

    const leftPercent = (clamped / total) * 100;
    const rightPercent = ((total - clamped - dividerWidth) / total) * 100;

    editorPane.style.flex = 'none';
    editorPane.style.width = leftPercent + '%';
    previewPane.style.flex = 'none';
    previewPane.style.width = rightPercent + '%';
  });

  document.addEventListener('mouseup', function () {
    if (!isDragging) return;
    isDragging = false;
    divider.classList.remove('dragging');
    document.body.classList.remove('no-select');
  });

  // Touch support for divider
  divider.addEventListener('touchstart', function (e) {
    e.preventDefault();
    isDragging = true;
    divider.classList.add('dragging');
  }, { passive: false });

  document.addEventListener('touchmove', function (e) {
    if (!isDragging) return;
    const touch = e.touches[0];
    const containerRect = splitContainer.getBoundingClientRect();
    const offset = touch.clientX - containerRect.left;
    const total = containerRect.width;
    const dividerWidth = divider.offsetWidth;

    const minPx = total * 0.15;
    const maxPx = total * 0.85;
    const clamped = Math.max(minPx, Math.min(maxPx, offset));

    const leftPercent = (clamped / total) * 100;
    const rightPercent = ((total - clamped - dividerWidth) / total) * 100;

    editorPane.style.flex = 'none';
    editorPane.style.width = leftPercent + '%';
    previewPane.style.flex = 'none';
    previewPane.style.width = rightPercent + '%';
  }, { passive: false });

  document.addEventListener('touchend', function () {
    if (!isDragging) return;
    isDragging = false;
    divider.classList.remove('dragging');
  });

  // ─── Mobile tabs ───
  const mobileTabs = document.getElementById('mobile-tabs');

  function updateMobileView(tab) {
    splitContainer.classList.remove('show-editor', 'show-preview');
    splitContainer.classList.add('show-' + tab);
    mobileTabs.querySelectorAll('.mobile-tab').forEach(function (t) {
      t.classList.toggle('active', t.dataset.tab === tab);
    });
  }

  mobileTabs.addEventListener('click', function (e) {
    const tab = e.target.closest('.mobile-tab');
    if (!tab) return;
    updateMobileView(tab.dataset.tab);
  });

  // Init mobile view
  updateMobileView('editor');

  // ─── Starter content ───
  const starterMarkdown = `# Welcome to Neiki's Markdown Editor

This is a **live Markdown editor** with a real-time preview. Start typing on the left and see the rendered output on the right!

## Features

- **GitHub Flavored Markdown** support
- **Syntax highlighting** for code blocks
- **Dark / Light** mode toggle
- **Toolbar** for quick Markdown insertion
- **Keyboard shortcuts**: \`Ctrl+B\` (bold), \`Ctrl+I\` (italic), \`Ctrl+K\` (link)
- **Export** your document as \`.md\`
- **Resizable** split panes

## Code Example

\`\`\`javascript
function greet(name) {
  console.log(\`Hello, \${name}!\`);
}

greet('World');
\`\`\`

## Table

| Feature        | Status |
| -------------- | ------ |
| GFM Tables     | ✅      |
| Task Lists     | ✅      |
| Code Highlight | ✅      |
| Dark Mode      | ✅      |

## Task List

- [x] Build the editor
- [x] Add live preview
- [ ] Write documentation
- [ ] Share with the world

## Blockquote

> Markdown is a lightweight markup language that you can use to add formatting elements to plain text documents.

---

*Happy writing!* 🚀
`;

  editor.value = starterMarkdown;
  renderPreview();

})();
