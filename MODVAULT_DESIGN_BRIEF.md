# MODVAULT DESIGN BRIEF
### For Claude Code — Read this entire file before touching any component.

---

## THE RULE

Every aesthetic decision in this document is final. You do not make visual decisions. You execute what is written here. If something is not specified, ask before inventing.

---

## THE REFERENCE

The visual soul of ModVault is **Balatro** — the roguelike card game. Study it:
- Dark green felt backgrounds with noise texture
- Everything lives inside a card frame — nothing floats in empty space
- Dense information layout — cards are packed with stats, labels, numbers
- Chunky pixel font (m6x11) for all UI text
- High contrast accent colors (red, gold, white) on near-black backgrounds
- Subtle CRT scanline overlay on screens
- Cards have inner glow, slight emboss, physical weight
- Buttons look pressed/raised, not flat
- Nothing is matte. Everything has slight sheen or texture.

ModVault should feel like: **a physical card binder that came to life on a dark arcade cabinet.**

---

## FONTS

**Primary font:** m6x11 by Daniel Linssen
- Download: https://managore.itch.io/m6x11
- File goes in: `/public/fonts/m6x11.ttf`
- Use for: ALL UI text, labels, stats, buttons, nav items, headings
- Fallback only: `'Courier New', monospace`

**NEVER use:** Inter, Roboto, Arial, system-ui, sans-serif, or any Google Font.
**NEVER use:** font-weight bold on m6x11 — it doesn't support it. Use size instead.

---

## COLOR SYSTEM

```css
:root {
  /* Backgrounds */
  --bg-void: #0a0a0a;          /* Page background. Near black. */
  --bg-felt: #0f1a0f;          /* Card table green. Main surface. */
  --bg-card: #1a1208;          /* Card face background. Dark amber. */
  --bg-raised: #1e1e1e;        /* Raised panels, modals. */
  --bg-sunken: #080808;        /* Input fields, sunken areas. */

  /* Card frame colors by era */
  --era-dawn: #8B6914;         /* Gold. */
  --era-chrome: #6B7280;       /* Silver. */
  --era-turbo: #DC2626;        /* Red. */
  --era-neon: #7C3AED;         /* Purple. */
  --era-apex: #F59E0B;         /* Amber/gold. */

  /* Archetype colors */
  --archetype-purist: #60A5FA;       /* Blue */
  --archetype-aggressor: #EF4444;    /* Red */
  --archetype-showboat: #F59E0B;     /* Gold */
  --archetype-survivor: #6B7280;     /* Gray */
  --archetype-sleeper: #10B981;      /* Green */
  --archetype-devotee: #8B5CF6;      /* Purple */
  --archetype-newcomer: #F472B6;     /* Pink */

  /* Text */
  --text-primary: #F5E6C8;     /* Warm white. All main text. */
  --text-dim: #8B7355;         /* Dimmed. Labels, secondary info. */
  --text-accent: #FFD700;      /* Gold. Highlighted values, card names. */
  --text-danger: #FF4444;      /* Red. Burn, delete, warnings. */
  --text-win: #4ADE80;         /* Green. Wins, positive. */

  /* Borders */
  --border-card: #5C4A1E;      /* Card frame border. Dark gold. */
  --border-subtle: #1f1f1f;    /* Panel borders. Barely visible. */
  --border-glow: rgba(255, 215, 0, 0.4); /* Glow border on active cards. */

  /* Effects */
  --glow-card: 0 0 20px rgba(255, 215, 0, 0.15), 0 0 60px rgba(255, 215, 0, 0.05);
  --glow-active: 0 0 30px rgba(255, 215, 0, 0.35);
  --shadow-deep: 0 8px 32px rgba(0,0,0,0.8), 0 2px 8px rgba(0,0,0,0.9);
  --shadow-raised: inset 0 1px 0 rgba(255,255,255,0.05), 0 4px 12px rgba(0,0,0,0.6);

  /* Noise texture overlay — apply via ::before pseudo-element */
  --noise-opacity: 0.035;
}
```

---

## TEXTURES & EFFECTS

Every surface needs texture. Apply these via `::before` pseudo-elements or CSS background:

**Noise grain (apply to ALL backgrounds):**
```css
.surface::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.4'/%3E%3C/svg%3E");
  opacity: var(--noise-opacity);
  pointer-events: none;
  z-index: 1;
}
```

**CRT scanlines (apply to page root only):**
```css
body::after {
  content: '';
  position: fixed;
  inset: 0;
  background: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 2px,
    rgba(0,0,0,0.05) 2px,
    rgba(0,0,0,0.05) 4px
  );
  pointer-events: none;
  z-index: 9999;
}
```

