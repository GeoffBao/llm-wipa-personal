# Wikipedia-Inspired Design Wireframes for LLM Knowledge Base

## 1. MAIN PAGE LAYOUT WIREFRAME

### Desktop View (1200px+)
```
┌──────────────────────────────────────────────────────────────────┐
│ LOGO            SEARCH BOX                      ACCOUNT | DONATE  │
├──────────┬────────────────────────────────────────────────────────┤
│ NAV      │                                                         │
│ MAIN     │  ┌─────────────────────────────────────────────────┐  │
│ ABOUT    │  │                   WELCOME SECTION               │  │
│ EXPLORE  │  │     "277k articles | Last updated: today"       │  │
│          │  └─────────────────────────────────────────────────┘  │
│          │                                                         │
│ CONTRIB  │  ┌──────────────────────┐  ┌──────────────────────┐  │
│ HELP     │  │   FEATURED ARTICLE   │  │                      │  │
│ EDIT     │  │  [IMAGE] TITLE       │  │  FEATURED PICTURE    │  │
│          │  │  Description text    │  │    [LARGE IMAGE]     │  │
│ TOOLS    │  │  ... → Read more     │  │    Caption + info    │  │
│ LINKS    │  │                      │  │                      │  │
│ HISTORY  │  └──────────────────────┘  └──────────────────────┘  │
│          │                                                         │
│          │  ┌──────────────────────┐  ┌──────────────────────┐  │
│          │  │  DID YOU KNOW?       │  │  IN THE NEWS         │  │
│          │  │  • Fact 1 → link     │  │  • Event 1 → link    │  │
│          │  │  • Fact 2 → link     │  │  • Event 2 → link    │  │
│          │  │  • Fact 3 → link     │  │  • Event 3 → link    │  │
│          │  │  ...                 │  │                      │  │
│          │  └──────────────────────┘  └──────────────────────┘  │
│          │                                                         │
│          │  ┌──────────────────────────────────────────────────┐  │
│          │  │  ON THIS DAY (2024)                              │  │
│          │  │  • 1850 - Historical event → link                │  │
│          │  │  • 1923 - Another event → link                   │  │
│          │  │  • 2015 - Recent event → link                    │  │
│          │  └──────────────────────────────────────────────────┘  │
│          │                                                         │
│          │  ┌──────────────────────────────────────────────────┐  │
│          │  │  EXPLORE TOPICS                                  │  │
│          │  │  [Science] [History] [Technology] [Culture] ...  │  │
│          │  └──────────────────────────────────────────────────┘  │
│          │                                                         │
└──────────┴────────────────────────────────────────────────────────┘
```

### Mobile View (< 768px)
```
┌─────────────────────────────┐
│ ≡  LOGO          ACCOUNT     │
│ SEARCH BOX                   │
├─────────────────────────────┤
│  WELCOME                     │
│  277k articles | Updated     │
│                              │
│  FEATURED ARTICLE            │
│  [IMAGE]                     │
│  Title                       │
│  Description                 │
│  Read more →                 │
│                              │
│  DID YOU KNOW?               │
│  • Fact 1 →                  │
│  • Fact 2 →                  │
│                              │
│  IN THE NEWS                 │
│  • Event 1 →                 │
│  • Event 2 →                 │
│                              │
│  ON THIS DAY                 │
│  • Event 1 →                 │
│                              │
└─────────────────────────────┘
```

---

## 2. COMPONENT LIBRARY WIREFRAMES

### Featured Article Card
```
┌─────────────────────────────────────────┐
│  Featured Article                       │
├─────────────────────────────────────────┤
│  [THUMBNAIL]  Article Title             │
│  [150x150]    Compelling description    │
│               spanning 2-3 lines that   │
│               gives readers a reason    │
│               to click and learn more   │
│                                         │
│               → Read full article       │
└─────────────────────────────────────────┘
```

### Did You Know Item (Bullet)
```
• An interesting fact about a topic with a 
  [[hyperlink]] to the full article that 
  provides serendipitous discovery
```

