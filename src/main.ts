import { MarkdownView, Plugin } from "obsidian";
import { EditorView } from "@codemirror/view";
import { toggleFold } from "@codemirror/language";

const DOUBLE_CLICK_MS = 350;

export default class HeadingClickFoldPlugin extends Plugin {
	private lastHeading: {
		view: EditorView;
		lineFrom: number;
		at: number;
	} | null = null;

	async onload() {
		this.registerDomEvent(document, "pointerdown", this.onPointerDown, true);
	}

	private onPointerDown = (event: PointerEvent) => {
		// Only primary mouse button. Touch/stylus are left to Obsidian's normal behavior.
		if (event.button !== 0 || event.pointerType !== "mouse") return;

		const target = event.target;
		if (!(target instanceof Element)) return;

		const cm = target.closest(".cm-editor");
		if (!cm) return;

		const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!markdownView) return;

		const editorEl = markdownView.containerEl.querySelector(".cm-editor");
		if (!editorEl || !editorEl.contains(cm)) return;

		// @ts-expect-error Obsidian exposes the CodeMirror 6 editor as view.editor.cm,
		// but it isn't currently typed by the public API.
		const view = markdownView.editor.cm as EditorView;
		if (!view || !view.dom.contains(target)) return;

		const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
		if (pos == null) return;

		const line = view.state.doc.lineAt(pos);
		const match = line.text.match(/^(\s{0,3})(#{1,6})(?:[ \t]+|$)/);
		if (!match) {
			this.lastHeading = null;
			return;
		}

		const headingTextStart = line.from + match[0].length;
		const isDouble = !!this.lastHeading &&
			this.lastHeading.view === view &&
			this.lastHeading.lineFrom === line.from &&
			performance.now() - this.lastHeading.at <= DOUBLE_CLICK_MS;

		// Prevent the first click from placing the cursor in the heading.
		event.preventDefault();
		event.stopPropagation();

		if (isDouble) {
			this.lastHeading = null;
			this.editHeading(view, line.from, line.to, headingTextStart);
			return;
		}

		this.lastHeading = {
			view,
			lineFrom: line.from,
			at: performance.now()
		};

		// Toggle immediately on the first click.
		toggleFold(view);
	};

	private editHeading(
		view: EditorView,
		lineFrom: number,
		lineTo: number,
		textStart: number
	) {
		const text = view.state.doc.sliceString(textStart, lineTo);

		// Remove optional closing # characters only when they are separated by whitespace.
		const cleaned = text.replace(/\s+#+\s*$/, "");
		const end = textStart + cleaned.length;

		view.dispatch({
			selection: { anchor: textStart, head: end },
			scrollIntoView: true
		});
		view.focus();
	}
}
