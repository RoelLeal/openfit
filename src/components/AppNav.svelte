<script lang="ts">
  import { t, type MessageKey } from '../i18n/index.svelte.ts';
  import Icon, { type IconName } from './Icon.svelte';

  export type NavKey = 'diary' | 'library' | 'weight' | 'settings';

  let { active }: { active: NavKey | null } = $props();

  const items: { key: NavKey; href: string; icon: IconName; label: MessageKey }[] = [
    { key: 'diary', href: '#/', icon: 'diary', label: 'nav.diary' },
    { key: 'library', href: '#/library', icon: 'library', label: 'nav.library' },
    { key: 'weight', href: '#/weight', icon: 'weight', label: 'nav.weight' },
    { key: 'settings', href: '#/settings', icon: 'settings', label: 'nav.settings' },
  ];
</script>

<nav aria-label={t('nav.label')}>
  <div class="brand" aria-hidden="true">
    <img src="./favicon.svg" alt="" width="28" height="28" />
    <span>OpenFit</span>
  </div>
  <ul>
    {#each items as item (item.key)}
      <li>
        <a href={item.href} aria-current={active === item.key ? 'page' : undefined}>
          <Icon name={item.icon} />
          <span>{t(item.label)}</span>
        </a>
      </li>
    {/each}
  </ul>
</nav>

<style>
  nav {
    position: fixed;
    z-index: 10;
    left: 0;
    right: 0;
    bottom: 0;
    padding-bottom: var(--safe-bottom);
    background: var(--surface);
    border-top: 1px solid var(--border);
  }

  .brand {
    display: none;
  }

  ul {
    display: flex;
    max-width: var(--content-width);
    margin: 0 auto;
    padding: 0;
    list-style: none;
  }

  li {
    flex: 1;
  }

  a {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    height: var(--nav-height);
    color: var(--text-3);
    font-size: 0.75rem;
    font-weight: 540;
    text-decoration: none;
  }

  a[aria-current='page'] {
    color: var(--accent);
  }

  a:hover {
    color: var(--text);
  }

  @media (min-width: 900px) {
    nav {
      top: 0;
      right: auto;
      width: 232px;
      padding: var(--space-5) var(--space-3);
      border-top: 0;
      border-right: 1px solid var(--border);
    }

    .brand {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: 0 var(--space-3) var(--space-5);
      font-weight: 700;
      font-size: 1.125rem;
    }

    ul {
      flex-direction: column;
      gap: var(--space-1);
    }

    a {
      flex-direction: row;
      justify-content: flex-start;
      gap: var(--space-3);
      height: 44px;
      padding: 0 var(--space-3);
      border-radius: var(--radius-sm);
      font-size: 0.9375rem;
      color: var(--text-2);
    }

    a[aria-current='page'] {
      background: var(--accent-soft);
      color: var(--text);
    }
  }
</style>
