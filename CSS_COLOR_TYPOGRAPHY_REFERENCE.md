# CSS & Visual Design Reference for Wikipedia-Inspired LLM KB

## Complete Copy-Paste CSS Variables

```css
:root {
  /* COLORS */
  --color-white: #ffffff;
  --color-black: #000000;
  --color-blue-primary: #0645ad;
  --color-blue-dark: #003d99;
  --color-blue-light: #e6f0ff;
  --color-gray-900: #111111;
  --color-gray-700: #333333;
  --color-gray-600: #555555;
  --color-gray-500: #777777;
  --color-gray-400: #999999;
  --color-gray-300: #cccccc;
  --color-gray-200: #e8e8e8;
  --color-gray-100: #f5f5f5;
  --color-gray-050: #fafafa;
  --color-success: #28a745;
  --color-warning: #ffc107;
  --color-error: #dc3545;
  --color-info: #17a2b8;

  /* TYPOGRAPHY */
  --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica,
    Arial, sans-serif;
  --font-mono: "SF Mono", Monaco, "Cascadia Code", "Roboto Mono",
    Consolas, "Courier New", monospace;

  --font-weight-normal: 400;
  --font-weight-medium: 500;
  --font-weight-bold: 700;

  --size-xs: 0.75rem; /* 12px */
  --size-sm: 0.875rem; /* 14px */
  --size-base: 1rem; /* 16px */
  --size-lg: 1.125rem; /* 18px */
  --size-xl: 1.25rem; /* 20px */
  --size-2xl: 1.5rem; /* 24px */
  --size-3xl: 1.875rem; /* 30px */
  --size-4xl: 2.25rem; /* 36px */

  /* SPACING */
  --space-xs: 0.25rem; /* 4px */
  --space-sm: 0.5rem; /* 8px */
  --space-md: 1rem; /* 16px */
  --space-lg: 1.5rem; /* 24px */
  --space-xl: 2rem; /* 32px */
  --space-2xl: 3rem; /* 48px */

  /* BORDERS & SHADOWS */
  --border-width-thin: 1px;
  --border-width-normal: 2px;
  --border-radius-sm: 4px;
  --border-radius-md: 8px;
  --border-color: var(--color-gray-200);
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 8px 16px rgba(0, 0, 0, 0.15);

  /* LINE HEIGHT */
  --line-height-tight: 1.2;
  --line-height-normal: 1.6;
  --line-height-relaxed: 1.8;

  /* Z-INDEX SCALE */
  --z-dropdown: 100;
  --z-sticky: 200;
  --z-fixed: 300;
  --z-modal: 1000;
  --z-tooltip: 1100;
}
```

---

## Complete Base Typography CSS

```css
/* Reset & Base Styles */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html {
  scroll-behavior: smooth;
}

body {
  font-family: var(--font-sans);
  font-size: var(--size-base);
  line-height: var(--line-height-normal);
  color: var(--color-black);
  background: var(--color-white);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* Headings */
h1, h2, h3, h4, h5, h6 {
  font-weight: var(--font-weight-bold);
  line-height: var(--line-height-tight);
  margin: 1.5rem 0 0.5rem 0;
}

h1 {
  font-size: var(--size-4xl); /* 36px */
}

h2 {
  font-size: var(--size-2xl); /* 24px */
  border-bottom: var(--border-width-thin) solid var(--border-color);
  padding-bottom: var(--space-sm);
}

h3 {
  font-size: var(--size-xl); /* 20px */
}

h4 {
  font-size: var(--size-lg); /* 18px */
}

h5 {
  font-size: var(--size-base); /* 16px */
  font-weight: var(--font-weight-bold);
}

h6 {
  font-size: var(--size-sm); /* 14px */
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-gray-500);
}

/* Paragraphs & Text */
p {
  margin: 0 0 1em 0;
}

p + p {
  margin-top: 1em;
}

small {
  font-size: var(--size-sm);
}

strong, b {
  font-weight: var(--font-weight-bold);
}

em, i {
  font-style: italic;
}

/* Lists */
ul, ol {
  margin: 0 0 1em 0;
  padding-left: 2em;
}

li {
  margin-bottom: 0.5em;
  line-height: var(--line-height-normal);
}

ul ul,
ol ol,
ul ol,
ol ul {
  margin: 0.5em 0 0 0;
}

/* Definition Lists */
dl {
  margin: 0 0 1em 0;
}

dt {
  font-weight: var(--font-weight-bold);
  margin-top: 1em;
}

dd {
  margin-left: 2em;
  margin-bottom: 0.5em;
}

/* Code */
code {
  font-family: var(--font-mono);
  font-size: 0.9em;
  background: var(--color-gray-100);
  color: var(--color-gray-900);
  padding: 0.2em 0.4em;
  border-radius: var(--border-radius-sm);
}

pre {
  background: var(--color-gray-100);
  border: var(--border-width-thin) solid var(--border-color);
  padding: var(--space-lg);
  border-radius: var(--border-radius-sm);
  overflow-x: auto;
  font-family: var(--font-mono);
  font-size: var(--size-sm);
  line-height: 1.5;
}

pre code {
  background: none;
  padding: 0;
  color: inherit;
}

/* Blockquote */
blockquote {
  border-left: 3px solid var(--color-blue-primary);
  padding-left: var(--space-lg);
  margin: var(--space-lg) 0;
  color: var(--color-gray-600);
  font-style: italic;
}

/* Horizontal Rule */
hr {
  border: none;
  border-top: var(--border-width-thin) solid var(--border-color);
  margin: var(--space-2xl) 0;
}

/* Links */
a {
  color: var(--color-blue-primary);
  text-decoration: none;
  transition: all 0.2s ease;
}

a:hover {
  color: var(--color-blue-dark);
  text-decoration: underline;
}

a:focus {
  outline: 2px solid var(--color-blue-primary);
  outline-offset: 2px;
}

a:visited {
  color: #7b2cbf; /* Slightly darker for visited */
}

/* Abbreviations */
abbr[title] {
  border-bottom: 1px dotted var(--border-color);
  cursor: help;
}

/* Marks */
mark {
  background: #ffffcc;
  color: inherit;
  padding: 0.2em 0.4em;
}
```

