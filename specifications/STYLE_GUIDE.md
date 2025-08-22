# ChatANON Style Guide
*Based on SSI Strategy design principles*

## Design Philosophy
Clean, professional, and trustworthy design that emphasizes clarity and data security. The interface should feel modern and technical while remaining approachable and easy to use.

## Color Palette

### Primary Colors
```css
--primary-dark: #1e293b;      /* Deep slate blue - headers, primary actions */
--primary-main: #334155;      /* Slate blue - main UI elements */
--primary-light: #475569;     /* Light slate - hover states */
```

### Secondary Colors
```css
--secondary-main: #3b82f6;    /* Bright blue - CTAs, links */
--secondary-light: #60a5fa;   /* Light blue - hover states */
--secondary-dark: #2563eb;    /* Dark blue - active states */
```

### Neutral Colors
```css
--gray-50: #f9fafb;           /* Background */
--gray-100: #f3f4f6;          /* Light backgrounds */
--gray-200: #e5e7eb;          /* Borders */
--gray-300: #d1d5db;          /* Disabled states */
--gray-400: #9ca3af;          /* Placeholder text */
--gray-500: #6b7280;          /* Secondary text */
--gray-600: #4b5563;          /* Body text */
--gray-700: #374151;          /* Headings */
--gray-800: #1f2937;          /* Dark text */
--gray-900: #111827;          /* Darkest text */
```

### Semantic Colors
```css
--success: #10b981;           /* Green - successful anonymization */
--warning: #f59e0b;           /* Amber - medium confidence */
--error: #ef4444;             /* Red - errors, high-risk PII */
--info: #3b82f6;              /* Blue - informational */
```

### Transparency & Overlays
```css
--overlay-dark: rgba(30, 41, 59, 0.8);
--overlay-light: rgba(255, 255, 255, 0.95);
--glass-effect: rgba(255, 255, 255, 0.1);
```

## Typography

### Font Stack
```css
--font-primary: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', sans-serif;
--font-mono: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', monospace;
```

### Font Sizes
```css
--text-xs: 0.75rem;     /* 12px - labels, captions */
--text-sm: 0.875rem;    /* 14px - secondary text */
--text-base: 1rem;      /* 16px - body text */
--text-lg: 1.125rem;    /* 18px - large body */
--text-xl: 1.25rem;     /* 20px - small headings */
--text-2xl: 1.5rem;     /* 24px - section headings */
--text-3xl: 1.875rem;   /* 30px - page headings */
--text-4xl: 2.25rem;    /* 36px - hero headings */
```

### Font Weights
```css
--font-normal: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;
```

### Line Heights
```css
--leading-tight: 1.25;
--leading-normal: 1.5;
--leading-relaxed: 1.625;
```

## Spacing System

### Base Unit: 4px
```css
--space-1: 0.25rem;   /* 4px */
--space-2: 0.5rem;    /* 8px */
--space-3: 0.75rem;   /* 12px */
--space-4: 1rem;      /* 16px */
--space-5: 1.25rem;   /* 20px */
--space-6: 1.5rem;    /* 24px */
--space-8: 2rem;      /* 32px */
--space-10: 2.5rem;   /* 40px */
--space-12: 3rem;     /* 48px */
--space-16: 4rem;     /* 64px */
```

## Component Styles

### Buttons
```css
.btn-primary {
  background: var(--secondary-main);
  color: white;
  padding: var(--space-3) var(--space-6);
  border-radius: 9999px;  /* Fully rounded */
  font-weight: var(--font-semibold);
  transition: all 0.2s ease;
  border: none;
  cursor: pointer;
}

.btn-primary:hover {
  background: var(--secondary-dark);
  transform: translateY(-1px);
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.btn-secondary {
  background: transparent;
  color: var(--primary-main);
  border: 2px solid var(--gray-200);
  padding: var(--space-3) var(--space-6);
  border-radius: 9999px;
}

.btn-ghost {
  background: transparent;
  color: var(--gray-600);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--space-2);
}
```

### Cards
```css
.card {
  background: white;
  border-radius: var(--space-3);
  padding: var(--space-6);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  border: 1px solid var(--gray-200);
}

.card-hover {
  transition: all 0.3s ease;
}

.card-hover:hover {
  box-shadow: 0 10px 15px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}
```

### Input Fields
```css
.input {
  width: 100%;
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--gray-300);
  border-radius: var(--space-2);
  font-size: var(--text-base);
  transition: all 0.2s ease;
}

.input:focus {
  outline: none;
  border-color: var(--secondary-main);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.textarea {
  min-height: 120px;
  resize: vertical;
}
```

## Layout Patterns

### Container Widths
```css
--container-sm: 640px;
--container-md: 768px;
--container-lg: 1024px;
--container-xl: 1280px;
--container-2xl: 1536px;
```

