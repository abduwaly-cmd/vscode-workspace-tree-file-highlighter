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

import {
    onDidChangeHighlighterState,
} from './events';

import { updateCustomizations } from './highlight';
import {
    createHighlightDecorationProvider,
    getHighlightDecorationProvider
} from './decorations/decorator';
import { highlightStore } from './store';


export async function activate(context: vscode.ExtensionContext) {
    const stateKey = 'highlighter.enabled';
    const toggleCommandId = 'highlighter.toggle';

    // Initialize workspaceState (default: true)
    const isEnabled = context.workspaceState.get<boolean>(stateKey, true);

    // Initialize Status bar item
    const statusBar = createStatusBar(toggleCommandId);
    context.subscriptions.push(statusBar);

    // Command registration helper
    const register = (command: string, callback: (...args: any[]) => any) => {
        context.subscriptions.push(vscode.commands.registerCommand(command, callback));
    };

    // --- Commands ---
    register('highlighter.enable',    async () => await enableHighlighter(context));
    register('highlighter.disable',   async () => await disableHighlighter(context));
    register(toggleCommandId,         async () => await toggleHighlighter(context));
    register('highlighter.customize', async (uri: vscode.Uri) => await updateCustomizations(uri));

    // Register File Decorations provider
    const decorationProvider = createHighlightDecorationProvider(context);
    context.subscriptions.push(
        vscode.window.registerFileDecorationProvider(decorationProvider)
    );

    // Register StatusBar Hook
    context.subscriptions.push(
        onDidChangeHighlighterState(({ to }) => {
            updateStatusBar(statusBar, to);
            getHighlightDecorationProvider().refresh();
        })
    );

    // Register configuration change listener
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

    // Re-initialize store and watcher when the workspace changes
    context.subscriptions.push(
        vscode.workspace.onDidChangeWorkspaceFolders(() => {
            highlightStore.invalidate();
            highlightStore.setupWatcher(context, () => getHighlightDecorationProvider().refresh());
            getHighlightDecorationProvider().refresh();
        })
    );

    // Load the highlight store eagerly and watch for external changes
    await highlightStore.ensureLoaded();
    highlightStore.setupWatcher(context, () => getHighlightDecorationProvider().refresh());

    // Initialize states
    await updateHighlighterContext(context, isEnabled);
}
