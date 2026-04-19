# Wikipedia Design Implementation Guide for LLM Knowledge Base

## Executive Summary

This document provides specific, actionable implementation guidance for building an LLM knowledge base interface based on Wikipedia's proven design patterns. Focus on accessibility, information hierarchy, and multiple discovery paths.

---

## PART 1: CORE DESIGN PRINCIPLES

### 1.1 The Wikipedia Success Formula

Wikipedia's interface succeeds because it:

1. **Respects User Time**: Content is scannable in seconds
2. **Supports Multiple Intents**: Search, browse, or serendipitous discovery
3. **Builds Trust**: Metadata, attribution, and timestamps
4. **Scales Elegantly**: Works at 10 articles or 10 million
5. **Stays Out of the Way**: Minimal decoration, maximum clarity

### 1.2 Applying This to Your LLM KB

For an LLM knowledge base:
- **Scannable**: Show key facts, statistics, related topics at a glance
- **Multiple paths**: Search + browse + featured + related content
- **Trust signals**: Generation date, confidence scores, sources
- **Scalable design**: Works whether you have 50 or 5,000 topics
- **Content-focused**: Let the knowledge shine, not the interface

---

## PART 2: LAYOUT SYSTEM IMPLEMENTATION

### 2.1 CSS Grid Architecture

Recommended grid setup for responsive layout:

```css
/* Desktop (> 1024px) */
.page-container {
  display: grid;
  grid-template-columns: 250px 1fr;
  gap: 2rem;
  max-width: 1400px;
  margin: 0 auto;
}

.sidebar {
  grid-column: 1;
  position: sticky;
  top: 0;
  height: fit-content;
}

.main-content {
  grid-column: 2;
}

/* Tablet (768px - 1024px) */
@media (max-width: 1024px) {
  .page-container {
    grid-template-columns: 200px 1fr;
    gap: 1.5rem;
  }
}

/* Mobile (< 768px) */
@media (max-width: 768px) {
  .page-container {
    grid-template-columns: 1fr;
    gap: 1rem;
  }

  .sidebar {
    position: static;
    order: -1; /* Show after hamburger menu */
  }
}
```

### 2.2 Content Section Structure

Each main content section should follow this pattern:

```css
.content-section {
  background: white;
  border: 1px solid #e8e8e8;
  border-radius: 4px;
  padding: 1.5rem;
  margin-bottom: 2rem;
}

.section-header {
  font-size: 1.5em;
  font-weight: bold;
  border-bottom: 1px solid #e8e8e8;
  padding-bottom: 0.5rem;
  margin-bottom: 1rem;
}

.section-content {
  font-size: 1em;
  line-height: 1.6;
  color: #000;
}
```

### 2.3 Flexible Column Layouts

For multi-column featured content:

```css
.featured-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.featured-card {
  background: white;
  border: 1px solid #e8e8e8;
  padding: 1rem;
  border-radius: 4px;
}

.featured-card img {
  width: 100%;
  height: auto;
  margin-bottom: 1rem;
}

/* 2-column on desktop, 1-column on mobile */
@media (max-width: 768px) {
  .featured-grid {
    grid-template-columns: 1fr;
  }
}
```

---

## PART 3: COMPONENT IMPLEMENTATION

### 3.1 Search Bar Component

**HTML Structure:**
```html
<div class="search-container">
  <form class="search-form" role="search">
    <input
      type="search"
      class="search-input"
      placeholder="Search the knowledge base..."
      aria-label="Search"
      accesskey="f"
    />
    <button
      type="submit"
      class="search-button"
      aria-label="Search"
    >
      <span aria-hidden="true">🔍</span>
    </button>
  </form>
  <div class="search-hints" id="search-hints" role="region" aria-live="polite">
    <!-- Autocomplete suggestions appear here -->
  </div>
</div>
```

