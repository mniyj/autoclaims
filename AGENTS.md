# AGENTS.md - Insurance Product Configuration System

## Build & Run Commands

```bash
# Development
npm run dev              # Start Vite dev server (default port 3000, configurable via DEV_PORT env var)

# Production
npm run build            # Build production bundle to ./dist
npm start                # Start Express server (serves from ./dist, default port 3000)
npm run preview          # Preview production build (default port 4173, configurable via PREVIEW_PORT)
```

### Environment Variables
- `GEMINI_API_KEY` - Required for AI features
- `DEV_PORT` - Dev server port (default: 3000)
- `PREVIEW_PORT` - Preview server port (default: 4173)
- `BASE_PATH` - Subpath for deployment (default: '/')
- `PORT` - Production Express server port (default: 3000)

### Testing
**No tests configured.** No test runners (Jest, Vitest) are set up.

---

## Code Style Guidelines

### Language & Tools
- **Language**: TypeScript (~5.8.2, strict mode NOT enabled)
- **Framework**: React 19
- **Build Tool**: Vite 6
- **Styling**: Tailwind CSS (via CDN, inline classes only, no CSS modules)
- **Server**: Express 5 for production static file serving
- **Path Alias**: `@/*` maps to project root

### Import Conventions
```typescript
// Type imports use 'type' keyword
import { type InsuranceProduct, ProductStatus } from './types';

// Named imports for components and utilities
import React, { useState, useEffect } from 'react';
import { MOCK_CLAUSES } from '../constants';

// Default exports for main components
export default ProductForm;
```

### Component Patterns
```typescript
// Functional components with explicit TypeScript interfaces
interface ComponentProps {
  product: InsuranceProduct;
  onFormChange: (field: keyof InsuranceProduct, value: any) => void;
}

const MyComponent: React.FC<ComponentProps> = ({ product, onFormChange }) => {
  // State initialization with lazy evaluation
  const [state, setState] = useState<Type>(() => initialValue);

  return <div>...</div>;
};

export default MyComponent;
```

### Type Definitions
- All types centralized in `types.ts`
- Use `interface` for object shapes with potential extension
- Use `type` for unions, intersections, and computed types
- Enums for fixed sets of related values
```typescript
export enum ProductStatus {
  DRAFT = '草稿',
  ACTIVE = '生效',
  INACTIVE = '失效',
}

export interface BaseProduct {
  productCode: string;
  regulatoryName: string;
}

export type InsuranceProduct = HealthProduct | LifeProduct | AnnuityProduct;
```

### Naming Conventions
- **Components**: PascalCase (`ProductForm`, `AddClausePage`)
- **Functions/Methods**: camelCase (`handleSave`, `calculatePensionGap`)
- **Constants**: UPPER_SNAKE_CASE (`MOCK_CLAUSES`, `DEV_PORT`)
- **Interfaces/Types**: PascalCase (`InsuranceProduct`, `CompanySolvency`)
- **Props**: camelCase matching interface properties

### State Management
- Use React hooks (`useState`, `useEffect`)
- Lazy initialization for expensive computations: `useState(() => heavyComputation())`
- Lift state to the lowest common ancestor
- Use effect dependencies explicitly

### File Organization
```
/                           # Root (flat structure, no src/ folder)
├── components/              # React components
│   ├── ui/                # Reusable UI components (Modal, Input, Select, etc.)
│   ├── product-form/      # Product configuration forms
│   └── product-preview/   # Preview components
├── services/               # API/data services (async/await with simulated delays)
├── utils/                  # Utility functions
├── schemas/                # JSON schemas for validation
├── types.ts               # All TypeScript type definitions
├── constants.ts           # Mock data and constants
└── App.tsx                # Main app component with routing
```

### Styling (Tailwind CSS)
- All styling via inline Tailwind classes (CDN in index.html)
- Custom color palette: `brand-blue-50` through `brand-blue-950`
- No separate CSS files or CSS modules
- Common patterns:
  - `bg-white p-6 rounded-lg shadow-sm border border-gray-200` (cards)
  - `text-sm font-medium text-gray-700` (typography)
  - `flex items-center space-x-4` (layout)
  - `hover:bg-gray-50 focus:outline-none` (interactive states)

### Error Handling
- No explicit error handling patterns found
- Consider adding try/catch for async operations
- Consider adding error boundaries for React components

### Type Safety
- **DO NOT** use `as any` or `@ts-ignore` unless absolutely necessary
- Use type assertions sparingly and only when you're certain of the type
- Prefer type guards over assertions
- Note: Strict mode is NOT enabled in tsconfig.json

### Comments
- Chinese comments for business logic and user-facing text
- English comments for technical implementation details
- JSDoc-style comments for complex functions

### Special Rules
- **Favicon**: Always use `https://gw.alipayobjects.com/zos/bmw-prod/d7490aea-bbd4-4031-97c4-497ee4d19be3.ico` in `index.html`
- **Logo**: Use `https://mdn.alipayobjects.com/huamei_wbchdc/afts/img/A*2yRxQIapKMwAAAAAAAAAAAAADkOZAQ/original`
- **Icons**: Inline SVG components, no external icon libraries
- **Images**: Use CDN URLs from imgdb.cn for product images

### API Integration
- Currently using mock data from `constants.ts`
- Services use async/await with simulated delays
- Consider replacing mocks with real API calls when backend is ready

### Code Quality
- No linting configured (no ESLint, no Prettier)
- Consider adding these for better code consistency
- Follow existing patterns when adding new code
