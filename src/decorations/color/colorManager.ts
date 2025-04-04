import * as vscode from 'vscode';
import { getHighlightMap, HighlightMap } from '../../highlight';
import { HIGHLIGHT_COLORS } from './highlightColors';


export async function promptForColor(uri: vscode.Uri, map?: HighlightMap): Promise<string | undefined> {
	map ??= await getHighlightMap();
	const current = map[uri.fsPath];
	const parent = current?.parent ? map[current.parent] : undefined;
	const defaultColor = current?.color ?? parent?.color;

	const quickPick = vscode.window.createQuickPick();
	quickPick.title = 'Select a highlight color';
	quickPick.ignoreFocusOut = true;
	quickPick.placeholder = 'Pick a highlight color';

	quickPick.items = [
		{ label: 'None', description: 'No color' + defaultColor === undefined ? '✓ Selected' : '' },
		...HIGHLIGHT_COLORS.map(color => ({
			label: color.label,
			description: color.id === defaultColor ? '✓ Selected' : '',
		}))
	];
	
	// Pre-select the item matching defaultColor
	const index = HIGHLIGHT_COLORS.findIndex(c => c.id === defaultColor);
	if (index >= 0) {
		quickPick.activeItems = [quickPick.items[index + 1]];
	}

	return new Promise(resolve => {
		quickPick.onDidAccept(() => {
			const selected = quickPick.selectedItems[0];
			const match = HIGHLIGHT_COLORS.find(c => c.label === selected.label);
			let colorId: string | undefined;

			if (selected?.label === 'None') {
				colorId = undefined;
			} else {
				const match = HIGHLIGHT_COLORS.find(c => c.label === selected.label);
				colorId = match?.id ?? defaultColor ?? 'green';
			}
			quickPick.hide();
			resolve(colorId);
		});
		quickPick.onDidHide(() => {
			resolve(defaultColor ?? 'green'); // fallback
		});
		quickPick.show();
	});
}
