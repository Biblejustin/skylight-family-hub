import type { ModuleType } from '@/types/config';
import type { LayoutExport } from '@/types/layout-export';

type TemplateOrientation = 'portrait' | 'landscape';

export interface TemplateMeta {
  id: string;
  name: string;
  description: string;
  category: string;
  portrait: string;   // filename for portrait variant
  landscape: string;   // filename for landscape variant
  screenCount: number;
  moduleTypes: ModuleType[];
}

export const TEMPLATE_CATEGORIES = [
  'All',
  'Dashboard',
  'Weather',
  'Productivity',
  'Media',
  'Sports',
  'Finance',
] as const;

export const TEMPLATE_CATALOG: TemplateMeta[] = [
  {
    id: 'family-dashboard',
    name: 'Family Dashboard',
    description: 'Clock, calendar, weather, countdown, and greeting — a complete family hub.',
    category: 'Dashboard',
    portrait: 'family-dashboard.json',
    landscape: 'family-dashboard-landscape.json',
    screenCount: 1,
    moduleTypes: ['clock', 'calendar', 'weather', 'countdown', 'greeting'],
  },
  {
    id: 'weather-station',
    name: 'Weather Station',
    description: 'Multiple weather views, rain map, sunrise/sunset, air quality, and moon phase.',
    category: 'Weather',
    portrait: 'weather-station.json',
    landscape: 'weather-station-landscape.json',
    screenCount: 1,
    moduleTypes: ['weather', 'rain-map', 'sunrise-sunset', 'air-quality', 'moon-phase'],
  },
  {
    id: 'minimal-clock',
    name: 'Minimal Clock',
    description: 'A single large clock — clean and distraction-free.',
    category: 'Dashboard',
    portrait: 'minimal-clock.json',
    landscape: 'minimal-clock-landscape.json',
    screenCount: 1,
    moduleTypes: ['clock'],
  },
  {
    id: 'info-board',
    name: 'Info Board',
    description: 'News, stock ticker, word of the day, history, and quotes.',
    category: 'Finance',
    portrait: 'info-board.json',
    landscape: 'info-board-landscape.json',
    screenCount: 1,
    moduleTypes: ['news', 'stock-ticker', 'word-of-day', 'history', 'quote'],
  },
  {
    id: 'photo-frame',
    name: 'Photo Frame',
    description: 'Full-screen photo slideshow — turn your display into a digital picture frame.',
    category: 'Media',
    portrait: 'photo-frame.json',
    landscape: 'photo-frame-landscape.json',
    screenCount: 1,
    moduleTypes: ['photo-slideshow'],
  },
  {
    id: 'sports-hub',
    name: 'Sports Hub',
    description: 'Live scores and league standings.',
    category: 'Sports',
    portrait: 'sports-hub.json',
    landscape: 'sports-hub-landscape.json',
    screenCount: 1,
    moduleTypes: ['sports', 'standings'],
  },
  {
    id: 'productivity',
    name: 'Productivity',
    description: 'Todoist tasks, calendar, countdown timer, and year progress.',
    category: 'Productivity',
    portrait: 'productivity.json',
    landscape: 'productivity-landscape.json',
    screenCount: 1,
    moduleTypes: ['todoist', 'calendar', 'countdown', 'year-progress'],
  },
  {
    id: 'morning-dashboard',
    name: 'Morning Dashboard',
    description: 'Weather, calendar, traffic, and a greeting to start your day.',
    category: 'Dashboard',
    portrait: 'morning-dashboard.json',
    landscape: 'morning-dashboard-landscape.json',
    screenCount: 1,
    moduleTypes: ['weather', 'calendar', 'traffic', 'greeting'],
  },
  {
    id: 'kitchen-display',
    name: 'Kitchen Display',
    description: 'Meal planner, clock, calendar, garbage day, and sticky notes for the kitchen.',
    category: 'Dashboard',
    portrait: 'kitchen-display.json',
    landscape: 'kitchen-display-landscape.json',
    screenCount: 1,
    moduleTypes: ['meal-planner', 'clock', 'calendar', 'garbage-day', 'sticky-note'],
  },
  {
    id: 'news-finance',
    name: 'News & Finance',
    description: 'News headlines, stock prices, and crypto tracker.',
    category: 'Finance',
    portrait: 'news-finance.json',
    landscape: 'news-finance-landscape.json',
    screenCount: 1,
    moduleTypes: ['news', 'stock-ticker', 'crypto'],
  },
];

export function getDisplayOrientation(width: number, height: number): TemplateOrientation {
  return width >= height ? 'landscape' : 'portrait';
}

export async function loadTemplate(
  template: TemplateMeta,
  orientation: TemplateOrientation,
): Promise<LayoutExport> {
  const filename = orientation === 'landscape' ? template.landscape : template.portrait;
  const res = await fetch(`/templates/${filename}`);
  if (!res.ok) throw new Error(`Failed to load template: ${res.status}`);
  return res.json();
}
