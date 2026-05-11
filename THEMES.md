# Themes

ultra-beers ships three bundled themes. You can switch live from the picker in the top-right of the nav bar; the choice persists to `localStorage` and is applied before paint to avoid flash.

| ID | Vibe |
|---|---|
| `pixel` (default) | Deep purple PICO-8 palette, Press Start 2P, neon accents, CRT scanlines |
| `minimal` | Light/quiet, system fonts, single blue accent — the "I have to use this at work" theme |
| `terminal` | Green-on-black, VT323 everywhere, faint scanlines, amber highlights |

## Writing a new theme

Every theme is a single CSS file with one selector: `[data-theme="<your-id>"]`. Define the variable contract below and (optionally) override a few component classes. No JS or build step.

### Variable contract

Required color variables:

```css
[data-theme="my-theme"] {
  /* Surfaces */
  --bg: /* page background */;
  --bg-elev: /* card background */;
  --bg-elev-2: /* nested card / input background */;
  --border: /* default border color */;
  --border-strong: /* card borders */;

  /* Foreground text */
  --fg: /* primary text */;
  --fg-dim: /* secondary text */;
  --fg-faint: /* tertiary text and labels */;

  /* Semantic accents — used across UI and markdown */
  --accent: /* primary action / highlights */;
  --accent-dim: /* hover/pressed accent */;
  --magenta: /* h2 in markdown, Skeptic agent */;
  --cyan: /* links, Verifier agent, h3 in markdown */;
  --lime: /* code, Tightener agent, success */;
  --red: /* errors */;
  --orange: /* warnings */;

  /* Agent role colors (defaults: re-use semantic colors) */
  --skeptic: var(--magenta);
  --verifier: var(--cyan);
  --tightener: var(--lime);

  /* Peer chip palette — auto-cycled across registered peers */
  --peer-1: ;
  --peer-2: ;
  --peer-3: ;
  --peer-4: ;
  --peer-5: ;
  --peer-6: ;

  /* Fonts (next/font supplies --font-pixel and --font-crt; you can use them or system fonts) */
  --font-heading: ;
  --font-body: ;
  --font-mono: ;

  /* Style abstractions */
  --heading-transform: uppercase | none;
  --heading-letterspacing: 0 | 0.5px | etc;
  --button-shadow: ;
  --button-shadow-hover: ;
  --button-shadow-active: ;
  --card-shadow: ;
  --card-border-width: 1px | 2px;
  --card-radius: 0 | 6px | 8px;
  --bg-gradient: ;    /* optional radial / linear gradient layered behind --bg */
  --scanline-opacity: 0..1;  /* 0 hides the CRT scanlines overlay */
}
```

### Component overrides

Most things derive from the variables above. If you want to drastically alter a component (e.g., make `.pixel-card` flat in a minimal theme), scope it under your selector:

```css
[data-theme="my-theme"] .pixel-card {
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  border-radius: 8px;
}

[data-theme="my-theme"] .pixel-corner { display: none; }
```

### Registering the theme

1. Save your file at `src/themes/my-theme.css`.
2. Add an `@import` line at the top of `src/app/globals.css`.
3. Add an entry to the `THEMES` array in `src/components/ThemeSwitcher.tsx`.

Build, reload, and your theme shows in the picker. PRs welcome — keep it on-brand for someone, don't over-design.

## Contract for upstream component changes

If you add a new component to ultra-beers, route its colors through the variables above. Don't hardcode hex values. The default behavior should look sane in every shipped theme without per-theme overrides.
