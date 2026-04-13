import * as vscode from 'vscode';
import * as nodePath from 'path';
import { highlightStore, HighlightInfo } from '../store';

export class HighlightItem extends vscode.TreeItem {
    constructor(
        readonly fsPath: string,
        readonly info: HighlightInfo,
        workspaceRoot: string,
    ) {
        super(nodePath.basename(fsPath), vscode.TreeItemCollapsibleState.None);

        this.resourceUri = vscode.Uri.file(fsPath);
        this.contextValue = 'highlightedItem';

        const relDir = nodePath.dirname(nodePath.relative(workspaceRoot, fsPath));
        this.description = relDir === '.' ? '' : relDir;

        const colorParts = [info.color ?? '', info.badge ?? ''].filter(Boolean).join('  ');
        this.tooltip = new vscode.MarkdownString(
            `**${nodePath.basename(fsPath)}**\n\n${colorParts ? colorParts + '\n\n' : ''}${fsPath}`
        );

        // Colored circle icon — visually maps to the highlight color
        this.iconPath = info.color
            ? new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor(`highlighter.${info.color}`))
            : new vscode.ThemeIcon('circle-outline');

        // Clicking reveals the item in the Explorer
        this.command = {
            command: 'revealInExplorer',
            title: 'Reveal in Explorer',
            arguments: [this.resourceUri],
        };
    }
}

class HighlightsProvider implements vscode.TreeDataProvider<HighlightItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<HighlightItem | undefined | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: HighlightItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: HighlightItem): Promise<HighlightItem[]> {
        if (element) {return [];}

        const folders = vscode.workspace.workspaceFolders;
        if (!folders?.length) {return [];}

        await highlightStore.ensureLoaded();

        const workspaceRoot = folders[0].uri.fsPath;
        const items: HighlightItem[] = [];

        for (const [fsPath, info] of highlightStore.entries()) {
            items.push(new HighlightItem(fsPath, info, workspaceRoot));
        }

        return items.sort((a, b) => a.fsPath.localeCompare(b.fsPath));
    }
}

let _provider: HighlightsProvider;

export function createHighlightsProvider(): HighlightsProvider {
    _provider = new HighlightsProvider();
    return _provider;
}

export function getHighlightsProvider(): HighlightsProvider {
    return _provider;
}
