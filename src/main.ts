import { MarkdownView, Plugin } from "obsidian";
import { EditorView } from "@codemirror/view";
import { toggleFold } from "@codemirror/language";

const DOUBLE_CLICK_MS = 400;
const TAP_MAX_DURATION_MS = 300;
const TAP_MAX_MOVE_PX = 10;

export default class HeadingClickFoldPlugin extends Plugin {
	private lastHeading: {
		view: EditorView;
		lineFrom: number;
		at: number;
	} | null = null;

	private pointerStart: {
		x: number;
		y: number;
		time: number;
		pointerId: number;
	} | null = null;

	async onload() {
		this.registerDomEvent(document, "pointerdown", this.onPointerDown, true);
		this.registerDomEvent(document, "pointerup", this.onPointerUp, true);
		this.registerDomEvent(document, "pointercancel", this.onPointerCancel, true);
	}

	private onPointerCancel = () => {
		this.pointerStart = null;
	};

	private onPointerDown = (event: PointerEvent) => {
		// Accept mouse, touch, and pen. Only primary button for mouse.
		if (event.pointerType === "mouse" && event.button !== 0) return;

		this.pointerStart = {
			x: event.clientX,
			y: event.clientY,
			time: performance.now(),
			pointerId: event.pointerId
		};
	};

	private onPointerUp = (event: PointerEvent) => {
		const start = this.pointerStart;
		this.pointerStart = null;
		if (!start || start.pointerId !== event.pointerId) return;

		const duration = performance.now() - start.time;
		const dx = Math.abs(event.clientX - start.x);
		const dy = Math.abs(event.clientY - start.y);

		// Must be a quick tap with minimal movement (so scrolling isn't hijacked).
		if (duration > TAP_MAX_DURATION_MS) return;
		if (dx > TAP_MAX_MOVE_PX || dy > TAP_MAX_MOVE_PX) return;

		this.handleTap(event);
	};

	private handleTap(event: PointerEvent) {
		const target = event.target;
		if (!(target instanceof Element)) return;

		const cm = target.closest(".cm-editor");
		if (!cm) return;

		const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!markdownView) return;

		const editorEl = markdownView.containerEl.querySelector(".cm-editor");
		if (!editorEl || !editorEl.contains(cm)) return;

		// @ts-expect-error Obsidian exposes the CodeMirror 6 editor as view.editor.cm
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

		// Prevent the tap from placing the cursor in the heading.
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

		view.dispatch({ selection: { anchor: line.from } });
		toggleFold(view);
	}

	private editHeading(
		view: EditorView,
		lineFrom: number,
		lineTo: number,
		textStart: number
	) {
		const text = view.state.doc.sliceString(textStart, lineTo);
		const cleaned = text.replace(/\s+#+\s*$/, "");
		const end = textStart + cleaned.length;

		view.dispatch({
			selection: { anchor: textStart, head: end },
			scrollIntoView: true
		});
		view.focus();
	}
}