**CSS:**
```css
.search-container {
  position: relative;
  flex: 1;
  max-width: 500px;
}

.search-form {
  display: flex;
  gap: 0.5rem;
}

.search-input {
  flex: 1;
  padding: 0.75rem 1rem;
  font-size: 1rem;
  border: 1px solid #e8e8e8;
  border-radius: 4px 0 0 4px;
  font-family: inherit;
  transition: border-color 0.2s;
}

.search-input:focus {
  outline: none;
  border-color: #0645ad;
  box-shadow: 0 0 0 2px rgba(6, 69, 173, 0.1);
}

.search-button {
  padding: 0.75rem 1rem;
  background: #0645ad;
  color: white;
  border: none;
  border-radius: 0 4px 4px 0;
  cursor: pointer;
  font-weight: bold;
  transition: background 0.2s;
}

.search-button:hover {
  background: #003d99;
}

.search-button:focus {
  outline: 2px solid #0645ad;
  outline-offset: 2px;
}
```

### 3.2 Navigation Sidebar Component

**HTML Structure:**
```html
<nav class="sidebar" aria-label="Main navigation">
  <button
    class="mobile-menu-toggle"
    aria-controls="nav-menu"
    aria-expanded="false"
  >
    ☰ Menu
  </button>

  <ul id="nav-menu" class="nav-menu" hidden>
    <li><a href="/" class="nav-link active">Main Page</a></li>
    <li><a href="/categories" class="nav-link">Explore</a></li>
    <li><a href="/recent" class="nav-link">Recent Updates</a></li>

    <li class="nav-section">
      <strong>Contribute</strong>
      <ul>
        <li><a href="/help" class="nav-link">Help</a></li>
        <li><a href="/edit" class="nav-link">Submit Knowledge</a></li>
        <li><a href="/community" class="nav-link">Community</a></li>
      </ul>
    </li>

    <li class="nav-section">
      <strong>Tools</strong>
      <ul>
        <li><a href="/history" class="nav-link">History</a></li>
        <li><a href="/related" class="nav-link">Related Topics</a></li>
        <li><a href="/api" class="nav-link">API</a></li>
      </ul>
    </li>
  </ul>
</nav>
```

**CSS:**
```css
.sidebar {
  background: white;
}

.mobile-menu-toggle {
  display: none;
  width: 100%;
  padding: 1rem;
  background: white;
  border: 1px solid #e8e8e8;
  text-align: left;
  cursor: pointer;
  font-weight: bold;
}

@media (max-width: 768px) {
  .mobile-menu-toggle {
    display: block;
  }

  .nav-menu[hidden] {
    display: none;
  }

  .nav-menu {
    border-top: 1px solid #e8e8e8;
  }
}

.nav-menu {
  list-style: none;
  padding: 0;
  margin: 0;
}

.nav-link {
  display: block;
  padding: 0.75rem 1rem;
  color: #0645ad;
  text-decoration: none;
  border-left: 3px solid transparent;
  transition: all 0.2s;
}

.nav-link:hover {
  background: #f5f5f5;
  border-left-color: #0645ad;
}

.nav-link.active {
  background: #f5f5f5;
  border-left-color: #0645ad;
  font-weight: bold;
}

.nav-section {
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid #e8e8e8;
}

.nav-section strong {
  display: block;
  padding: 0.5rem 1rem;
  font-size: 0.9em;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.nav-section ul {
  list-style: none;
  padding: 0;
  margin: 0;
  padding-left: 0.5rem;
}
```

### 3.3 Featured Article Card

**HTML Structure:**
```html
<article class="featured-card">
  <h2 class="featured-header">Featured Article</h2>

  <div class="featured-content">
    <img
      src="/image.jpg"
      alt="Related to: Machine Learning"
      class="featured-image"
      loading="lazy"
    />

    <div class="featured-text">
      <h3><a href="/article/machine-learning">Machine Learning</a></h3>

      <p>
        Machine learning is a subset of artificial intelligence that focuses
        on the development of computer algorithms that can learn from and make
        predictions on data. It enables systems to improve performance through
        experience without being explicitly programmed for every scenario.
      </p>

      <p class="featured-meta">
        Last updated: <time datetime="2024-04-19">April 19, 2024</time>
      </p>

      <a href="/article/machine-learning" class="read-more">
        Read full article →
      </a>
    </div>
  </div>
</article>
```