### Section Header with Border
```
┌─────────────────────────────────────────┐
│ Section Header                          │
├─────────────────────────────────────────┤
│  Content goes here                      │
│  Multiple items                         │
│  Listed or arranged                     │
└─────────────────────────────────────────┘
```

### Navigation Sidebar Item (Active)
```
┌──────────────────┐
│ [BACKGROUND]     │
│ > Current Item   │ ← Highlighted/indented
│                  │
│   Sub-item 1     │
│   Sub-item 2     │
│                  │
│ Other Item       │
└──────────────────┘
```

---

## 3. SEARCH RESULTS PAGE LAYOUT

```
┌──────────────────────────────────────────────────────────────────┐
│ LOGO            SEARCH BOX (filled with query)      ACCOUNT      │
├──────────┬────────────────────────────────────────────────────────┤
│ NAV      │                                                         │
│          │  Search Results for "machine learning"                 │
│          │  Showing 1-10 of 2,847 results                        │
│          │  Search profiles: [All] Content Multimedia Advanced   │
│          │                                                         │
│          │  ┌────────────────────────────────────────────────┐   │
│          │  │ Machine Learning                    [category] │   │
│          │  │ en.wikipedia.org/wiki/Machine_Learning         │   │
│          │  │ Machine learning is a subset of AI that...     │   │
│          │  │ includes classification, regression, clustering│   │
│          │  └────────────────────────────────────────────────┘   │
│          │                                                         │
│          │  ┌────────────────────────────────────────────────┐   │
│          │  │ Neural Networks                    [category] │   │
│          │  │ en.wikipedia.org/wiki/Neural_Networks         │   │
│          │  │ Artificial neural networks are...             │   │
│          │  └────────────────────────────────────────────────┘   │
│          │                                                         │
│          │  ┌────────────────────────────────────────────────┐   │
│          │  │ Deep Learning                      [category] │   │
│          │  │ en.wikipedia.org/wiki/Deep_Learning           │   │
│          │  │ Deep learning is part of the machine...       │   │
│          │  └────────────────────────────────────────────────┘   │
│          │                                                         │
│          │  [Previous] 1 2 3 4 5 ... [Next]                      │
│          │                                                         │
└──────────┴────────────────────────────────────────────────────────┘
```

---

## 4. ARTICLE PAGE LAYOUT

```
┌──────────────────────────────────────────────────────────────────┐
│ LOGO            SEARCH BOX                      ACCOUNT | DONATE  │
├──────────┬────────────────────────────────────────────────────────┤
│ NAV      │                                                         │
│ MAIN     │  [Home] > [Category] > Current Article                 │
│          │                                                         │
│          │  Article Title (Bold, Large)                           │
│          │  __________________________________________________     │
│          │                                                         │
│          │  [INFOBOX/                                             │
│          │   IMAGE]    Introduction paragraph with bold terms    │
│          │  [200x300]  and wiki links. This gives readers an     │
│          │             overview of the subject.                   │
│          │                                                         │
│          │  Section 1 Heading                                     │
│          │  ─────────────────────                                 │
│          │  Content paragraphs for section 1. Contains links      │
│          │  to related articles and cross-references.             │
│          │                                                         │
│          │  [IMAGE] Caption with attribution                      │
│          │                                                         │
│          │  Section 2 Heading                                     │
│          │  ─────────────────────                                 │
│          │  More content...                                       │
│          │                                                         │
│          │  References                                            │
│          │  ──────────                                            │
│          │  1. Source Citation [link]                             │
│          │  2. Another Source [link]                              │
│          │                                                         │
│          │  See Also                                              │
│          │  ────────                                              │
│          │  • Related Article 1                                   │
│          │  • Related Article 2                                   │
│          │  • Related Article 3                                   │
│          │                                                         │
└──────────┴────────────────────────────────────────────────────────┘
```

---

## 5. COLOR & TYPOGRAPHY SPECIFICATIONS

