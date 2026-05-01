# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

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
