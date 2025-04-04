import * as vscode from 'vscode';
import { getHighlightMap } from '../highlight';

export class HighlightDecorationProvider implements vscode.FileDecorationProvider {
	private _onDidChangeFileDecorations = new vscode.EventEmitter<vscode.Uri | vscode.Uri[] | undefined>();
	public readonly onDidChangeFileDecorations = this._onDidChangeFileDecorations.event;

	private refreshQueue = new Set<string>();
	private debounceTimer?: NodeJS.Timeout;

	constructor(private context: vscode.ExtensionContext) {}

	async provideFileDecoration(uri: vscode.Uri): Promise<vscode.FileDecoration | undefined> {
		const enabled = this.context.workspaceState.get<boolean>('highlighter.enabled', true);
		if (!enabled) {
			return;
		}
		
		const map = await getHighlightMap();
		const path = uri.fsPath;
		let highlight = map[path];

		if (!highlight) {
			return;
		}

		if (highlight.parent) {
			highlight = map[highlight.parent];
		}

		const color = highlight.color;
		const badge = highlight.badge;

		if (!color && !badge) {
			return;
		}

		return {
			badge,
			color: color ? new vscode.ThemeColor(`highlighter.${color}`) : undefined,
			tooltip: 'Customized Highlight',
			propagate: false
		};
	}

	refresh(uri?: vscode.Uri | vscode.Uri[]) {
		if (!uri) {
			this._onDidChangeFileDecorations.fire(undefined); // global
			return;
		}

		const uris = Array.isArray(uri) ? uri : [uri];
		for (const u of uris) {
			this.refreshQueue.add(u.fsPath);
		}

		if (this.debounceTimer) {
			clearTimeout(this.debounceTimer);
		}

		this.debounceTimer = setTimeout(() => {
			const urisToRefresh = Array.from(this.refreshQueue).map(p => vscode.Uri.file(p));
			this.refreshQueue.clear();
			this._onDidChangeFileDecorations.fire(urisToRefresh);
		}, 75);
	}
}