**CSS:**
```css
.featured-card {
  background: white;
  border: 1px solid #e8e8e8;
  padding: 1.5rem;
  border-radius: 4px;
}

.featured-header {
  font-size: 1.3em;
  font-weight: bold;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #e8e8e8;
}

.featured-content {
  display: grid;
  grid-template-columns: 150px 1fr;
  gap: 1rem;
}

.featured-image {
  width: 150px;
  height: 150px;
  object-fit: cover;
  border-radius: 4px;
}

.featured-text h3 {
  font-size: 1.2em;
  margin: 0 0 0.5rem 0;
}

.featured-text h3 a {
  color: #0645ad;
  text-decoration: none;
}

.featured-text h3 a:hover {
  text-decoration: underline;
}

.featured-text p {
  margin: 0 0 0.5rem 0;
  line-height: 1.6;
  color: #333;
}

.featured-meta {
  font-size: 0.9em;
  color: #666;
  margin: 1rem 0 !important;
}

.read-more {
  display: inline-block;
  color: #0645ad;
  text-decoration: none;
  font-weight: bold;
  margin-top: 0.5rem;
}

.read-more:hover {
  text-decoration: underline;
}

/* Mobile responsiveness */
@media (max-width: 768px) {
  .featured-content {
    grid-template-columns: 100px 1fr;
    gap: 1rem;
  }

  .featured-image {
    width: 100px;
    height: 100px;
  }
}
```

### 3.4 "Did You Know" Section

**HTML Structure:**
```html
<section class="dyk-section">
  <h2 class="section-header">Did You Know?</h2>

  <ul class="dyk-list">
    <li class="dyk-item">
      that <a href="/article/quantum-computing">quantum computers</a>
      can perform certain calculations exponentially faster than classical
      computers by leveraging quantum mechanical phenomena?
    </li>

    <li class="dyk-item">
      that <a href="/article/photosynthesis">photosynthesis</a>
      converts light energy into chemical energy used by plants for growth?
    </li>

    <li class="dyk-item">
      that the <a href="/article/great-barrier-reef">Great Barrier Reef</a>
      is visible from space and contains over 1,500 fish species?
    </li>
  </ul>
</section>
```

**CSS:**
```css
.dyk-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.dyk-item {
  padding: 1rem;
  margin-bottom: 0.5rem;
  background: #f9f9f9;
  border-left: 3px solid #0645ad;
  line-height: 1.6;
  color: #333;
}

.dyk-item:hover {
  background: #f5f5f5;
}

.dyk-item a {
  color: #0645ad;
  text-decoration: none;
  font-weight: bold;
}

.dyk-item a:hover {
  text-decoration: underline;
}
```

---

## PART 4: TYPOGRAPHY & COLOR IMPLEMENTATION

### 4.1 Font Stack and Sizing

```css
:root {
  --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica,
    Arial, sans-serif;
  --font-mono: "SF Mono", Monaco, "Cascadia Code", "Roboto Mono",
    Consolas, "Courier New", monospace;

  /* Font sizes */
  --size-xs: 0.75rem; /* 12px */
  --size-sm: 0.875rem; /* 14px */
  --size-base: 1rem; /* 16px */
  --size-lg: 1.125rem; /* 18px */
  --size-xl: 1.25rem; /* 20px */
  --size-2xl: 1.5rem; /* 24px */
  --size-3xl: 1.875rem; /* 30px */
  --size-4xl: 2.25rem; /* 36px */
}

body {
  font-family: var(--font-sans);
  font-size: var(--size-base);
  line-height: 1.6;
  color: #000;
  background: #fff;
}

h1 {
  font-size: var(--size-4xl);
  font-weight: 700;
  line-height: 1.2;
  margin: 0 0 0.5rem 0;
}

h2 {
  font-size: var(--size-2xl);
  font-weight: 700;
  line-height: 1.3;
  margin: 1.5rem 0 0.5rem 0;
  border-bottom: 1px solid #e8e8e8;
  padding-bottom: 0.3rem;
}

h3 {
  font-size: var(--size-xl);
  font-weight: 700;
  margin: 1rem 0 0.5rem 0;
}

p {
  margin: 0 0 1em 0;
}

small,
.text-sm {
  font-size: var(--size-sm);
}

code {
  font-family: var(--font-mono);
  background: #f5f5f5;
  padding: 0.2em 0.4em;
  border-radius: 3px;
}

pre {
  background: #f5f5f5;
  padding: 1rem;
  border-radius: 4px;
  overflow-x: auto;
  font-family: var(--font-mono);
  font-size: var(--size-sm);
}
```

