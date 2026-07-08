# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.1.0] - 2026-07-08

### Added

- Dracula theme with the official [Dracula](https://draculatheme.com) color palette, selectable alongside Light and Dark
- Code block syntax highlighting for the Dracula theme, tuned for HTML, JavaScript, and CSS and verified pixel-by-pixel against the real VS Code Dracula theme: pink keywords, cyan class/type names, green function/method names, orange italic parameters, purple italic `this`/`self`/`super`, yellow strings, purple numbers, upright (non-italic) comments — object keys and plain variables are left on the foreground color, matching the reference
- `highlightJsDracula()` in `js/app.js`: a hand-rolled JS/TS tokenizer that replaces highlight.js for those languages, since highlight.js never wraps punctuation in spans and can't tell a function declaration's parens from a call's or a class-body brace from a function body's. It reproduces the reference token-for-token: `(`/`)`/`{`/`}` are colored contextually (pink for a declaration's parameter list or a function/object-literal body, cyan for a call, left on the foreground for a `new X(...)` constructor call or a class body), `[`/`]` are cyan, every other bare operator (`=`, `-`, `:`, ...) is pink, `constructor` reads as a keyword (pink) like `get`/`const`, a parameter name is colored everywhere it's referenced (not just at its declaration), a getter/setter name stays on the foreground, and a PascalCase `const`/`let`/`var` binding is purple (an instance) rather than cyan (an actual class reference) unless it directly follows `new`/`class`
- Toolbar buttons: Undo (`Ctrl+Z`) and Redo (`Ctrl+Y`)
- Toolbar Find & Replace panel (`Ctrl+F`) with match highlighting, next/previous navigation, replace and replace-all
- Toolbar Copy Markdown button to copy the raw document to the clipboard
- Toolbar Fullscreen toggle button
- "More" (⋯) dropdown at the far right of the toolbar for switching between Light, Dark, and Dracula themes
- Help entry in the "More" dropdown, opening a modal with logo, author, version, and GitHub link

### Fixed

- Help modal being rendered behind the editor/preview split view due to stacking-context ordering — moved the modal to the end of the document body and raised its `z-index` so it always renders on top
- "More" dropdown being clipped and hidden behind the editor/preview split view — the toolbar has `overflow-y: hidden` for its horizontal scroll behavior, which clipped the dropdown since it was positioned inside it; the dropdown is now rendered outside the toolbar and positioned dynamically via JavaScript against the "..." button
- Dracula code highlighting pointed at a CDN path (`highlight.js/11.9.0/styles/dracula.min.css`) that returns 404, since Dracula isn't one of highlight.js's own bundled themes — replaced with a local stylesheet in `css/style.css`

## [1.0.0] - 2026-05-01

### Added

- Live Markdown editor with real-time GitHub-styled preview
- GitHub Flavored Markdown support (tables, task lists, strikethrough)
- Syntax highlighting for code blocks via Highlight.js
- Dark / Light mode toggle with localStorage persistence
- Toolbar for quick Markdown insertion (headings, bold, italic, code, links, images, tables, etc.)
- Keyboard shortcuts: `Ctrl+B` (bold), `Ctrl+I` (italic), `Ctrl+K` (link), `Ctrl+E` (inline code)
- Tab key support inside the editor
- Export document as `.md` file with auto-generated filename
- Resizable split panes with drag divider
- Mobile-responsive layout with editor / preview tab switcher
- XSS protection via DOMPurify sanitization
- Starter Markdown content on first load
