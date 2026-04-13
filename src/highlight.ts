import * as vscode from 'vscode';
import * as nodePath from 'path';
import { highlightStore } from './store';
import { promptForColor } from './decorations/color/colorManager';
import { promptForBadge } from './decorations/badge/badgeManager';

// Re-export types consumed by other modules
export type { HighlightInfo, HighlightMap } from './store';

type CustomOption = vscode.QuickPickItem & { action?: 'edit' | 'editAll' | 'remove' | 'removeAll' };

function getSingleOptions(isCustom: boolean, hasDescendantOverrides: boolean): CustomOption[] {
    const editLabel = isCustom ? 'Edit Highlight' : 'Add Highlight';
    const options: CustomOption[] = [{ label: editLabel, action: 'edit' }];

    if (isCustom) {
        options.push({ label: 'Remove Highlight', action: 'remove' });

        if (hasDescendantOverrides) {
            options.push({ label: '', kind: vscode.QuickPickItemKind.Separator });
            options.push({ label: 'Edit Highlight (Include Children)', action: 'editAll' });
            options.push({ label: 'Remove Highlight (Include Children)', action: 'removeAll' });
        }
    }

    return options;
}

export async function updateCustomizations(uris: vscode.Uri[]) {
    await highlightStore.ensureLoaded();

    if (uris.length > 1) {
        await _handleMultiSelect(uris);
        return;
    }

    const [uri] = uris;
    const fsPath = uri.fsPath;
    const isCustom = highlightStore.isDirect(fsPath);
    const hasDescendantOverrides = highlightStore.hasDescendants(fsPath);
    const options = getSingleOptions(isCustom, hasDescendantOverrides);

    const selected = options.length > 1
        ? await vscode.window.showQuickPick(options, { placeHolder: `Choose action for: ${nodePath.basename(fsPath)}` })
        : options[0];

    if (!selected || !('action' in selected)) {return;}

    switch (selected.action) {
        case 'edit':      await editHighlight([uri], false); break;
        case 'editAll':   await editHighlight([uri], true);  break;
        case 'remove':    await removeHighlight(uri, false); break;
        case 'removeAll': await removeHighlight(uri, true);  break;
    }
}

async function _handleMultiSelect(uris: vscode.Uri[]) {
    const anyCustomized = uris.some(u => highlightStore.isDirect(u.fsPath));
    const options: CustomOption[] = [
        { label: `Set Highlight for ${uris.length} items`, action: 'edit' },
    ];
    if (anyCustomized) {
        options.push({ label: `Remove Highlight from ${uris.length} items`, action: 'remove' });
    }

    const selected = await vscode.window.showQuickPick(options, {
        placeHolder: `Apply to ${uris.length} selected items`,
    });
    if (!selected || !('action' in selected)) {return;}

    if (selected.action === 'edit') {
        await editHighlight(uris, false);
    } else {
        for (const uri of uris) {
            highlightStore.delete(uri.fsPath);
        }
    }
}

export async function editHighlight(uris: vscode.Uri[], includeChildren = false) {
    await highlightStore.ensureLoaded();

    const color = await promptForColor(uris[0]);
    if (color === null) {return;} // user cancelled

    const badge = await promptForBadge(highlightStore.getEffectiveHighlight(uris[0].fsPath)?.badge);
    if (badge === null) {return;} // user cancelled

    const info = {
        color: color || undefined,
        badge: badge || undefined,
    };

    for (const uri of uris) {
        highlightStore.set(uri.fsPath, info);
        if (includeChildren) {
            // Remove descendant overrides so they all inherit from this entry.
            // New files added later also inherit automatically.
            highlightStore.deleteDescendants(uri.fsPath);
        }
    }
}

export async function removeHighlight(uri: vscode.Uri, includeChildren = false) {
    await highlightStore.ensureLoaded();
    const fsPath = uri.fsPath;

    // Confirm before removing a folder's highlight since all inherited children lose color
    if (!includeChildren) {
        try {
            const stat = await vscode.workspace.fs.stat(uri);
            if (stat.type & vscode.FileType.Directory) {
                const answer = await vscode.window.showWarningMessage(
                    `Remove highlight from '${nodePath.basename(fsPath)}'? All files inside will lose their inherited color.`,
                    { modal: true },
                    'Remove'
                );
                if (answer !== 'Remove') {return;}
            }
        } catch { /* file may not exist — proceed */ }
    }

    highlightStore.delete(fsPath);
    if (includeChildren) {
        highlightStore.deleteDescendants(fsPath);
    }
}
