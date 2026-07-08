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

  const btnCopy = document.getElementById('btn-copy');
  const btnFullscreen = document.getElementById('btn-fullscreen');
  const btnMore = document.getElementById('btn-more');
  const moreDropdown = document.getElementById('more-dropdown');
  const btnHelp = document.getElementById('btn-help');
  const helpOverlay = document.getElementById('help-overlay');
  const helpClose = document.getElementById('help-close');

  const findPanel = document.getElementById('find-panel');
  const findInput = document.getElementById('find-input');
  const findCount = document.getElementById('find-count');
  const findPrev = document.getElementById('find-prev');
  const findNext = document.getElementById('find-next');
  const findClose = document.getElementById('find-close');
  const replaceInput = document.getElementById('replace-input');
  const replaceOne = document.getElementById('replace-one');
  const replaceAllBtn = document.getElementById('replace-all');

  // ─── Custom JS/TS highlighter (Dracula-accurate) ───
  // highlight.js never wraps punctuation in spans and can't tell a function
  // declaration's parens from a call's, so it cannot reproduce the reference
  // VS Code Dracula theme (which colors "(", ")", "{", "}", "=", "-", ":"
  // contextually, and colors every reference to a parameter, not just its
  // declaration). This is a small hand-rolled tokenizer + contextual pass
  // built to match that reference exactly:
  //  - "(" / ")" are pink for a function/method declaration's own parameter
  //    list, cyan for a call (`this.calcAge()`), and left on the default
  //    foreground for a `new X(...)` constructor call.
  //  - "{" / "}" are pink for a function/method body or object literal, left
  //    on the default foreground for a class body.
  //  - "[" / "]" are cyan; ".", ",", ";" stay on the default foreground.
  //  - every other single operator ("=", "-", ":", ...) is pink.
  //  - a class name is cyan only right after `new`/`class`; any other
  //    PascalCase `const`/`let`/`var` binding (e.g. `const Dracula = ...`) is
  //    purple, since it holds an instance, not the class itself.
  //  - a parameter name is orange everywhere it's referenced, not only at
  //    its declaration.
  //  - a getter/setter name (`get age()`) stays on the default foreground,
  //    since only the function body's own name (constructor, calcAge, ...)
  //    reads green.
  const JS_LANGS = { javascript: 1, js: 1, jsx: 1, typescript: 1, ts: 1, tsx: 1 };

  const JS_KEYWORDS = new Set([
    'class', 'const', 'let', 'var', 'function', 'get', 'set', 'return', 'new',
    'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue',
    'try', 'catch', 'finally', 'throw', 'typeof', 'instanceof', 'in', 'of',
    'extends', 'static', 'public', 'private', 'protected', 'readonly',
    'async', 'await', 'yield', 'import', 'export', 'default', 'from', 'as',
    'void', 'delete', 'interface', 'type', 'enum', 'implements', 'namespace',
    'constructor'
  ]);
  const JS_THIS_WORDS = new Set(['this', 'self', 'super']);
  const JS_TOKEN_RE = /\/\/.*|\/\*[\s\S]*?\*\/|`(?:\\.|[^`\\])*`|'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|\b0[xX][0-9a-fA-F]+\b|\b\d+\.?\d*(?:[eE][+-]?\d+)?\b|[A-Za-z_$][A-Za-z0-9_$]*|=>|===|!==|==|!=|<=|>=|&&|\|\||\?\?|\.\.\.|[^\sA-Za-z0-9_$]/g;

  function jsTokenize(code) {
    const tokens = [];
    let lastIndex = 0;
    JS_TOKEN_RE.lastIndex = 0;
    let m;
    while ((m = JS_TOKEN_RE.exec(code))) {
      if (m.index > lastIndex) tokens.push({ type: 'ws', value: code.slice(lastIndex, m.index) });
      const v = m[0];
      let type;
      if (v.charAt(0) === '/' && (v.charAt(1) === '/' || v.charAt(1) === '*')) type = 'comment';
      else if (v.charAt(0) === '`' || v.charAt(0) === "'" || v.charAt(0) === '"') type = 'string';
      else if (/^[0-9]/.test(v)) type = 'number';
      else if (/^[A-Za-z_$]/.test(v)) type = 'ident';
      else type = 'punct';
      tokens.push({ type: type, value: v });
      lastIndex = JS_TOKEN_RE.lastIndex;
    }
    if (lastIndex < code.length) tokens.push({ type: 'ws', value: code.slice(lastIndex) });
    return tokens;
  }

  function jsPrevSig(tokens, i) {
    for (let k = i - 1; k >= 0; k--) if (tokens[k].type !== 'ws' && tokens[k].type !== 'comment') return k;
    return -1;
  }
  function jsNextSig(tokens, i) {
    for (let k = i + 1; k < tokens.length; k++) if (tokens[k].type !== 'ws' && tokens[k].type !== 'comment') return k;
    return -1;
  }

  function highlightJsDracula(code) {
    const tokens = jsTokenize(code);
    const n = tokens.length;

    // Match every bracket to its partner.
    const partner = new Array(n).fill(-1);
    const stack = [];
    for (let i = 0; i < n; i++) {
      const t = tokens[i];
      if (t.type !== 'punct') continue;
      if (t.value === '(' || t.value === '{' || t.value === '[') {
        stack.push(i);
      } else if (t.value === ')' || t.value === '}' || t.value === ']') {
        const openIdx = stack.pop();
        if (openIdx !== undefined) { partner[openIdx] = i; partner[i] = openIdx; }
      }
    }

    // Assign a role to each bracket pair (based only on the opening bracket).
    const role = new Array(n).fill(null);
    for (let i = 0; i < n; i++) {
      const t = tokens[i];
      if (t.type !== 'punct' || partner[i] <= i) continue;
      const j = partner[i];
      const p = jsPrevSig(tokens, i);
      let r;
      if (t.value === '(') {
        const pp = p >= 0 ? jsPrevSig(tokens, p) : -1;
        const nx = jsNextSig(tokens, j);
        if (p >= 0 && tokens[p].type === 'ident' && pp >= 0 && tokens[pp].value === 'new') {
          r = 'new-call';
        } else if (p >= 0 && tokens[p].type === 'ident' && pp >= 0 && tokens[pp].value === '.') {
          r = 'method-call';
        } else if (nx >= 0 && tokens[nx].value === '{') {
          r = 'decl-params';
        } else if (p >= 0 && tokens[p].type === 'ident') {
          r = 'call';
        } else {
          r = 'control';
        }
      } else if (t.value === '{') {
        const pp = p >= 0 ? jsPrevSig(tokens, p) : -1;
        if (p >= 0 && tokens[p].type === 'ident' && pp >= 0 && tokens[pp].value === 'class') {
          r = 'class-body';
        } else if (p >= 0 && tokens[p].value === ')' && role[partner[p]] === 'decl-params') {
          r = 'function-body';
        } else if (p >= 0 && tokens[p].value === '(') {
          r = 'object-literal';
        } else {
          r = 'block';
        }
      } else {
        r = 'array';
      }
      role[i] = r;
      role[j] = r;
    }

    // Collect parameter names from every declaration's parameter list, so
    // every later reference to that name (not just the declaration) is
    // recolored, matching the reference.
    const paramNames = new Set();
    for (let i = 0; i < n; i++) {
      if (tokens[i].type !== 'punct' || tokens[i].value !== '(' || role[i] !== 'decl-params') continue;
      const j = partner[i];
      let depth = 0, expecting = true;
      for (let k = i + 1; k < j; k++) {
        const tk = tokens[k];
        if (tk.type === 'ws' || tk.type === 'comment') continue;
        if (tk.type === 'punct' && (tk.value === '(' || tk.value === '{' || tk.value === '[')) { depth++; continue; }
        if (tk.type === 'punct' && (tk.value === ')' || tk.value === '}' || tk.value === ']')) { depth--; continue; }
        if (depth !== 0) continue;
        if (expecting && tk.type === 'ident') { paramNames.add(tk.value); expecting = false; continue; }
        if (tk.type === 'punct' && tk.value === ',') { expecting = true; continue; }
        if (tk.type === 'punct' && (tk.value === '=' || tk.value === ':')) { expecting = false; }
      }
    }

    function span(cls, text) { return '<span class="' + cls + '">' + md.utils.escapeHtml(text) + '</span>'; }

    let html = '';
    for (let i = 0; i < n; i++) {
      const t = tokens[i];
      if (t.type === 'ws') { html += t.value; continue; }
      if (t.type === 'comment') { html += span('hljs-comment', t.value); continue; }
      if (t.type === 'string') { html += span('hljs-string', t.value); continue; }
      if (t.type === 'number') { html += span('hljs-number', t.value); continue; }

      if (t.type === 'ident') {
        const v = t.value;
        if (JS_KEYWORDS.has(v)) { html += span('hljs-keyword', v); continue; }
        if (JS_THIS_WORDS.has(v)) { html += span('hljs-variable language_', v); continue; }

        const p = jsPrevSig(tokens, i);
        if (p >= 0 && tokens[p].type === 'ident' && (tokens[p].value === 'new' || tokens[p].value === 'class')) {
          html += span('hljs-title class_', v); continue;
        }
        if (paramNames.has(v)) { html += span('hljs-params', v); continue; }

        const nx = jsNextSig(tokens, i);
        if (nx >= 0 && tokens[nx].type === 'punct' && tokens[nx].value === '(') {
          const r = role[nx];
          if (r === 'decl-params') {
            const pv = p >= 0 ? tokens[p].value : null;
            if (pv === 'get' || pv === 'set') { html += md.utils.escapeHtml(v); continue; }
            html += span('hljs-title function_', v); continue;
          }
          if (r === 'call' || r === 'method-call') { html += span('hljs-title function_', v); continue; }
        }
        if (p >= 0 && tokens[p].type === 'punct' && tokens[p].value === '.') { html += md.utils.escapeHtml(v); continue; }
        if (p >= 0 && tokens[p].type === 'ident' && (tokens[p].value === 'const' || tokens[p].value === 'let' || tokens[p].value === 'var') && /^[A-Z]/.test(v)) {
          html += span('drc-instance', v); continue;
        }
        html += md.utils.escapeHtml(v);
        continue;
      }

      // Punctuation
      const v = t.value;
      if (v === '(' || v === ')') {
        const r = role[v === '(' ? i : partner[i]];
        if (r === 'decl-params') { html += span('drc-punct-pink', v); continue; }
        if (r === 'method-call' || r === 'call') { html += span('drc-punct-cyan', v); continue; }
        html += md.utils.escapeHtml(v); continue;
      }
      if (v === '{' || v === '}') {
        const r = role[v === '{' ? i : partner[i]];
        if (r === 'class-body') { html += md.utils.escapeHtml(v); continue; }
        html += span('drc-punct-pink', v); continue;
      }
      if (v === '[' || v === ']') { html += span('drc-punct-cyan', v); continue; }
      if (v === '.' || v === ',' || v === ';') { html += md.utils.escapeHtml(v); continue; }
      html += span('drc-punct-pink', v);
    }
    return html;
  }

  // ─── Configure markdown-it ───
  const md = window.markdownit({
    html: true,
    linkify: true,
    typographer: false,
    breaks: true,
    highlight: function (str, lang) {
      if (JS_LANGS[lang]) {
        try { return '<pre class="hljs"><code>' + highlightJsDracula(str) + '</code></pre>'; } catch (_) {}
      }
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

  const specialActions = {
    undo: function () { editor.focus(); document.execCommand('undo'); scheduleRender(); },
    redo: function () { editor.focus(); document.execCommand('redo'); scheduleRender(); },
    find: function () { openFindPanel(); },
    copy: function () { copyMarkdown(); },
    fullscreen: function () { toggleFullscreen(); }
  };

  toolbar.addEventListener('click', function (e) {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    if (specialActions[action]) {
      specialActions[action]();
      return;
    }
    insertMarkdown(action);
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
        case 'f':
          e.preventDefault();
          openFindPanel();
          break;
        case 'y':
          e.preventDefault();
          specialActions.redo();
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

  // ─── Copy Markdown ───
  function copyMarkdown() {
    navigator.clipboard.writeText(editor.value).then(function () {
      btnCopy.classList.add('copied');
      btnCopy.querySelector('.icon-copy').style.display = 'none';
      btnCopy.querySelector('.icon-check').style.display = '';
      setTimeout(function () {
        btnCopy.classList.remove('copied');
        btnCopy.querySelector('.icon-copy').style.display = '';
        btnCopy.querySelector('.icon-check').style.display = 'none';
      }, 1500);
    });
  }

  // ─── Fullscreen ───
  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(function () {});
    } else {
      document.exitFullscreen();
    }
  }

  document.addEventListener('fullscreenchange', function () {
    const isFs = !!document.fullscreenElement;
    btnFullscreen.querySelector('.icon-expand').style.display = isFs ? 'none' : '';
    btnFullscreen.querySelector('.icon-compress').style.display = isFs ? '' : 'none';
  });

  // ─── Find & Replace ───
  let findMatches = [];
  let findIndex = -1;

  function openFindPanel() {
    findPanel.classList.add('show');
    const selected = editor.value.substring(editor.selectionStart, editor.selectionEnd);
    if (selected) findInput.value = selected;
    findInput.focus();
    findInput.select();
    runFind();
  }

  function closeFindPanel() {
    findPanel.classList.remove('show');
    findMatches = [];
    findIndex = -1;
  }

  function runFind() {
    const query = findInput.value;
    findMatches = [];
    if (query) {
      const text = editor.value;
      const lower = text.toLowerCase();
      const needle = query.toLowerCase();
      let pos = 0;
      while (true) {
        const idx = lower.indexOf(needle, pos);
        if (idx === -1) break;
        findMatches.push(idx);
        pos = idx + needle.length;
      }
    }
    findIndex = findMatches.length ? 0 : -1;
    updateFindUI(true);
  }

  function updateFindUI(scrollTo) {
    if (!findMatches.length) {
      findCount.textContent = '0/0';
      return;
    }
    findCount.textContent = (findIndex + 1) + '/' + findMatches.length;
    if (scrollTo) selectMatch(findIndex);
  }

  function selectMatch(i) {
    if (i < 0 || i >= findMatches.length) return;
    const start = findMatches[i];
    const len = findInput.value.length;
    editor.focus();
    editor.setSelectionRange(start, start + len);
  }

  function goToMatch(delta) {
    if (!findMatches.length) return;
    findIndex = (findIndex + delta + findMatches.length) % findMatches.length;
    updateFindUI(true);
  }

  findInput.addEventListener('input', runFind);
  findNext.addEventListener('click', function () { goToMatch(1); });
  findPrev.addEventListener('click', function () { goToMatch(-1); });
  findClose.addEventListener('click', closeFindPanel);

  findInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      goToMatch(e.shiftKey ? -1 : 1);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeFindPanel();
    }
  });

  replaceInput.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeFindPanel();
    }
  });

  replaceOne.addEventListener('click', function () {
    if (findIndex === -1 || !findMatches.length) return;
    const start = findMatches[findIndex];
    const len = findInput.value.length;
    editor.setRangeText(replaceInput.value, start, start + len, 'end');
    scheduleRender();
    runFind();
  });

  replaceAllBtn.addEventListener('click', function () {
    if (!findInput.value) return;
    const query = findInput.value;
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(escaped, 'gi');
    editor.value = editor.value.replace(re, replaceInput.value);
    scheduleRender();
    runFind();
  });

  // ─── More dropdown ───
  // Positioned via JS (not CSS position:absolute) because #toolbar has
  // overflow-y:hidden for horizontal scrolling, which would clip an
  // absolutely-positioned dropdown anchored inside it.
  function positionMoreDropdown() {
    const rect = btnMore.getBoundingClientRect();
    moreDropdown.style.top = (rect.bottom + 6) + 'px';
    moreDropdown.style.right = (window.innerWidth - rect.right) + 'px';
  }

  btnMore.addEventListener('click', function (e) {
    e.stopPropagation();
    const willShow = !moreDropdown.classList.contains('show');
    if (willShow) positionMoreDropdown();
    moreDropdown.classList.toggle('show', willShow);
    btnMore.classList.toggle('active', willShow);
  });

  window.addEventListener('resize', function () {
    if (moreDropdown.classList.contains('show')) positionMoreDropdown();
  });

  moreDropdown.querySelectorAll('.dropdown-item[data-theme]').forEach(function (item) {
    item.addEventListener('click', function () {
      applyTheme(item.dataset.theme);
      moreDropdown.classList.remove('show');
      btnMore.classList.remove('active');
    });
  });

  document.addEventListener('click', function (e) {
    if (!moreDropdown.contains(e.target) && e.target !== btnMore) {
      moreDropdown.classList.remove('show');
      btnMore.classList.remove('active');
    }
  });

  // ─── Help modal ───
  function openHelp() {
    moreDropdown.classList.remove('show');
    btnMore.classList.remove('active');
    helpOverlay.classList.add('show');
  }

  function closeHelp() {
    helpOverlay.classList.remove('show');
  }

  btnHelp.addEventListener('click', openHelp);
  helpClose.addEventListener('click', closeHelp);
  helpOverlay.addEventListener('click', function (e) {
    if (e.target === helpOverlay) closeHelp();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (helpOverlay.classList.contains('show')) closeHelp();
      else if (findPanel.classList.contains('show')) closeFindPanel();
    }
  });

  // ─── Theme (Light / Dark / Dracula) ───
  function applyTheme(mode) {
    htmlEl.setAttribute('data-color-mode', mode);

    document.getElementById('github-md-light').disabled = mode !== 'light';
    document.getElementById('github-md-dark').disabled = mode === 'light';
    document.getElementById('hljs-light').disabled = mode !== 'light';
    document.getElementById('hljs-dark').disabled = mode !== 'dark';

    localStorage.setItem('neiki-md-theme', mode);

    moreDropdown.querySelectorAll('.dropdown-item[data-theme]').forEach(function (item) {
      item.classList.toggle('active', item.dataset.theme === mode);
    });

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
