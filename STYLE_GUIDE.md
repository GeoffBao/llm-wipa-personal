# Wikipedia-Inspired UI Style Guide

## 1. DESIGN PHILOSOPHY

Wikipedia's design is built on three pillars:

1. **Content First** — Everything serves the information
2. **Accessibility Always** — Works for everyone
3. **Clarity Over Beauty** — Function beats decoration

Your LLM knowledge base should embrace the same philosophy.

---

## 2. COLOR SYSTEM

### Color Palette

```
PRIMARY BLUE (Links, CTAs)
  Hex: #0645AD
  Usage: Hyperlinks, active buttons, focus states
  
DARK BLUE (Hover states)
  Hex: #003D99
  Usage: Link hover, button active, darker emphasis
  
WHITE (Background)
  Hex: #FFFFFF
  Usage: Page background, card backgrounds
  
BLACK (Text)
  Hex: #000000
  Usage: Body text, headings, strong emphasis
  
LIGHT GRAY (Borders, dividers)
  Hex: #E8E8E8
  Usage: Card borders, section dividers, rule lines
  
MEDIUM GRAY (Secondary text)
  Hex: #999999
  Usage: Metadata, timestamps, helper text, disabled
  
OFF-WHITE (Section backgrounds)
  Hex: #F5F5F5
  Usage: Code blocks, alternate rows, subtle backgrounds
```

### Color Usage Rules

1. **Never use more than 3 colors in a single screen** (black, blue, gray)
2. **Links are always blue** — no exceptions
3. **White background for main content** — always
4. **Gray for non-critical information** — dates, metadata, hints
5. **Semantic colors used sparingly** — success (green), error (red), warning (yellow)

### Accessibility