---

## Complete Color Palette Reference

### Primary Blues (Links, CTAs)
```
#0645AD - Standard link blue
  Usage: Links, buttons, active states
  Hex: 0645AD
  RGB: 6, 69, 173
  HSL: 210°, 95%, 35%

#003D99 - Darker blue
  Usage: Link hover, active buttons
  Hex: 003D99
  RGB: 0, 61, 153
  HSL: 214°, 100%, 30%

#E6F0FF - Light blue background
  Usage: Link backgrounds, highlights
  Hex: E6F0FF
  RGB: 230, 240, 255
  HSL: 210°, 100%, 95%
```

### Grays (Neutral, Borders, Text)
```
#000000 - Pure black (body text, headings)
#333333 - Dark gray (secondary text)
#666666 - Medium gray (metadata, helper text)
#999999 - Light gray (disabled, muted)
#CCCCCC - Lighter gray (dividers, light borders)
#E8E8E8 - Very light gray (borders, section dividers)
#F5F5F5 - Almost white (background sections, code)
#FAFAFA - Very light background (alternate rows)
#FFFFFF - Pure white (background)
```

### Semantic Colors (use sparingly)
```
Success: #28A745 (green)
  RGB: 40, 167, 69
  Usage: Checkmarks, success messages, positive indicators

Warning: #FFC107 (amber)
  RGB: 255, 193, 7
  Usage: Warning messages, alerts

Error: #DC3545 (red)
  RGB: 220, 53, 69
  Usage: Error messages, delete confirmations

Info: #17A2B8 (teal)
  RGB: 23, 162, 184
  Usage: Info messages, notices
```

---

## Complete Component Color Schemes

### Buttons
```css
/* Primary Button */
.btn-primary {
  background: var(--color-blue-primary);
  color: var(--color-white);
  border: none;
}

.btn-primary:hover {
  background: var(--color-blue-dark);
}

.btn-primary:active {
  background: #002060; /* Even darker */
}

.btn-primary:disabled {
  background: var(--color-gray-300);
  cursor: not-allowed;
}

/* Secondary Button */
.btn-secondary {
  background: var(--color-gray-100);
  color: var(--color-blue-primary);
  border: 1px solid var(--border-color);
}

.btn-secondary:hover {
  background: var(--color-gray-200);
}
```

### Form Inputs
```css
input, textarea, select {
  border: 1px solid var(--border-color);
  padding: var(--space-md);
  border-radius: var(--border-radius-sm);
  font-family: inherit;
  font-size: inherit;
}

input:focus, textarea:focus, select:focus {
  outline: none;
  border-color: var(--color-blue-primary);
  box-shadow: 0 0 0 2px var(--color-blue-light);
}

input:disabled, textarea:disabled, select:disabled {
  background: var(--color-gray-100);
  color: var(--color-gray-400);
  cursor: not-allowed;
}
```

### Cards & Sections
```css
.card {
  background: var(--color-white);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius-sm);
  padding: var(--space-lg);
  box-shadow: var(--shadow-sm);
}

.card:hover {
  box-shadow: var(--shadow-md);
}

.card-header {
  background: var(--color-gray-050);
  border-bottom: 1px solid var(--border-color);
  margin: -var(--space-lg) -var(--space-lg) var(--space-lg) -var(--space-lg);
  padding: var(--space-lg);
}
```

### Alerts & Messages
```css
.alert {
  border-left: 3px solid;
  padding: var(--space-lg);
  border-radius: var(--border-radius-sm);
}

.alert-success {
  background: #d4edda;
  border-color: #28a745;
  color: #155724;
}

.alert-warning {
  background: #fff3cd;
  border-color: #ffc107;
  color: #856404;
}

.alert-error {
  background: #f8d7da;
  border-color: #dc3545;
  color: #721c24;
}

.alert-info {
  background: #d1ecf1;
  border-color: #17a2b8;
  color: #0c5460;
}
```

