import * as vscode from 'vscode';
import { HIGHLIGHT_BADGES } from './highlightBadges';

let lastSelectedBadge: string | undefined;

export function setLastBadge(badge: string | undefined) {
	lastSelectedBadge = badge;
}

export function getLastBadge(): string | undefined {
	return lastSelectedBadge;
}

export async function promptForBadge(defaultBadge?: string): Promise<string | undefined> {
	const items: vscode.QuickPickItem[] = [
		{ label: 'None', description: 'No badge' },
		...HIGHLIGHT_BADGES.map(b => ({
			label: b.label,
			description: b.id === defaultBadge ? '✔ Selected' : '',
			detail: `Icon: ${b.id}`,
		}))
	];

	const quickPick = vscode.window.createQuickPick();
	quickPick.title = 'Select a highlight badge';
	quickPick.placeholder = 'Pick a custom icon or type a letter/character';
	quickPick.items = items;
	quickPick.ignoreFocusOut = true;

	const index = HIGHLIGHT_BADGES.findIndex(b => b.label === defaultBadge);
	if (index >= 0) {
		quickPick.activeItems = [quickPick.items[index + 1]]; // +1 for "None"
	}

	return new Promise(resolve => {
		quickPick.onDidAccept(() => {
			const input = quickPick.value.trim();
			const selected = quickPick.selectedItems[0];

			let badge: string | undefined;

			if (input.length === 1) {
				badge = input.toUpperCase();
			} else if (selected?.label === 'None') {
				badge = undefined;
			} else {
				const match = HIGHLIGHT_BADGES.find(b => b.label === selected.label);
				badge = match?.label ?? defaultBadge ?? undefined;
			}

			setLastBadge(badge);
			quickPick.hide();
			resolve(badge);
		});

		quickPick.onDidHide(() => {
			resolve(defaultBadge); // fallback
		});

		quickPick.show();
	});
}