- All text must have at least 4.5:1 contrast ratio (WCAG AA)
- **Black on white**: 21:1 ✓
- **Blue on white**: 7.5:1 ✓
- **Gray on white**: 5.1:1 ✓
- **Light gray on white**: 2.8:1 ✗ (don't use for body text)

---

## 3. TYPOGRAPHY

### Font Stack
```
-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif
```

### Font Sizing Scale

| Level | Size | Usage |
|-------|------|-------|
| H1 | 2.25em (36px) | Page title |
| H2 | 1.5em (24px) | Section headers |
| H3 | 1.25em (20px) | Subsection headers |
| H4 | 1.125em (18px) | Minor headers |
| Body | 1em (16px) | Paragraphs, lists |
| Small | 0.875em (14px) | Captions, metadata |
| Tiny | 0.75em (12px) | Hints, very small text |

### Font Weights

- **Bold (700)**: Headings, strong emphasis, important info
- **Regular (400)**: Body text, default
- **Medium (500)**: Optional for secondary emphasis

### Line Heights

- **Tight (1.2)**: Headings only
- **Normal (1.6)**: Body text, lists, paragraphs
- **Relaxed (1.8)**: Large text blocks (rare)

### Typographic Hierarchy Example

```
Main Article Title (H1)
═════════════════════════════════════════════════

Introduction paragraph in regular weight. This is the
body text at 16px with 1.6x line height for optimal
readability. It should feel spacious and clear.

Section Header (H2)
─────────────────────────────────────────────────

Subsection Header (H3)

Body text continues here with consistent styling.

• List items use bullets
• Not numbered (mimics Wikipedia style)
• Each item on its own line

Metadata or helper text appears small and gray.
Last updated: April 19, 2024
```

---

## 4. SPACING & LAYOUT

### Spacing Scale
```
4px  — xs (very tight, only for special cases)
8px  — sm (small padding/margin)
16px — md (standard padding, button height)
24px — lg (section padding, spacing between cards)
32px — xl (large spacing between major sections)
48px — 2xl (hero spacing, maximum gap)
```

### Card/Section Structure

```
┌─────────────────────────────────────────┐
│ 16px padding                            │
│                                         │
│  SECTION HEADER (24px font)             │
│  ──────────────────────────────────      │
│  8px top margin                         │
│                                         │
│  Body content with 24px spacing         │
│  between paragraphs. Images are         │
│  16px from text.                        │
│                                         │
│  [IMAGE] Text wraps beside image        │
│                                         │
│  32px spacing to next section           │
│                                         │
└─────────────────────────────────────────┘
```

### Responsive Spacing

**Desktop (> 1024px)**
- Container padding: 40px
- Section margins: 32px
- Card padding: 24px

**Tablet (768px - 1024px)**
- Container padding: 25px
- Section margins: 24px
- Card padding: 16px

**Mobile (< 768px)**
- Container padding: 15px
- Section margins: 16px
- Card padding: 12px

---

## 5. COMPONENT PATTERNS

### Links
```
DEFAULT: Blue text, no underline
  Color: #0645AD
  Text-decoration: none

HOVER: Darker blue with underline
  Color: #003D99
  Text-decoration: underline

VISITED: Slightly darker blue
  Color: #7B2CBF
  Text-decoration: none

FOCUS: Outline for keyboard users
  Outline: 2px solid #0645AD
  Outline-offset: 2px
```

### Buttons

**Primary Button** (CTA, action)
```
Background: #0645AD (blue)
Color: #FFFFFF (white text)
Padding: 12px 24px (vertical x horizontal)
Border: None
Border-radius: 4px
Font-weight: Bold

States:
  Hover: #003D99 (darker blue)
  Active: #002060 (even darker)
  Disabled: #CCCCCC (gray)
  Focus: Outline as above
```

**Secondary Button** (alternate action)
```
Background: #F5F5F5 (light gray)
Color: #0645AD (blue text)
Border: 1px solid #E8E8E8
Padding: 12px 24px
Border-radius: 4px

States:
  Hover: #F0F0F0 (slightly darker gray)
  Active: #E8E8E8 (even darker)
```

### Form Inputs
```
Border: 1px solid #E8E8E8
Background: #FFFFFF
Padding: 12px
Border-radius: 4px
Font-size: 1em (inherit)
Font-family: inherit

States:
  Focus: Border #0645AD + box-shadow: 0 0 0 2px rgba(6,69,173,0.1)
  Error: Border #DC3545
  Disabled: Background #F5F5F5, color #999999
```

### Cards/Sections
```
Background: #FFFFFF
Border: 1px solid #E8E8E8
Border-radius: 4px
Padding: 24px
Box-shadow: None (or 0 1px 2px rgba(0,0,0,0.05))

On hover (optional):
  Box-shadow: 0 4px 6px rgba(0,0,0,0.1)
  (Adds subtle lift effect)
```

---

## 6. IMAGE USAGE

### Image Sizing

**Featured Article Thumbnail**
- Width: 150-200px
- Height: 150-200px
- Aspect ratio: Square or 4:3
- Position: Left-aligned, text wraps right

**Featured Picture**
- Width: 100% (max 600px)
- Height: Auto
- Aspect ratio: Varies
- Caption below with attribution

**Inline Images**
- Max width: 50% of column
- Height: Auto
- Captions: Small gray text below
- Alt text: Always provided

### Image Quality
- Format: WebP with JPG/PNG fallback
- Compression: Optimized but clear
- DPI: 72 dpi for web
- Color space: sRGB

---

## 7. NAVIGATION PATTERNS

### Header Navigation
```
┌─────────────────────────────────────────────┐
│ Logo    Search Box            Account Logout│
└─────────────────────────────────────────────┘
```

### Sidebar Navigation
```
┌──────────────────────────┐
│ Navigation               │
│ ▸ Main Page              │
│ ▸ Explore                │
│ ▸ Recent Updates         │
│                          │
│ Contribute               │
│ ▸ Help                   │
│ ▸ Submit Knowledge       │
│ ▸ Community              │
│                          │
│ Tools                    │
│ ▸ History                │
│ ▸ Related Topics         │
└──────────────────────────┘
```

**Navigation Items:**
- Each item has consistent height (44px for touch)
- Indented subsections (8-16px left padding)
- Active item: bold text + left border color
- Hover state: light gray background

---

## 8. INTERACTIVE ELEMENTS

### Hover States
```
Links: Color #003D99 + underline
Buttons: Color change + subtle lift
Cards: Slight shadow increase
```

### Active/Selected States
```
Navigation items: Bold + left border highlight
Tabs: Bold + underline or background
Checkboxes: Filled, no animation needed
```

### Focus States (Keyboard Navigation)
```
All interactive elements must show:
  Outline: 2px solid #0645AD
  Outline-offset: 2px
  Visible from all directions
```

### Disabled States
```
Opacity: 0.5 or lighter color
Color: #CCCCCC gray
Cursor: not-allowed
No hover effects
```

---

## 9. CONTENT LAYOUT PATTERNS

### Article Layout
```
[Image]  Article Title
[150x]   
[150p]   Introduction paragraph spanning 2-3 lines
         with key terms bolded for scanning.
         
         Section Header
         ──────────────
         Body paragraphs in regular weight, 16px,
         with consistent line height of 1.6 for
         comfortable reading.
         
         [Image] Caption text below images
         [400w]
         
         References
         ──────────
         1. Source Title [link]
         2. Another Source [link]
         
         See Also
         ────────
         • Related Article 1
         • Related Article 2
```

### Featured Content Grid
```
Desktop (3+ columns):
[Card 1] [Card 2] [Card 3]

Tablet (2 columns):
[Card 1] [Card 2]
[Card 3] [Card 4]

Mobile (1 column):
[Card 1]
[Card 2]
[Card 3]
```

---

## 10. STATES & VARIANTS

### Message/Alert Types

**Success** (green)
- Background: #D4EDDA
- Border: #28A745
- Text: #155724
- Icon: ✓ checkmark

**Warning** (yellow)
- Background: #FFF3CD
- Border: #FFC107
- Text: #856404
- Icon: ⚠ warning

**Error** (red)
- Background: #F8D7DA
- Border: #DC3545
- Text: #721C24
- Icon: ✕ cross

**Info** (blue)
- Background: #D1ECF1
- Border: #17A2B8
- Text: #0C5460
- Icon: ℹ info

---

## 11. ANIMATION & MOTION

### General Rules
- Keep animations under 200ms
- Use easing: cubic-bezier(0.4, 0, 0.2, 1)
- No auto-playing animations
- Respect prefers-reduced-motion

### Common Animations
```css
/* Fade in */
transition: opacity 0.2s ease;

/* Slide */
transition: transform 0.3s ease;

/* Color change */
transition: background-color 0.2s ease, color 0.2s ease;

/* Scale (on hover) */
transform: scale(1.02);
transition: transform 0.2s ease;
```

### Avoid
- Flashing content
- Auto-playing videos
- Parallax scrolling
- Spinning loaders (use progress bars instead)

---

## 12. RESPONSIVE DESIGN BREAKPOINTS

```css
/* Mobile-first approach */

/* Small phones: 320px */
@media (min-width: 320px) { /* base styles */ }

/* Larger phones: 375px - 425px */
@media (min-width: 375px) { /* adjust fonts */ }

/* Tablets: 768px - 810px */
@media (min-width: 768px) {
  .sidebar { display: block; }
  .grid { grid-template-columns: 1fr 1fr; }
}

/* Medium devices: 1024px */
@media (min-width: 1024px) {
  .page { max-width: 1200px; }
  .grid { grid-template-columns: repeat(3, 1fr); }
}

/* Large devices: 1440px+ */
@media (min-width: 1440px) {
  .page { max-width: 1400px; }
  .grid { column-gap: 2rem; }
}
```

---

## 13. ACCESSIBILITY CHECKLIST

### Visual
- [ ] Color contrast 4.5:1 for text
- [ ] Link underlines visible
- [ ] Focus indicators clearly visible
- [ ] No information conveyed by color alone

### Semantic
- [ ] Proper heading hierarchy (H1 > H2 > H3)
- [ ] Semantic HTML (nav, main, article, section)
- [ ] ARIA labels where needed
- [ ] Images have alt text

### Interactive
- [ ] All elements keyboard accessible
- [ ] Tab order logical
- [ ] Form labels associated with inputs
- [ ] Error messages helpful and visible

### Content
- [ ] Plain language, short sentences
- [ ] Clear headings describing content
- [ ] Bulleted lists not numbered (where applicable)
- [ ] Links have descriptive text

---

## 14. DO'S & DON'TS

### DO
- Use white space generously
- Keep line lengths 50-75 characters
- Use single column on mobile
- Test actual hardware/browsers
- Prioritize reading and scanning
- Use semantic HTML

### DON'T
- Use too many colors
- Auto-play videos or music
- Use flashing animations
- Rely on hover states on mobile
- Hide main navigation
- Use fixed-width layouts

---

## 15. FILE STRUCTURE EXAMPLE

```
project/
├── index.html
├── styles/
│   ├── variables.css (colors, sizes, fonts)
│   ├── base.css (typography, resets)
│   ├── layout.css (grid, containers)
│   ├── components.css (cards, buttons, etc)
│   ├── utilities.css (helper classes)
│   └── responsive.css (media queries)
├── scripts/
│   ├── main.js
│   └── search.js
└── assets/
    ├── images/
    ├── icons/
    └── fonts/ (if using custom fonts)
```

---

## FINAL GUIDELINES

**Remember**: The design should be **invisible**. Users should see content, not interface. Every design decision serves clarity and accessibility, not decoration.

When in doubt, ask: "Does this serve the content?" If yes, keep it. If no, remove it.

