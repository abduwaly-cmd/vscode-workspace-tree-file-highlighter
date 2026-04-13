import * as vscode from 'vscode';

import {
    fireHighlighterStateChanged
} from './events';

export function setLocalContext(key: string, value: boolean) {
    vscode.commands.executeCommand('setContext', key, value);
}

export async function setGitDecorations(enabled: boolean) {
    if (!vscode.workspace.workspaceFolders?.length) return;
    await vscode.workspace.getConfiguration('git').update(
        'decorations.enabled',
        enabled,
        vscode.ConfigurationTarget.Workspace
    );
}

// Updates both workspaceState and context
export async function enableHighlighter(context: vscode.ExtensionContext) {
    await toggleHighlighter(context, true);
    vscode.window.showInformationMessage('Workspace Tree Highlighter enabled.');
}

export async function disableHighlighter(context: vscode.ExtensionContext) {
    await toggleHighlighter(context, false);
    vscode.window.showInformationMessage('Workspace Tree Highlighter disabled.');
}

export async function toggleHighlighter(context: vscode.ExtensionContext, value?: boolean) {
    value ??= !context.workspaceState.get<boolean>('highlighter.enabled', true);
    if (value === false) {
        await setGitDecorations(true);
    } else {
        const config = vscode.workspace.getConfiguration('highlighter');
        const override = config.get<boolean>('overrideGitDecorations', true);
        await setGitDecorations(!override);
    }
    await updateHighlighterContext(context, value);
}

export async function updateHighlighterContext(context: vscode.ExtensionContext, value: boolean, stateKey: string = 'highlighter.enabled') {
    await context.workspaceState.update(stateKey, value);
    setLocalContext(stateKey, value);
    fireHighlighterStateChanged(value);
}

export function createStatusBar(commandId: string): vscode.StatusBarItem {
    const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBar.command = commandId;
    statusBar.tooltip = 'Click to toggle Workspace Highlighter';
    statusBar.show();
    return statusBar;
}

export function updateStatusBar(statusBar: vscode.StatusBarItem, enabled: boolean) {
    statusBar.text = enabled ? '$(list-tree) Highlighter: On' : '$(list-tree) Highlighter: Off';
}
