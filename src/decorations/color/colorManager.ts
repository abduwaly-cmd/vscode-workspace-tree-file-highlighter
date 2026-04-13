import * as vscode from 'vscode';
import { highlightStore } from '../../store';
import { HIGHLIGHT_COLORS } from './highlightColors';


export async function promptForColor(uri: vscode.Uri): Promise<string | undefined> {
    const defaultColor = highlightStore.getEffectiveHighlight(uri.fsPath)?.color;

    const quickPick = vscode.window.createQuickPick();
    quickPick.title = 'Select a highlight color';
    quickPick.ignoreFocusOut = true;
    quickPick.placeholder = 'Pick a highlight color';

    quickPick.items = [
        { label: 'None', description: defaultColor === undefined ? '✓ Selected' : '' },
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
