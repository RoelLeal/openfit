<script lang="ts" module>
  /** Hand-drawn 24×24 stroke icons. Add new ones here instead of pulling an icon library. */
  const PATHS = {
    plus: 'M12 5v14M5 12h14',
    close: 'M18 6 6 18M6 6l12 12',
    back: 'M15 18l-6-6 6-6',
    forward: 'M9 18l6-6-6-6',
    down: 'M6 9l6 6 6-6',
    search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-3.5-3.5',
    diary:
      'M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM9 8h6M9 12h6M9 16h3',
    library: 'M4 5a2 2 0 0 1 2-2h4v18H6a2 2 0 0 1-2-2zM14 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4z',
    weight:
      'M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM8.5 11a3.5 3.5 0 0 1 7 0M12 11l1.5-2',
    settings:
      'M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1M15 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM9 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
    trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
    more: 'M5 12h.01M12 12h.01M19 12h.01',
    calendar:
      'M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM3 10h18M8 3v4M16 3v4',
    check: 'M5 12l5 5L20 7',
    download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
    upload: 'M12 16V5M7 10l5-5 5 5M5 20h14',
    share: 'M12 3v12M8 7l4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7',
    edit: 'M4 20h4L19 9l-4-4L4 16zM13 7l4 4',
    user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
    target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 12h.01',
    database: 'M3 7l9-4 9 4-9 4zM3 7v10l9 4 9-4V7M12 11v10',
    shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
    phone: 'M9 2h6a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM11 18h2',
    refresh: 'M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7',
    alert: 'M12 3l10 18H2zM12 10v4M12 17h.01',
    meal: 'M7 3v18M4 3v5a3 3 0 0 0 6 0V3M17 21V3c-2 1-3 3-3 6v4h3',
    info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8h.01',
  } as const;

  export type IconName = keyof typeof PATHS;
</script>

<script lang="ts">
  let { name, size = 22, label }: { name: IconName; size?: number; label?: string } = $props();
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
  role={label ? 'img' : undefined}
  aria-label={label}
  aria-hidden={label ? undefined : 'true'}
  focusable="false"
>
  <path d={PATHS[name]} />
</svg>
