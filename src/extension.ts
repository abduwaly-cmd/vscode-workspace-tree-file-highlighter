import * as vscode from 'vscode';

import {
    createStatusBar,
    updateStatusBar,
    enableHighlighter,
    disableHighlighter,
    toggleHighlighter,
    setGitDecorations,
    updateHighlighterContext
} from './utils';

import { onDidChangeHighlighterState } from './events';
import { updateCustomizations, removeHighlight } from './highlight';
import {
    createHighlightDecorationProvider,
    getHighlightDecorationProvider
} from './decorations/decorator';
import { highlightStore } from './store';
import {
    createHighlightsProvider,
    getHighlightsProvider,
    HighlightItem
} from './highlights-view/highlightsProvider';


export async function activate(context: vscode.ExtensionContext) {
    const stateKey = 'highlighter.enabled';
    const toggleCommandId = 'highlighter.toggle';

    const isEnabled = context.workspaceState.get<boolean>(stateKey, true);

    // --- Status bar ---
    const statusBar = createStatusBar(toggleCommandId);
    context.subscriptions.push(statusBar);

    // --- Command helper ---
    const register = (command: string, callback: (...args: any[]) => any) => {
        context.subscriptions.push(vscode.commands.registerCommand(command, callback));
    };

    // --- Commands ---
    register('highlighter.enable',    async () => enableHighlighter(context));
    register('highlighter.disable',   async () => disableHighlighter(context));
    register(toggleCommandId,         async () => toggleHighlighter(context));

    register('highlighter.customize', async (uriOrItem: any, allSelected?: vscode.Uri[]) => {
        // Called from Explorer context menu (Uri + multi-select array)
        // or from the Highlights panel (HighlightItem with .resourceUri)
        let targets: vscode.Uri[];
        if (uriOrItem instanceof vscode.Uri) {
            targets = allSelected && allSelected.length > 1 ? allSelected : [uriOrItem];
        } else if (uriOrItem?.resourceUri instanceof vscode.Uri) {
            targets = [uriOrItem.resourceUri];
        } else {
            return;
        }
        await updateCustomizations(targets);
    });

    register('highlighter.removeHighlight', async (uriOrItem: any) => {
        let target: vscode.Uri | undefined;
        if (uriOrItem instanceof vscode.Uri) {
            target = uriOrItem;
        } else if (uriOrItem?.resourceUri instanceof vscode.Uri) {
            target = uriOrItem.resourceUri;
        } else if (uriOrItem instanceof HighlightItem) {
            target = uriOrItem.resourceUri;
        }
        if (target) {await removeHighlight(target, false);}
    });

    register('highlighter.clearAll', async () => {
        const count = highlightStore.size;
        if (count === 0) {return;}
        const answer = await vscode.window.showWarningMessage(
            `Remove all ${count} highlight${count > 1 ? 's' : ''}? This cannot be undone.`,
            { modal: true },
            'Remove All'
        );
        if (answer === 'Remove All') {
            highlightStore.clear();
        }
    });

    // --- Decoration provider ---
    const decorationProvider = createHighlightDecorationProvider(context);
    context.subscriptions.push(
        vscode.window.registerFileDecorationProvider(decorationProvider)
    );

    // --- Highlights panel ---
    const highlightsProvider = createHighlightsProvider();
    const highlightsView = vscode.window.createTreeView('highlighter.highlightsView', {
        treeDataProvider: highlightsProvider,
        showCollapseAll: false,
    });
    context.subscriptions.push(highlightsView);

    // --- Store change handler (refreshes decorations + panel) ---
    highlightStore.setChangeHandler(() => {
        getHighlightDecorationProvider().refresh();
        getHighlightsProvider().refresh();
        highlightsView.message = highlightStore.size === 0
            ? 'Right-click any file or folder in the Explorer to add a highlight.'
            : undefined;
    });

    // --- Load store, then start watching ---
    await highlightStore.ensureLoaded();
    highlightStore.setupWatcher(context);

    // --- Workspace change: reinitialize store + watcher ---
    context.subscriptions.push(
        vscode.workspace.onDidChangeWorkspaceFolders(async () => {
            highlightStore.invalidate();
            highlightStore.setupWatcher(context);
            await highlightStore.ensureLoaded();
        })
    );

    // --- State change: update status bar + refresh decorations ---
    context.subscriptions.push(
        onDidChangeHighlighterState(({ to }) => {
            updateStatusBar(statusBar, to, highlightStore.size);
            getHighlightDecorationProvider().refresh();
        })
    );

    // --- Configuration change: override git decorations ---
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration((event) => {
            const enabled = context.workspaceState.get<boolean>('highlighter.enabled', true);
            if (enabled && event.affectsConfiguration('highlighter.overrideGitDecorations')) {
                setTimeout(async () => {
                    const config = vscode.workspace.getConfiguration('highlighter');
                    const override = config.get<boolean>('overrideGitDecorations', true);
                    await setGitDecorations(!override);
                    getHighlightDecorationProvider().refresh();
                }, 0);
            }
        })
    );

    // --- One-time notifications ---
    const folders = vscode.workspace.workspaceFolders;
    if (!context.globalState.get<boolean>('highlighter.welcomeShown')) {
        context.globalState.update('highlighter.welcomeShown', true);
        vscode.window.showInformationMessage(
            'Workspace Tree Highlighter: Right-click any file or folder in the Explorer to add a highlight.'
        );
    }

    if ((folders?.length ?? 0) > 1 && !context.globalState.get<boolean>('highlighter.multiRootDismissed')) {
        vscode.window.showWarningMessage(
            'Workspace Tree Highlighter: Multi-root workspaces are only partially supported — highlights apply to the first folder only.',
            "Don't show again"
        ).then(val => {
            if (val === "Don't show again") {
                context.globalState.update('highlighter.multiRootDismissed', true);
            }
        });
    }

    // --- Initialize state ---
    await updateHighlighterContext(context, isEnabled);
}

export async function deactivate() {
    await highlightStore.flush();
    highlightStore.dispose();
}
