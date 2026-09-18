import { mount } from 'svelte';
import './app.css';
import App from './App.svelte';
import { cachedLocale, detectLocale, setLocale } from './i18n/index.svelte.ts';

const target = document.getElementById('app');
if (!target) throw new Error('Missing #app element');

// Load the dictionary before the first render so `t()` never shows raw keys.
setLocale(cachedLocale() ?? detectLocale()).then(() => mount(App, { target }));