### Grid System
```css
.grid {
  display: grid;
  gap: var(--space-6);
}

.grid-cols-1 { grid-template-columns: repeat(1, 1fr); }
.grid-cols-2 { grid-template-columns: repeat(2, 1fr); }
.grid-cols-3 { grid-template-columns: repeat(3, 1fr); }
.grid-cols-4 { grid-template-columns: repeat(4, 1fr); }
```

### Flexbox Utilities
```css
.flex { display: flex; }
.flex-col { flex-direction: column; }
.items-center { align-items: center; }
.justify-between { justify-content: space-between; }
.justify-center { justify-content: center; }
.gap-4 { gap: var(--space-4); }
```

## ChatANON Specific Components

### Chat Message
```css
.message {
  padding: var(--space-4);
  border-radius: var(--space-3);
  margin-bottom: var(--space-4);
  max-width: 80%;
}

.message-user {
  background: var(--gray-100);
  margin-left: auto;
}

.message-system {
  background: white;
  border: 1px solid var(--gray-200);
}
```

### PII Badge
```css
.pii-badge {
  display: inline-block;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--space-1);
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  font-family: var(--font-mono);
}

.pii-high-confidence {
  background: var(--success);
  color: white;
}

.pii-medium-confidence {
  background: var(--warning);
  color: white;
}

.pii-low-confidence {
  background: var(--error);
  color: white;
}
```

### Reasoning Panel
```css
.reasoning-panel {
  background: var(--gray-50);
  border-left: 4px solid var(--secondary-main);
  padding: var(--space-4);
  border-radius: var(--space-2);
}

.reasoning-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
  font-weight: var(--font-semibold);
  color: var(--gray-700);
}
```

## Animations & Transitions

### Standard Transitions
```css
--transition-fast: 150ms ease;
--transition-base: 200ms ease;
--transition-slow: 300ms ease;
```

### Loading States
```css
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.animate-pulse {
  animation: pulse 2s infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.animate-spin {
  animation: spin 1s linear infinite;
}
```

## Icons & Imagery

### Icon Style
- Use outline icons for actions
- Use solid icons for states
- Maintain consistent 24px base size
- Use currentColor for flexibility

### SVG Patterns
```css
.pattern-hexagon {
  background-image: url("data:image/svg+xml,%3Csvg...");
  opacity: 0.05;
}
```

## Responsive Breakpoints

```css
/* Mobile First Approach */
--screen-sm: 640px;   /* Small devices */
--screen-md: 768px;   /* Tablets */
--screen-lg: 1024px;  /* Desktops */
--screen-xl: 1280px;  /* Large desktops */
--screen-2xl: 1536px; /* Extra large */
```

## Accessibility

### Focus States
```css
:focus-visible {
  outline: 2px solid var(--secondary-main);
  outline-offset: 2px;
}
```

### ARIA Colors
- Ensure 4.5:1 contrast ratio for normal text
- Ensure 3:1 contrast ratio for large text
- Provide focus indicators for keyboard navigation

## React/MUI Theme Configuration

```typescript
import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    primary: {
      main: '#334155',
      light: '#475569',
      dark: '#1e293b',
    },
    secondary: {
      main: '#3b82f6',
      light: '#60a5fa',
      dark: '#2563eb',
    },
    background: {
      default: '#f9fafb',
      paper: '#ffffff',
    },
    text: {
      primary: '#1f2937',
      secondary: '#6b7280',
    },
    success: {
      main: '#10b981',
    },
    warning: {
      main: '#f59e0b',
    },
    error: {
      main: '#ef4444',
    },
  },
  typography: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    h1: {
      fontSize: '2.25rem',
      fontWeight: 700,
    },
    h2: {
      fontSize: '1.875rem',
      fontWeight: 600,
    },
    h3: {
      fontSize: '1.5rem',
      fontWeight: 600,
    },
    body1: {
      fontSize: '1rem',
      lineHeight: 1.5,
    },
    button: {
      textTransform: 'none',
      fontWeight: 600,
    },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: '9999px',
          padding: '12px 24px',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          borderRadius: '12px',
        },
      },
    },
  },
});
```

## Usage Guidelines

1. **Consistency**: Always use the defined color variables and spacing units
2. **Hierarchy**: Use font sizes and weights to establish clear visual hierarchy
3. **Whitespace**: Generous spacing between elements for clarity
4. **Feedback**: Provide visual feedback for all interactive elements
5. **Accessibility**: Ensure all text meets WCAG contrast requirements
6. **Mobile First**: Design for mobile screens first, then enhance for larger screens

## Implementation Notes

- Use CSS variables for easy theme switching
- Implement dark mode using CSS custom properties
- Ensure all interactive elements have hover and focus states
- Use semantic HTML elements for better accessibility
- Test across different screen sizes and browsers