**Felt texture (main page background):**
```css
body {
  background-color: var(--bg-felt);
  background-image: 
    radial-gradient(ellipse at 20% 50%, rgba(20, 40, 20, 0.3) 0%, transparent 60%),
    radial-gradient(ellipse at 80% 50%, rgba(10, 20, 10, 0.3) 0%, transparent 60%);
}
```

---

## THE CARD COMPONENT

This is the most important component in the app. Get this right first. Everything else is secondary.

**Card dimensions:** 280px wide × 420px tall (portrait, standard trading card ratio 2:3)

**Card structure (outermost to innermost):**
```
.mv-card-scene          — 3D perspective container
  .mv-card              — the card itself, handles flip
    .mv-card-front      — front face
      .mv-card-header   — make/model/year + serial number
      .mv-card-art      — pixel car image area (square, centered)
      .mv-card-era      — era badge row
      .mv-card-archetype — archetype label
      .mv-card-stats    — stats row (POWER / BUILD / REP)
      .mv-card-name     — card name in large pixel font
      .mv-card-status   — ALIVE / GHOST indicator dot
    .mv-card-back       — back face (transform: rotateY(180deg) — NEVER REMOVE)
```

**Card frame:**
```css
.mv-card {
  background: var(--bg-card);
  border: 2px solid var(--border-card);
  border-radius: 12px;
  box-shadow: var(--glow-card), var(--shadow-deep),
              inset 0 0 0 1px rgba(255,215,0,0.08);
  position: relative;
  overflow: hidden;
}

/* Inner gold line — gives physical depth */
.mv-card::before {
  content: '';
  position: absolute;
  inset: 4px;
  border: 1px solid rgba(255, 215, 0, 0.12);
  border-radius: 9px;
  pointer-events: none;
  z-index: 2;
}
```

**Card header:**
- Left: `MAKE MODEL · YEAR` in var(--text-dim), 10px m6x11
- Right: Serial number `#00098` in var(--text-accent), 10px m6x11
- Background: slightly darker than card face, bottom border 1px var(--border-card)

**Card art area:**
- Square, fills card width minus 12px padding each side
- Background: var(--bg-void)
- Inner shadow: `inset 0 0 20px rgba(0,0,0,0.8)`
- Corner bracket decorations (CSS only, no images):
  ```css
  /* Top-left bracket */
  .mv-card-art::before {
    content: '';
    position: absolute;
    top: 6px; left: 6px;
    width: 16px; height: 16px;
    border-top: 2px solid var(--text-dim);
    border-left: 2px solid var(--text-dim);
  }
  /* Repeat for all 4 corners */
  ```
- MODVAULT watermark centered in art area, 10% opacity

**Stats row:**
Three stats only: POWER · BUILD · REP
```css
.mv-card-stats {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  border-top: 1px solid var(--border-card);
  border-bottom: 1px solid var(--border-card);
}
.mv-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 6px 4px;
  gap: 2px;
}
.mv-stat-label {
  font-size: 8px;
  color: var(--text-dim);
  letter-spacing: 0.1em;
}
.mv-stat-value {
  font-size: 16px;
  color: var(--text-primary);
}
/* Dividers between stats */
.mv-stat:not(:last-child) {
  border-right: 1px solid var(--border-card);
}
```

**Card name:**
- Large, centered, var(--text-accent)
- Font size: 14px m6x11
- All caps
- Letterpress effect: `text-shadow: 0 1px 0 rgba(0,0,0,0.8), 0 -1px 0 rgba(255,215,0,0.1)`

**Status indicator:**
- 8px dot, bottom center of card
- ALIVE: `#4ADE80`, with `box-shadow: 0 0 8px #4ADE80`
- GHOST: `#6B7280`, no glow
- Label next to dot in 8px m6x11

**Era badge:**
- Pill shape, 6px padding vertical, 12px horizontal
- Background: era color at 20% opacity
- Border: 1px solid era color at 60% opacity
- Text: era name in era color, 8px m6x11

**Archetype badge:**
- Same pill treatment as era badge
- Uses archetype color

**Hover effect (mouse tracking tilt):**
```javascript
card.addEventListener('mousemove', (e) => {
  const rect = card.getBoundingClientRect();
  const x = (e.clientX - rect.left) / rect.width - 0.5;
  const y = (e.clientY - rect.top) / rect.height - 0.5;
  card.style.transform = `perspective(800px) rotateY(${x * 12}deg) rotateX(${-y * 12}deg) scale(1.02)`;
});
card.addEventListener('mouseleave', () => {
  card.style.transform = '';
  card.style.transition = 'transform 0.4s ease';
});
```

