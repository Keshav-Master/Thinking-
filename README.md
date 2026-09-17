# Heading Click Fold

Obsidian plugin behavior:

- **Single-click a Markdown heading:** immediately toggle that heading's section.
- **Double-click the same heading:** enter heading-name editing and select the heading text.
- Works in Live Preview/editor mode.
- Uses CodeMirror 6's built-in `toggleFold` command.

## Install with BRAT

1. Put this project in a GitHub repository.
2. Run `npm install` and `npm run build`.
3. Commit `manifest.json` and the generated `main.js`.
4. In Obsidian, install **BRAT**.
5. Add the GitHub repository URL in BRAT.
6. Enable **Heading Click Fold**.

The generated `main.js` is the file Obsidian loads.