### Header (h1)
- Font: Bold sans-serif
- Size: 2em (32px)
- Color: #000
- Line-height: 1.2
- Margin-bottom: 0.5em

### Section Header (h2)
- Font: Bold sans-serif
- Size: 1.5em (24px)
- Color: #000
- Border-bottom: 1px solid #e8e8e8
- Padding-bottom: 0.3em
- Margin-bottom: 0.8em

### Body Text (p)
- Font: Regular sans-serif
- Size: 1em (16px)
- Color: #000
- Line-height: 1.6
- Margin-bottom: 1em

### Links (a)
- Color: #0645ad
- Text-decoration: underline
- Hover: color: #003d99 (darker blue)

### Metadata (small, time, .meta)
- Font: Regular sans-serif
- Size: 0.9em (14px)
- Color: #666
- Margin-top: 0.5em

---

## 6. SPACING & DIMENSIONS

### Section Padding
- Horizontal padding: 20px (mobile) to 40px (desktop)
- Vertical padding: 30px between sections

### Component Margins
- Between major sections: 3em (48px)
- Between subsections: 2em (32px)
- Between items within a section: 1.5em (24px)

### Image Sizes
- Featured article thumbnail: 150-200px width, 150-200px height
- Featured picture: 400-600px width
- Inline article images: 250-350px width
- Thumbnails in lists: 100-150px width

---

## 7. RESPONSIVE BREAKPOINTS

### Mobile (< 768px)
- Single column layout
- Sidebar becomes hamburger menu
- Images: 100% width (max 300px)
- Padding: 15px
- Font size: Slightly smaller for body (0.95em)

### Tablet (768px - 1024px)
- Two column layout with narrower sidebar
- Images: 60-80% width
- Padding: 25px
- Sidebar width: 200px

### Desktop (> 1024px)
- Two-three column layout
- Full sidebar (250px)
- Images: Full card width or 50% for inline
- Padding: 40px
- Max content width: 900px

---

## 8. INTERACTIVE ELEMENT STATES

### Button/Link States
```
Default:    Color: #0645ad, Cursor: pointer
Hover:      Color: #003d99, Text-decoration: underline
Active:     Color: #003d99, Font-weight: bold
Focus:      Outline: 2px solid #0645ad (accessibility)
Disabled:   Color: #ccc, Cursor: not-allowed
```

### Search Box States
```
Default:    Border: 1px solid #e8e8e8, Background: white
Focus:      Border: 2px solid #0645ad, Background: white
Active:     (Focused + typing)
Autocomplete: Dropdown appears below with suggestions
```

### Card/Section States
```
Default:    Border: 1px solid #e8e8e8, Background: white
Hover:      Box-shadow: 0 2px 8px rgba(0,0,0,0.1)
Active:     Border-left: 3px solid #0645ad
```

---

## 9. ACCESSIBILITY FEATURES IN WIREFRAMES

- High contrast text (black on white)
- Keyboard navigation support (all interactive elements)
- Focus indicators (visible outlines)
- Skip links (not shown in wireframes but essential)
- ARIA labels for screen readers
- Image alt text (alt="Description...")
- Semantic HTML structure (nav, main, article, section)
- Form labels explicitly associated with inputs

---

## 10. IMPLEMENTATION NOTES

### Key Components to Build
1. Modular section component (reusable card)
2. Responsive grid layout system
3. Navigation sidebar (collapsible)
4. Search bar with autocomplete
5. Featured content carousel (optional)
6. Breadcrumb navigation
7. Pagination for search results
8. Image gallery/lightbox

### CSS Framework Recommendations
- **Utility-first**: Tailwind CSS (fast prototyping)
- **Component-based**: CSS Modules or BEM (maintainability)
- **Grid System**: CSS Grid (native, no dependencies)
- **Responsive**: Mobile-first media queries

### JavaScript Libraries (Optional)
- Alpine.js (lightweight interactivity)
- Shoelace (web components for common elements)
- Fuse.js (fuzzy search for autocomplete)
- Intersection Observer (lazy loading)