---

## BUTTONS

**Never use flat buttons.** Every button must feel physically pressable.

```css
.mv-btn {
  font-family: 'm6x11', 'Courier New', monospace;
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 10px 20px;
  border-radius: 4px;
  border: 1px solid;
  cursor: pointer;
  transition: all 0.08s ease;
  box-shadow: 0 4px 0 rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08);
  position: relative;
  top: 0;
}

.mv-btn:active {
  box-shadow: 0 1px 0 rgba(0,0,0,0.6);
  top: 3px; /* physically presses down */
}

/* Primary — gold */
.mv-btn-primary {
  background: #2a1f00;
  border-color: var(--era-dawn);
  color: var(--text-accent);
}
.mv-btn-primary:hover {
  background: #3a2a00;
  box-shadow: 0 4px 0 rgba(0,0,0,0.6), 0 0 12px rgba(255,215,0,0.2), inset 0 1px 0 rgba(255,255,255,0.08);
}

/* Danger — red */
.mv-btn-danger {
  background: #1a0000;
  border-color: #DC2626;
  color: #FF4444;
}
.mv-btn-danger:hover {
  background: #2a0000;
  box-shadow: 0 4px 0 rgba(0,0,0,0.6), 0 0 12px rgba(220,38,38,0.3), inset 0 1px 0 rgba(255,255,255,0.08);
}

/* Ghost — dim */
.mv-btn-ghost {
  background: transparent;
  border-color: var(--border-subtle);
  color: var(--text-dim);
}
```

---

## NAVIGATION SIDEBAR

The sidebar is the app's spine. It should feel like a worn leather binder spine.

```
Width: 56px collapsed / 200px expanded (hover to expand)
Background: var(--bg-void) with left border 1px var(--border-card)
```

**Nav items:**
- Icon only when collapsed, icon + label when expanded
- Active item: left border 3px var(--text-accent), background var(--bg-raised)
- Inactive hover: background rgba(255,215,0,0.04)
- Icon color: var(--text-dim) inactive, var(--text-accent) active
- Label: 11px m6x11, var(--text-dim) inactive, var(--text-primary) active

**Nav items (5 only — do not add more):**
1. Home (house icon)
2. Battle (crossed swords icon)
3. Mint (sparkle/star icon)
4. Garage (car icon)
5. Community (people icon)

**Bottom of sidebar:**
- User avatar + username when expanded
- Settings gear icon
- Sign out icon

---

## SCREEN-BY-SCREEN INSTRUCTIONS

### HOME SCREEN

Layout: Single column, centered, max-width 900px, padding 24px