### 4.2 Color System

```css
:root {
  /* Primary colors */
  --color-blue: #0645ad;
  --color-blue-dark: #003d99;
  --color-blue-light: #e6f0ff;

  /* Neutral colors */
  --color-black: #000;
  --color-gray-900: #111;
  --color-gray-700: #333;
  --color-gray-600: #555;
  --color-gray-500: #777;
  --color-gray-400: #999;
  --color-gray-300: #ddd;
  --color-gray-200: #e8e8e8;
  --color-gray-100: #f5f5f5;
  --color-white: #fff;

  /* Semantic colors */
  --color-success: #28a745;
  --color-warning: #ffc107;
  --color-error: #dc3545;
  --color-info: #17a2b8;
}

/* Color usage */
a {
  color: var(--color-blue);
}

a:hover {
  color: var(--color-blue-dark);
}

.border {
  border-color: var(--color-gray-200);
}

.bg-light {
  background: var(--color-gray-100);
}

.text-muted {
  color: var(--color-gray-500);
}
```

---

## PART 5: ACCESSIBILITY IMPLEMENTATION

### 5.1 Semantic HTML

Use proper semantic elements:

```html
<!-- Header -->
<header>
  <nav aria-label="Main navigation">...</nav>
  <div class="search-container" role="search">...</div>
</header>

<!-- Main content -->
<main>
  <article>
    <h1>Article Title</h1>
    <section>
      <h2>Section</h2>
      <p>Content...</p>
    </section>
  </article>
</main>

<!-- Footer -->
<footer>
  <nav aria-label="Footer navigation">...</nav>
</footer>
```

### 5.2 ARIA Labels

```html
<!-- Search input -->
<input
  type="search"
  aria-label="Search the knowledge base"
  placeholder="Search..."
/>

<!-- Navigation -->
<nav aria-label="Main navigation">
  <ul>
    <li><a href="/main" aria-current="page">Main</a></li>
  </ul>
</nav>

<!-- Live regions -->
<div id="search-results" role="region" aria-live="polite" aria-label="Search results">
  <!-- Results appear here -->
</div>

<!-- Skip link -->
<a href="#main-content" class="skip-link">Skip to main content</a>
```

### 5.3 Focus Indicators

```css
/* Visible focus for keyboard navigation */
:focus {
  outline: 2px solid var(--color-blue);
  outline-offset: 2px;
}

/* Remove default outline for mouse users */
:focus:not(:focus-visible) {
  outline: none;
}

/* More visible for keyboard users */
:focus-visible {
  outline: 2px solid var(--color-blue);
  outline-offset: 2px;
}
```

### 5.4 Color Contrast

- **Text on background**: Minimum 4.5:1 ratio (WCAG AA)
- **Large text**: Minimum 3:1 ratio
- **UI components**: Minimum 3:1 ratio
- Use this tool to verify: https://contrast-ratio.com

