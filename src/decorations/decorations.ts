import * as vscode from 'vscode';
import { highlightStore } from '../store';

export class HighlightDecorationProvider implements vscode.FileDecorationProvider {
    private _onDidChangeFileDecorations = new vscode.EventEmitter<vscode.Uri | vscode.Uri[] | undefined>();
    public readonly onDidChangeFileDecorations = this._onDidChangeFileDecorations.event;

    private refreshQueue = new Set<string>();
    private debounceTimer?: NodeJS.Timeout;

    constructor(private context: vscode.ExtensionContext) {}

    async provideFileDecoration(uri: vscode.Uri): Promise<vscode.FileDecoration | undefined> {
        const enabled = this.context.workspaceState.get<boolean>('highlighter.enabled', true);
        if (!enabled) return;

        // No workspace open — bail immediately to avoid errors and busy-loops
        if (!vscode.workspace.workspaceFolders?.length) return;

        // After first load this is a synchronous no-op
        await highlightStore.ensureLoaded();

        const highlight = highlightStore.getEffectiveHighlight(uri.fsPath);
        if (!highlight?.color && !highlight?.badge) return;

        return {
            badge: highlight.badge,
            color: highlight.color ? new vscode.ThemeColor(`highlighter.${highlight.color}`) : undefined,
            tooltip: 'Customized Highlight',
            propagate: false
        };
    }

    refresh(uri?: vscode.Uri | vscode.Uri[]) {
        if (!uri) {
            this._onDidChangeFileDecorations.fire(undefined);
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
