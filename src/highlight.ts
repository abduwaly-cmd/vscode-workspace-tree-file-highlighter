import * as vscode from 'vscode';
import { highlightStore } from './store';
import { getHighlightDecorationProvider } from './decorations/decorator';
import { promptForColor } from './decorations/color/colorManager';
import { promptForBadge } from './decorations/badge/badgeManager';

// Re-export types consumed by other modules
export type { HighlightInfo, HighlightMap } from './store';

type CustomOption = vscode.QuickPickItem & { action?: 'edit' | 'editAll' | 'remove' | 'removeAll' };

function getOptions(isCustom: boolean, hasChildren: boolean): CustomOption[] {
    const options: CustomOption[] = [
        { label: 'Customize Highlights', action: 'edit' }
    ];

    if (isCustom) {
        options.push({ label: 'Remove Highlight', action: 'remove' });

        if (hasChildren) {
            options.push({ label: '', kind: vscode.QuickPickItemKind.Separator });
            options.push({ label: 'Edit Highlight (Include Children)', action: 'editAll' });
            options.push({ label: 'Remove Highlight (Include Children)', action: 'removeAll' });
        }
    }

    return options;
}

export async function updateCustomizations(uri: vscode.Uri) {
    await highlightStore.ensureLoaded();
    const fsPath = uri.fsPath;
    const isCustom = highlightStore.isDirect(fsPath);
    const hasChildren = highlightStore.hasDescendants(fsPath);
    const options = getOptions(isCustom, hasChildren);

    const selected = options.length > 1
        ? await vscode.window.showQuickPick(options, { placeHolder: `Choose action for: ${fsPath}` })
        : options[0];

    if (!selected || !('action' in selected)) return;

    switch (selected.action) {
        case 'edit':      await editHighlight(uri, false); break;
        case 'editAll':   await editHighlight(uri, true);  break;
        case 'remove':    await removeHighlight(uri, false); break;
        case 'removeAll': await removeHighlight(uri, true);  break;
    }
}

export async function editHighlight(uri: vscode.Uri, includeChildren = false) {
    await highlightStore.ensureLoaded();
    const fsPath = uri.fsPath;

    const color = await promptForColor(uri);
    const badge = await promptForBadge(highlightStore.getEffectiveHighlight(fsPath)?.badge);

    highlightStore.set(fsPath, {
        color: color || undefined,
        badge: badge || undefined,
    });

    if (includeChildren) {
        // Remove descendant overrides so they all inherit from this entry.
        // New files added later will also inherit automatically.
        highlightStore.deleteDescendants(fsPath);
    }

    getHighlightDecorationProvider().refresh();
}

export async function removeHighlight(uri: vscode.Uri, includeChildren = false) {
    await highlightStore.ensureLoaded();
    const fsPath = uri.fsPath;

    highlightStore.delete(fsPath);

    if (includeChildren) {
        highlightStore.deleteDescendants(fsPath);
    }

    getHighlightDecorationProvider().refresh();
}