**Top section:**
- User's vault label: `[USERNAME]'S VAULT · [X] CARDS` — 10px m6x11, var(--text-dim), centered
- Last words panel: dark panel with left border 3px var(--era-dawn), italic text in var(--text-primary), attribution line in var(--text-dim). This shows the previous card's last words if one exists.

**Card section:**
- Living card displayed at full size (280×420px), centered
- Below card: two buttons side by side — `⚡ POKE` and `💬 TALK TO IT` — using .mv-btn

**Right panel (info):**
- `YOUR LIVING CARD` label in 9px m6x11 var(--text-dim)
- Card name in 24px m6x11 var(--text-accent)
- Badges row: archetype pill + era pill + rarity pill
- Stats grid: 2×2 grid of stat boxes (POWER, BUILD, REP, BORN DATE) — each box has a dark background, label top, value bottom
- Flavor text: italic, var(--text-dim), in a panel with subtle border
- Build section: shows car make/model, biggest mod, latest mod, installed count, wishlist count
- Bottom: full-width REMINT button (.mv-btn-danger) + two nav shortcut buttons (GARAGE, COMMUNITY)

**DO NOT** put HP, TRQ, 0-60, SPENT on the home screen. Those stats are gone. Only POWER, BUILD, REP.

---

### COMMUNITY SCREEN

Layout: Grid of cards, 3 columns desktop / 2 columns tablet / 1 column mobile

**Header:**
- `COMMUNITY` in 20px m6x11 var(--text-primary)
- Subtitle in 11px m6x11 var(--text-dim)
- Three tab pills: `CARDS` · `BUILDS` · `DISCUSSION`

**Card grid:**
- Cards rendered at 220px width (smaller than home)
- Dark felt background behind grid: var(--bg-felt)
- 16px gap between cards
- Each card shows: art, era badge, archetype, stat row (POWER/BUILD/REP), card name
- Below each card: username + car make/model in 9px m6x11 var(--text-dim)
- Hover: card lifts (translateY -4px) with enhanced glow

**DO NOT** show reaction buttons or comment counts on cards in the grid. Clean.

---

### BATTLE SCREEN

This screen needs the most work. Currently looks like a floating card with a timer. That is wrong.

**Layout concept: two cards face off on a felt table**

Top section — YOUR CARD:
- Card displayed at 240px width, centered
- Win/Loss record below: `0 WINS · 0 LOSSES` in m6x11

Divider:
- `⚔` icon centered, horizontal lines extending left and right
- Color: var(--text-dim)

Bottom section — PICK A FIGHT:
- Section label `PICK A FIGHT` in 10px m6x11 var(--text-dim)
- Opponent cards listed as compact horizontal rows:
  - Card thumbnail (60×90px mini card)
  - Card name + username + archetype
  - Their record
  - Challenge button (crossed swords icon)
- Row background: var(--bg-raised), hover: var(--bg-card)
- Border bottom: 1px var(--border-subtle) between rows

Active battles section:
- Each battle: two mini card thumbnails side by side with `VS` between them
- Prompt text below in italic var(--text-dim)
- Time remaining badge
- Expand chevron to see full battle detail

---

### GARAGE SCREEN

**Hero section:**
- Full-width hero image of the car (actual uploaded photo, not pixel art)
- Dark gradient overlay bottom half so text is readable
- Car nickname in large m6x11 over the photo
- Car make/model/year below
- Three quick-action tiles below image: `ADD A MOD` · `TALK TO CARD` · `GHOST CARDS`

**DO NOT** show this as a card. The garage is where you see the real car. The pixel card is a representation. Keep them visually distinct.

---

### MINT SCREEN

**Keep this minimal and ceremonial.**

The minting flow should feel like an event, not a form.

Step 1 — Input your build:
- Single dark panel, centered
- Fields: car details, archetype selector (show all 7 options as clickable cards with descriptions), flavor text input
- Each archetype card: name, one-line description, color accent

Step 2 — Card preview:
- Show the generating card with a shimmer/loading state
- Reveal animation when card is ready

Step 3 — Name your card:
- Single input, large, centered
- `MINT THIS CARD` button

Burn ceremony (when reminting over an existing card):
- Full-screen overlay, dark red tint
- Previous card shown, then animates burning (CSS: scale down + opacity to 0 + red glow)
- Last words appear in center of screen
- Then transition to mint flow

---

## WHAT TO KILL IMMEDIATELY

Remove these from the codebase entirely:

- All `font-family: Inter` or any sans-serif font references
- All flat colored buttons (no box-shadow = delete it)
- The two-panel home layout where card and info panel compete at equal size
- HP, TRQ, 0-60 stats — replace everywhere with POWER, BUILD, REP
- Any white or light backgrounds
- Any purple gradient (the classic AI slop tell)
- Empty state screens that just say "No cards yet" in plain text — replace with flavor text in m6x11
- Loading spinners — replace with pixel-style loading text that cycles: `LOADING...` → `ALMOST...` → `HANG ON...`

---

## WHAT TO KEEP

- The card flip animation (DO NOT break .mv-card-back { transform: rotateY(180deg) })
- The serial number system (#00098 format)
- The era system (Dawn/Chrome/Turbo/Neon/Apex) with distinct colors
- The ALIVE/GHOST status dot
- The last words panel on home
- The community grid layout (just needs visual upgrade)
- The battle tab structure (needs visual overhaul but concept is right)

---

## DEVELOPMENT ORDER

Do these screens in this exact order. Do not start the next until the current one passes visual review.

1. **Card component** — get the card perfect first. Nothing else matters until this is right.
2. **Global styles** — apply fonts, colors, textures, CRT effect to the root
3. **Home screen** — rebuild using the locked card component
4. **Community screen** — grid of cards, new header, tab system
5. **Battle screen** — two-card face-off layout
6. **Garage screen** — hero photo treatment
7. **Mint screen** — ceremonial flow

---

## FINAL INSTRUCTION TO CLAUDE CODE

Read this file completely before writing any code. When you are done reading it, say: "Design brief loaded. Starting with [component name]." Then build only what is specified. Do not invent features. Do not add components not listed here. Do not use any font except m6x11. Do not use any color not defined in the CSS variables above. If you are unsure about anything visual, stop and ask.
