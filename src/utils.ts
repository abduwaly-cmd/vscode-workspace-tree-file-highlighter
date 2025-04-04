import * as vscode from 'vscode';

import {
	fireHighlighterStateChanged
} from './events';

import { HighlightMap } from './highlight';

export function setLocalContext(key: string, value: boolean) {
    vscode.commands.executeCommand('setContext', key, value);
}

export async function setGitDecorations(enabled: boolean) {
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

export async function saveHighlightMap(map: HighlightMap) {
	const fileUri = await getHighlightFileUri();
	const json = Buffer.from(JSON.stringify(map, null, 2), 'utf8');
	await vscode.workspace.fs.writeFile(fileUri, json);
}

export async function getHighlightFileUri(): Promise<vscode.Uri> {
	const folder = vscode.workspace.workspaceFolders?.[0];
	if (!folder) {
		throw new Error('No workspace open');
	}
	const dir = vscode.Uri.joinPath(folder.uri, '.vscode');
	try {
		await vscode.workspace.fs.stat(dir);
	} catch {
		await vscode.workspace.fs.createDirectory(dir);
	}
	return vscode.Uri.joinPath(dir, 'highlightedFiles.json');
}

export async function getAllDescendantPaths(uri: vscode.Uri, includeSelf = true): Promise<vscode.Uri[]> {
	const result: vscode.Uri[] = includeSelf ? [uri] : [];

	try {
		const stat = await vscode.workspace.fs.stat(uri);
		if (stat.type & vscode.FileType.Directory) {
			const children = await vscode.workspace.fs.readDirectory(uri);
			for (const [name] of children) {
				const childUri = vscode.Uri.joinPath(uri, name);
				result.push(childUri);
				const childDescendants = await getAllDescendantPaths(childUri, false);
				result.push(...childDescendants);
			}
		}
	} catch (e) {
		console.error("Failed to get descendants:", uri.fsPath);
	}

	return result;
}