import * as vscode from 'vscode';

let _previousState: boolean | undefined;

type HighlighterChangeEvent = {
	from: boolean | undefined;
	to: boolean;
};

const _onDidChangeHighlighterState = new vscode.EventEmitter<HighlighterChangeEvent>();
export const onDidChangeHighlighterState = _onDidChangeHighlighterState.event;

export function fireHighlighterStateChanged(newValue: boolean) {
	const event = { from: _previousState, to: newValue };
	_previousState = newValue;
	_onDidChangeHighlighterState.fire(event);
}
