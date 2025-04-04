import * as vscode from 'vscode';

import { 
    saveHighlightMap,
    getHighlightFileUri,
    getAllDescendantPaths
} from './utils';

import { getHighlightDecorationProvider } from './decorations/decorator';
import { promptForColor } from './decorations/color/colorManager';
import { promptForBadge } from './decorations/badge/badgeManager';

export type HighlightInfo = {
	parent?: string;
    color?: string;
	badge?: string;
};

type CustomOption = vscode.QuickPickItem & { action?: 'edit' | 'editAll' | 'remove' | 'removeAll' };

export type HighlightMap = Record<string, HighlightInfo>;

function isCustomized(path: vscode.Uri, map: HighlightMap): boolean {
	const fullPath = path.fsPath;
	return map[fullPath] !== undefined && !map[fullPath].parent;
}

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

export async function getHighlightMap(): Promise<HighlightMap> {
	// TODO: can we use another approach maybe? also instead of reading the file everytime can we maybe cache the values in the context/object
	const fileUri = await getHighlightFileUri();
	try {
		const content = await vscode.workspace.fs.readFile(fileUri);
		return JSON.parse(content.toString()) as HighlightMap;
	} catch {
		return {};
	}
}

export async function hasCustomizedDescendants(uri: vscode.Uri, map?: HighlightMap): Promise<boolean> {
	map ??= await getHighlightMap();
	const paths = await getAllDescendantPaths(uri, false);
	return paths.some(p => isCustomized(p, map));
}

export async function updateCustomizations(uri: vscode.Uri) {
	const map = await getHighlightMap();
	const path = uri.fsPath;
	const isCustom = path in map;
	const hasChildren = await hasCustomizedDescendants(uri, map);
	const options = getOptions(isCustom, hasChildren);

    const selected = options.length > 1 ? await vscode.window.showQuickPick(options, {
        placeHolder: `Choose action for: ${path}`,
    }) : options[0];
    
    if (!selected || !('action' in selected)) {
        return;
    }

	switch (selected.action) {
		case 'edit':
			await editHighlight(uri, map, !isCustom || !hasChildren ? true : false);
			break;
		case 'editAll':
			await editHighlight(uri, map, true);
			break;
		case 'remove':
			await removeHighlight(uri, map, false);
			break;
		case 'removeAll':
			await removeHighlight(uri, map, true);
			break;
	}
}

export async function editHighlight(uri: vscode.Uri, map?: HighlightMap, includeChildren = false) {
	map ??= await getHighlightMap();
	const path = uri.fsPath;

	const color = await promptForColor(uri, map);
	const badge = await promptForBadge(map[path]?.badge);

	map[path] = {
		color: color || undefined, // allow no color
		badge: badge || undefined,
	};

	if (includeChildren) {
		const children = await getAllDescendantPaths(uri, false);
		for (const child of children) {
			map[child.fsPath] = { parent: path };
		}
	}

	await saveHighlightMap(map);

	getHighlightDecorationProvider().refresh(uri);
	if (includeChildren) {
		const children = await getAllDescendantPaths(uri, false);
		getHighlightDecorationProvider().refresh(children);
	}
}

export async function removeHighlight(uri: vscode.Uri, map?: HighlightMap, includeChildren = false) {
	map ??= await getHighlightMap();
	const path = uri.fsPath;

	delete map[path];

	const children = await getAllDescendantPaths(uri, false);

	getHighlightDecorationProvider().refresh(uri);
	for (const child of children) {
		if (includeChildren || map[child.fsPath]?.parent === path) {
			delete map[child.fsPath];
			getHighlightDecorationProvider().refresh(child);
		}
	}

	await saveHighlightMap(map);
}