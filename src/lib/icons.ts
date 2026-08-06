// Material Symbols Rounded, subset by name (handoff §Assets, option A).
// ICON_NAMES drives the Google Fonts subset URL in _document.tsx — a glyph
// not listed there renders as its ligature text, so ADD THE NAME HERE FIRST.

// Per-service icon, keyed by ServiceLink.id (fallback when link.icon is '').
export const SERVICE_ICONS: Record<string, string> = {
  petition: 'description',
  paytax: 'payments',
  'air-quality': 'air',
  'agnos-health': 'health_and_safety',
  'smart-namphrae': 'dashboard',
  baimai: 'compost',
  'map-main': 'map',
  'google-maps': 'location_on',
  maplight: 'lightbulb',
  cctv: 'videocam',
  'forest-map': 'forest',
  'google-earth': 'public',
  announcements: 'campaign',
  'looker-dashboard': 'monitoring',
  otop: 'storefront',
  'line-oa': 'chat',
  'npdrh-calendar': 'calendar_month',
  'placeholder-15': 'help',
};

export function iconForService(id: string, icon?: string): string {
  return icon || SERVICE_ICONS[id] || 'apps';
}

// Every glyph the UI uses (services + chrome), sorted, deduped.
export const ICON_NAMES = [
  'add',
  'air',
  'apps',
  'arrow_back',
  'arrow_downward',
  'arrow_forward',
  'arrow_outward',
  'arrow_upward',
  'assignment',
  'assignment_turned_in',
  'calendar_month',
  'call',
  'campaign',
  'category',
  'chat',
  'check_circle',
  'chevron_left',
  'chevron_right',
  'compost',
  'dashboard',
  'delete',
  'description',
  'drag_indicator',
  'edit',
  'forest',
  'group',
  'health_and_safety',
  'help',
  'home',
  'layers',
  'lightbulb',
  'link',
  'location_on',
  'map',
  'menu',
  'menu_book',
  'monitoring',
  'notifications',
  'open_in_new',
  'payments',
  'person',
  'picture_as_pdf',
  'public',
  'schedule',
  'search',
  'storefront',
  'swap_vert',
  'tune',
  'videocam',
  'warning',
  'water_drop',
] as const;

// display=block: hide until loaded so ligature text never flashes.
export const ICON_FONT_HREF =
  'https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@24,300,0,0' +
  `&icon_names=${ICON_NAMES.join(',')}&display=block`;
