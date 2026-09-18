/**
 * Route table. The diary and the add-food screen (the main flow) are bundled
 * eagerly; everything else is loaded on demand (and precached for offline use).
 */
import type { Component } from 'svelte';
import type { NavKey } from './components/AppNav.svelte';
import AddFood from './screens/AddFood.svelte';
import Diary from './screens/Diary.svelte';

export interface ScreenProps {
  params: Record<string, string>;
  query: URLSearchParams;
}

// Screens that ignore params/query declare no props, so the loader accepts any component.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Screen = Component<any>;
type Loader = () => Promise<{ default: Screen }>;

export interface RouteDef {
  pattern: string;
  component?: Screen;
  load?: Loader;
  nav: NavKey | null;
  /** Screens with the same group are not re-mounted when moving between them. */
  group?: string;
  /** Hide the navigation bar (onboarding). */
  bare?: boolean;
}

const foodEditor: Loader = () => import('./screens/FoodEditor.svelte');
const mealEditor: Loader = () => import('./screens/MealEditor.svelte');

export const routes: RouteDef[] = [
  { pattern: '/', component: Diary, nav: 'diary', group: 'diary' },
  { pattern: '/day/:date', component: Diary, nav: 'diary', group: 'diary' },
  { pattern: '/add', component: AddFood, nav: 'diary' },
  { pattern: '/library', load: () => import('./screens/Library.svelte'), nav: 'library' },
  { pattern: '/foods/new', load: foodEditor, nav: 'library' },
  { pattern: '/foods/:id', load: foodEditor, nav: 'library' },
  { pattern: '/meals/new', load: mealEditor, nav: 'library' },
  { pattern: '/meals/:id', load: mealEditor, nav: 'library' },
  { pattern: '/weight', load: () => import('./screens/Weight.svelte'), nav: 'weight' },
  { pattern: '/settings', load: () => import('./screens/Settings.svelte'), nav: 'settings' },
  {
    pattern: '/settings/profile',
    load: () => import('./screens/ProfileSettings.svelte'),
    nav: 'settings',
  },
  {
    pattern: '/settings/goals',
    load: () => import('./screens/GoalsSettings.svelte'),
    nav: 'settings',
  },
  {
    pattern: '/settings/data',
    load: () => import('./screens/DataSettings.svelte'),
    nav: 'settings',
  },
  {
    pattern: '/settings/catalogs',
    load: () => import('./screens/Catalogs.svelte'),
    nav: 'settings',
  },
  { pattern: '/settings/about', load: () => import('./screens/About.svelte'), nav: 'settings' },
  { pattern: '/welcome', load: () => import('./screens/Welcome.svelte'), nav: null, bare: true },
];

export const WELCOME_PATH = '/welcome';
