export type HighlightColor = {
	id: string;        // Used in theme (e.g. highlighter.orange)
	label: string;     // User-friendly name (e.g. "Orange")
	hex: string;       // Base hex value
};

export const HIGHLIGHT_COLORS: HighlightColor[] = [
	{ id: 'red',     label: 'Red',       hex: '#e06c75' },
	{ id: 'orange',  label: 'Orange',    hex: '#d19a66' },
	{ id: 'yellow',  label: 'Yellow',    hex: '#e5c07b' },
	{ id: 'green',   label: 'Green',     hex: '#98c379' },
	{ id: 'teal',    label: 'Teal',      hex: '#56b6c2' },
	{ id: 'blue',    label: 'Blue',      hex: '#61afef' },
	{ id: 'indigo',  label: 'Indigo',    hex: '#5c5cff' },
	{ id: 'purple',  label: 'Purple',    hex: '#c678dd' },
	{ id: 'pink',    label: 'Pink',      hex: '#ff69b4' },
	{ id: 'brown',   label: 'Brown',     hex: '#a6784d' },
	{ id: 'gray',    label: 'Gray',      hex: '#abb2bf' },
	{ id: 'black',   label: 'Black',     hex: '#333333' },
	{ id: 'white',   label: 'White',     hex: '#eeeeee' },
	{ id: 'gold',    label: 'Gold',      hex: '#ffd700' },
	{ id: 'cyan',    label: 'Cyan',      hex: '#00ffff' },
	{ id: 'lime',    label: 'Lime',      hex: '#b4f000' },
	{ id: 'rose',    label: 'Rose',      hex: '#ff007f' },
	{ id: 'sky',     label: 'Sky Blue',  hex: '#87ceeb' },
	{ id: 'violet',  label: 'Violet',    hex: '#9400d3' },
];
