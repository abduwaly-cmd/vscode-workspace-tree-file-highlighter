import * as vscode from 'vscode';
import * as nodePath from 'path';

export type HighlightInfo = {
    color?: string;
    badge?: string;
};

export type HighlightMap = Record<string, HighlightInfo>;

// Old format had a "parent" field on child entries — migrated transparently on load
type RawHighlightInfo = HighlightInfo & { parent?: string };

class HighlightStore {
    private _map = new Map<string, HighlightInfo>();
    private _loaded = false;
    private _loadPromise?: Promise<void>;
    private _saveTimer?: NodeJS.Timeout;
    /** Tracks in-flight writes so the FileSystemWatcher can ignore our own changes. */
    private _pendingWrites = 0;
    private _watcher?: vscode.FileSystemWatcher;

    get isLoaded(): boolean {
        return this._loaded;
    }

    /**
     * Ensures the map is populated from disk. Safe to call repeatedly —
     * subsequent calls are synchronous no-ops once the store is loaded.
     */
    async ensureLoaded(): Promise<void> {
        if (this._loaded) return;
        if (!this._loadPromise) {
            this._loadPromise = this._doLoad().finally(() => {
                this._loadPromise = undefined;
            });
        }
        return this._loadPromise;
    }

    private async _doLoad(): Promise<void> {
        const uri = getHighlightFileUri();
        if (!uri) {
            this._map.clear();
            this._loaded = true;
            return;
        }
        try {
            const bytes = await vscode.workspace.fs.readFile(uri);
            const raw = JSON.parse(bytes.toString()) as Record<string, RawHighlightInfo>;
            this._map.clear();
            for (const [filePath, info] of Object.entries(raw)) {
                // Skip legacy child entries that only carried a parent reference
                if (!info.parent && (info.color || info.badge)) {
                    this._map.set(filePath, { color: info.color, badge: info.badge });
                }
            }
        } catch {
            this._map.clear();
        }
        this._loaded = true;
    }

    /** Mark the store stale so the next ensureLoaded() re-reads from disk. */
    invalidate(): void {
        this._loaded = false;
    }

    /**
     * Returns the highlight for fsPath, falling back to the nearest highlighted
     * ancestor. O(path depth) with zero file I/O.
     */
    getEffectiveHighlight(fsPath: string): HighlightInfo | undefined {
        const direct = this._map.get(fsPath);
        if (direct) return direct;

        const { root } = nodePath.parse(fsPath);
        let current = nodePath.dirname(fsPath);
        while (current !== root) {
            const ancestor = this._map.get(current);
            if (ancestor) return ancestor;
            const parent = nodePath.dirname(current);
            if (parent === current) break;
            current = parent;
        }
        return undefined;
    }

    /** True if fsPath has a direct (non-inherited) entry in the map. */
    isDirect(fsPath: string): boolean {
        return this._map.has(fsPath);
    }

    /** True if any map key is a descendant of dirPath. */
    hasDescendants(dirPath: string): boolean {
        const prefix = dirPath + nodePath.sep;
        for (const key of this._map.keys()) {
            if (key.startsWith(prefix)) return true;
        }
        return false;
    }

    set(fsPath: string, info: HighlightInfo): void {
        this._map.set(fsPath, info);
        this._scheduleSave();
    }

    delete(fsPath: string): void {
        this._map.delete(fsPath);
        this._scheduleSave();
    }

    /** Removes all entries in the map that are descendants of dirPath. */
    deleteDescendants(dirPath: string): void {
        const prefix = dirPath + nodePath.sep;
        let changed = false;
        for (const key of [...this._map.keys()]) {
            if (key.startsWith(prefix)) {
                this._map.delete(key);
                changed = true;
            }
        }
        if (changed) this._scheduleSave();
    }

    /**
     * Watches .vscode/highlightedFiles.json for external changes (e.g. git checkout,
     * manual edits) and reloads the store when they occur.
     */
    setupWatcher(context: vscode.ExtensionContext, onReload: () => void): void {
        this._watcher?.dispose();
        const folders = vscode.workspace.workspaceFolders;
        if (!folders?.length) return;

        const pattern = new vscode.RelativePattern(folders[0], '.vscode/highlightedFiles.json');
        this._watcher = vscode.workspace.createFileSystemWatcher(pattern);

        const maybeReload = () => {
            // Ignore events triggered by our own _persist() writes
            if (this._pendingWrites > 0) return;
            this.invalidate();
            onReload();
        };

        context.subscriptions.push(
            this._watcher.onDidChange(maybeReload),
            this._watcher.onDidCreate(maybeReload),
            this._watcher.onDidDelete(maybeReload),
            this._watcher
        );
    }

    private _scheduleSave(): void {
        if (this._saveTimer) clearTimeout(this._saveTimer);
        this._saveTimer = setTimeout(() => this._persist(), 200);
    }

    private async _persist(): Promise<void> {
        const uri = getHighlightFileUri();
        if (!uri) return;

        this._pendingWrites++;
        try {
            const vsCodeDir = vscode.Uri.joinPath(uri, '..');
            try {
                await vscode.workspace.fs.stat(vsCodeDir);
            } catch {
                await vscode.workspace.fs.createDirectory(vsCodeDir);
            }

            const obj: HighlightMap = Object.fromEntries(this._map);
            await vscode.workspace.fs.writeFile(
                uri,
                Buffer.from(JSON.stringify(obj, null, 2), 'utf8')
            );
        } finally {
            // Delay the decrement so the watcher event (async) still sees pendingWrites > 0
            setTimeout(() => { this._pendingWrites--; }, 500);
        }
    }
}

/** Returns the URI for highlightedFiles.json, or undefined when no workspace is open. */
export function getHighlightFileUri(): vscode.Uri | undefined {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders?.length) return undefined;
    return vscode.Uri.joinPath(folders[0].uri, '.vscode', 'highlightedFiles.json');
}

export const highlightStore = new HighlightStore();