---

## Contrast Ratio Checker (WCAG Compliance)

### Passing Combinations (AA Standard: 4.5:1)
```
✓ #000000 on #FFFFFF = 21:1 (text-on-white)
✓ #003D99 on #FFFFFF = 8.6:1 (dark blue-on-white)
✓ #0645AD on #FFFFFF = 7.5:1 (standard blue-on-white)
✓ #333333 on #FFFFFF = 12.6:1 (dark gray-on-white)
✓ #666666 on #FFFFFF = 5.1:1 (medium gray-on-white)
```

### Failing Combinations (below 4.5:1)
```
✗ #999999 on #FFFFFF = 2.8:1 (too light for body text)
✗ #CCCCCC on #FFFFFF = 1.3:1 (too light)
✗ White text on light gray: insufficient contrast
```

---

## Complete Utility Classes (Tailwind-style)

```css
/* Text Colors */
.text-primary { color: var(--color-blue-primary); }
.text-secondary { color: var(--color-gray-600); }
.text-muted { color: var(--color-gray-500); }
.text-light { color: var(--color-gray-400); }

/* Background Colors */
.bg-light { background: var(--color-gray-100); }
.bg-lighter { background: var(--color-gray-050); }
.bg-blue { background: var(--color-blue-light); }

/* Spacing */
.p-xs { padding: var(--space-xs); }
.p-sm { padding: var(--space-sm); }
.p-md { padding: var(--space-md); }
.p-lg { padding: var(--space-lg); }
.p-xl { padding: var(--space-xl); }

.m-xs { margin: var(--space-xs); }
.m-sm { margin: var(--space-sm); }
.m-md { margin: var(--space-md); }
.m-lg { margin: var(--space-lg); }
.m-xl { margin: var(--space-xl); }

/* Border Utilities */
.border { border: var(--border-width-thin) solid var(--border-color); }
.border-top { border-top: var(--border-width-thin) solid var(--border-color); }
.border-bottom { border-bottom: var(--border-width-thin) solid var(--border-color); }
.border-blue { border-color: var(--color-blue-primary); }

/* Text Utilities */
.text-sm { font-size: var(--size-sm); }
.text-base { font-size: var(--size-base); }
.text-lg { font-size: var(--size-lg); }
.text-xl { font-size: var(--size-xl); }

.font-bold { font-weight: var(--font-weight-bold); }
.font-normal { font-weight: var(--font-weight-normal); }

/* Display Utilities */
.hidden { display: none; }
.block { display: block; }
.inline-block { display: inline-block; }
.flex { display: flex; }
.grid { display: grid; }

/* Opacity */
.opacity-50 { opacity: 0.5; }
.opacity-75 { opacity: 0.75; }

/* Cursor */
.cursor-pointer { cursor: pointer; }
.cursor-default { cursor: default; }
```

---

## Dark Mode Variant (Optional)

If implementing dark mode, update variables:

```css
@media (prefers-color-scheme: dark) {
  :root {
    --color-white: #1a1a1a;
    --color-black: #e0e0e0;
    --color-gray-100: #2a2a2a;
    --color-gray-200: #3a3a3a;
    --border-color: #444444;
    /* Adjust all colors appropriately */
  }
}
```

---

## Print Styles (Optional)

```css
@media print {
  body {
    background: white;
    color: black;
  }

  a {
    color: black;
    text-decoration: underline;
  }

  /* Show URLs for links */
  a[href]::after {
    content: " (" attr(href) ")";
    font-size: 0.8em;
  }

  /* Hide navigation on print */
  nav, header, footer {
    display: none;
  }

  /* Page breaks */
  section {
    page-break-inside: avoid;
  }
}
```

---

## Font Pairing Recommendations

**Current (System Fonts - Recommended)**
```
Body: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial
Code: "SF Mono", Monaco, "Cascadia Code", monospace
```

**Alternative: Open Source Fonts**
```
Body: "Inter", "Open Sans", "Source Sans Pro", system fonts
Code: "JetBrains Mono", "Fira Code", "Source Code Pro"
```

**Alternative: Premium Fonts**
```
Body: "Minion Pro", "Sabon", "Georgia" (serif for classic)
Code: "Monaco", "PragmataPro", "Inconsolata"
```

---

## Quick Reference: Color Use Cases

| Element | Color | Hex |
|---------|-------|-----|
| Body text | Black | #000000 |
| Headings | Black | #000000 |
| Links | Wikipedia blue | #0645AD |
| Link hover | Darker blue | #003D99 |
| Borders | Light gray | #E8E8E8 |
| Dividers | Light gray | #E8E8E8 |
| Section backgrounds | Off-white | #F5F5F5 |
| Metadata text | Medium gray | #999999 |
| Code background | Light gray | #F5F5F5 |
| Disabled states | Light gray | #CCCCCC |
| Success | Green | #28A745 |
| Warning | Yellow | #FFC107 |
| Error | Red | #DC3545 |

