export const palettes = {
  light: {
    'page-bg': '#f6f5f1', canvas: '#f6f5f1', surface: '#fffefa', text: '#252821',
    muted: '#62665b', subtle: '#696f62', border: '#deded4', accent: '#8a5e00', selection: '#5e4200',
    'tile-0': '#eeeee7', 'tile-1': '#f6e9b5', 'tile-2': '#e8cf72', 'tile-3': '#b48920', 'tile-4': '#735414',
    'ink-0': '#414637', 'ink-1': '#4a390c', 'ink-2': '#49370a', 'ink-3': '#211a05', 'ink-4': '#fff5ce',
  },
  dark: {
    'page-bg': '#0d1117', canvas: '#0d1117', surface: '#161b22', text: '#e6edf3',
    muted: '#9da7b3', subtle: '#8d98a5', border: '#30363d', accent: '#e5c565', selection: '#fff0ad',
    'tile-0': '#262d36', 'tile-1': '#3e3826', 'tile-2': '#705b26', 'tile-3': '#b38e36', 'tile-4': '#e8cd76',
    'ink-0': '#b6bfc8', 'ink-1': '#ead697', 'ink-2': '#fff0bc', 'ink-3': '#191605', 'ink-4': '#30260d',
  },
};

const declarations = (theme) => Object.entries(palettes[theme]).map(([key, value]) => `--${key}:${value}`).join(';') + `;color-scheme:${theme}`;

export function themeCss(selector, lightSelector, darkSelector) {
  return `${selector}{${declarations('light')}}@media(prefers-color-scheme:dark){${selector}{${declarations('dark')}}}${lightSelector}{${declarations('light')}}${darkSelector}{${declarations('dark')}}`;
}

export function themedSvg(svg, theme) {
  if (!['light', 'dark'].includes(theme)) throw new Error('Invalid graph theme');
  return svg.replace('class="calendar"', `class="calendar" data-theme="${theme}"`);
}
