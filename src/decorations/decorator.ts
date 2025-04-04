import * as vscode from 'vscode';
import { HighlightDecorationProvider } from './decorations';

let _provider: HighlightDecorationProvider;

export function createHighlightDecorationProvider(context: vscode.ExtensionContext): HighlightDecorationProvider {
	_provider = new HighlightDecorationProvider(context);
	return _provider;
}

export function getHighlightDecorationProvider(): HighlightDecorationProvider {
	return _provider;
}

export function getHighlighterState(context: vscode.ExtensionContext): boolean {
	return context.workspaceState.get<boolean>('highlighter.enabled', true);
}