Example compliant colors:
- Black text (#000) on white (#fff): 21:1 ✓
- Dark blue (#003d99) on white (#fff): 8.6:1 ✓
- Blue links (#0645ad) on white (#fff): 7.5:1 ✓

---

## PART 6: PERFORMANCE OPTIMIZATION

### 6.1 Image Loading

```html
<!-- Use lazy loading -->
<img
  src="image.jpg"
  alt="Description"
  loading="lazy"
  width="300"
  height="200"
/>

<!-- Use responsive images -->
<picture>
  <source srcset="image-small.jpg" media="(max-width: 768px)" />
  <source srcset="image-medium.jpg" media="(max-width: 1024px)" />
  <img src="image-large.jpg" alt="Description" />
</picture>
```

### 6.2 Critical CSS

Load essential styles inline:

```html
<style>
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    margin: 0;
    padding: 0;
  }
  .main { max-width: 1400px; margin: 0 auto; }
  .sidebar { float: left; width: 250px; }
  .content { margin-left: 250px; }
  @media (max-width: 768px) {
    .sidebar { float: none; width: 100%; }
    .content { margin-left: 0; }
  }
</style>
```

### 6.3 Font Optimization

```css
/* Use system fonts (zero load time) */
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica,
    Arial, sans-serif;
}

/* If custom fonts needed, use font-display swap */
@font-face {
  font-family: "CustomFont";
  src: url("/fonts/custom.woff2") format("woff2");
  font-display: swap;
  font-weight: 400;
}
```

---

## PART 7: IMPLEMENTATION CHECKLIST

### Phase 1: Core Layout (Week 1)
- [ ] Responsive grid system (desktop/tablet/mobile)
- [ ] Header with logo and navigation
- [ ] Sidebar navigation
- [ ] Search box in header
- [ ] Basic color scheme (white, black, blue)
- [ ] Typography hierarchy (H1, H2, H3, body)

### Phase 2: Main Page Sections (Week 2)
- [ ] Welcome section
- [ ] Featured article card component
- [ ] Did You Know section
- [ ] In the News section
- [ ] On This Day section
- [ ] Featured media/image
- [ ] Footer with links

### Phase 3: Search & Navigation (Week 3)
- [ ] Search results page layout
- [ ] Search profiles (all, content, advanced)
- [ ] Autocomplete functionality
- [ ] Breadcrumb navigation
- [ ] Category/collection pages
- [ ] Related articles section

### Phase 4: Polish & Accessibility (Week 4)
- [ ] Keyboard navigation testing
- [ ] Screen reader testing
- [ ] Color contrast verification (WCAG AA)
- [ ] Image optimization and lazy loading
- [ ] Mobile responsiveness testing
- [ ] Performance optimization
- [ ] Dark mode (optional)

### Phase 5: Advanced Features (Week 5+)
- [ ] User preferences (saved settings)
- [ ] Reading history
- [ ] Bookmarks/favorites
- [ ] Share functionality
- [ ] Print-friendly pages
- [ ] Analytics integration

---

## PART 8: TESTING & VALIDATION

### 8.1 Accessibility Testing

```bash
# Use axe DevTools for automated checks
# Run Lighthouse audit
# Test with keyboard only (Tab, Enter, Escape)
# Test with screen reader (NVDA, JAWS, VoiceOver)
```

### 8.2 Responsive Testing

```bash
# Test breakpoints:
# Mobile: 320px, 375px, 425px
# Tablet: 768px, 810px, 1024px
# Desktop: 1280px, 1440px, 1920px

# Use Chrome DevTools responsive mode
# Test on real devices when possible
```

### 8.3 Performance Testing

```bash
# Lighthouse score target: 90+
# Core Web Vitals:
#   LCP (Largest Contentful Paint): < 2.5s
#   FID (First Input Delay): < 100ms
#   CLS (Cumulative Layout Shift): < 0.1
```

---

## FINAL NOTES

**Success Criteria:**
- Users can find information via search OR browsing
- Main page loads in < 2 seconds
- Mobile experience is as good as desktop
- All interactions are keyboard accessible
- High color contrast throughout
- Links are visually distinct (blue, underlined)

**Remember:**
The goal isn't to replicate Wikipedia exactly, but to apply its proven principles to your LLM knowledge base. Adapt based on your specific needs and user behaviors.

