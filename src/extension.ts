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


export async function activate(context: vscode.ExtensionContext) {
	const stateKey = 'highlighter.enabled';
	const toggleCommandId = 'highlighter.toggle';
	// const decorationProvider = new HighlightDecorationProvider();

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
	// Enable command
	register('highlighter.enable', async () => await enableHighlighter(context));

	// Disable command
	register('highlighter.disable', async () => await disableHighlighter(context));

	// Toggle command (for status bar)
	register(toggleCommandId, async () => await toggleHighlighter(context));

	// Run Customizations :)
	register('highlighter.customize', async (uri: vscode.Uri) => await updateCustomizations(uri));

	// Register StatusBar Hook
	context.subscriptions.push(
		onDidChangeHighlighterState(({ from, to }) => {
			updateStatusBar(statusBar, to);
			getHighlightDecorationProvider().refresh();
		})
	);

	// Register File Decorations Hook
	const decorationProvider = createHighlightDecorationProvider(context);
	context.subscriptions.push(
		vscode.window.registerFileDecorationProvider(decorationProvider)
	);

	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration((event) => {
			const isEnabled = context.workspaceState.get<boolean>('highlighter.enabled', true);
			if (isEnabled && event.affectsConfiguration('highlighter.overrideGitDecorations')) {
				setTimeout(async () => {
					const config = vscode.workspace.getConfiguration('highlighter');
					const override = config.get<boolean>('overrideGitDecorations', true);

					await setGitDecorations(!override);
					getHighlightDecorationProvider().refresh();
				}, 0);
			}
		})
	);

	// Initialize states
	await updateHighlighterContext(context, isEnabled);
}
