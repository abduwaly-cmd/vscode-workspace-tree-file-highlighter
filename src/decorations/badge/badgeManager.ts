import * as vscode from 'vscode';
import { HIGHLIGHT_BADGES } from './highlightBadges';

/**
 * Returns the selected badge character, undefined for "None", or null if the user cancelled.
 */
export async function promptForBadge(defaultBadge?: string): Promise<string | null | undefined> {
    const items: vscode.QuickPickItem[] = [
        { label: 'None', description: 'No badge' },
        ...HIGHLIGHT_BADGES.map(b => ({
            label: b.label,
            description: b.id === defaultBadge ? '✔ Selected' : '',
            detail: b.id,
        }))
    ];

    const quickPick = vscode.window.createQuickPick();
    quickPick.title = 'Select a highlight badge';
    quickPick.placeholder = 'Pick an icon, or type any single character';
    quickPick.items = items;
    quickPick.ignoreFocusOut = true;

    const index = HIGHLIGHT_BADGES.findIndex(b => b.label === defaultBadge);
    if (index >= 0) {
        quickPick.activeItems = [quickPick.items[index + 1]]; // +1 for "None"
    }

    return new Promise(resolve => {
        let accepted = false;

        quickPick.onDidAccept(() => {
            accepted = true;
            const input = quickPick.value.trim();
            const selected = quickPick.selectedItems[0];
            let badge: string | undefined;

            if (input.length === 1) {
                badge = input.toUpperCase();
            } else if (selected?.label === 'None') {
                badge = undefined;
            } else {
                const match = HIGHLIGHT_BADGES.find(b => b.label === selected?.label);
                badge = match?.label ?? defaultBadge ?? undefined;
            }

            quickPick.hide();
            resolve(badge);
        });

        quickPick.onDidHide(() => {
            quickPick.dispose();
            if (!accepted) {resolve(null);} // Escape = cancel
        });

        quickPick.show();
    });
}
