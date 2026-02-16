# PROJECT KNOWLEDGE BASE

**Generated:** 2026-02-16
**Project:** Insurance Product Configuration & Claims Management System (保险产品配置页面)

## OVERVIEW

React 19 + TypeScript SPA for insurance product configuration and AI-powered claims processing. Two systems:
1. **Admin System** (port 8080): Product/Company/Claims management
2. **SmartClaim AI** (port 8081): AI claims assistant

## STRUCTURE
```
/
├── components/              # 36 React components
│   ├── ui/                 # 10 reusable UI primitives
│   ├── product-form/       # 11 product form editors
│   ├── product-preview/    # 6 preview components
│   └── ruleset/            # 11 ruleset engine components
├── services/               # 6 business services (API, OCR, catalog)
├── schemas/                # 7 JSON product schemas
├── utils/                  # 1 utility (calculations.ts)
├── src/services/           # API layer
├── types.ts                # All TypeScript types (25974 bytes)
├── constants.ts            # Mock data (247KB)
├── App.tsx                # Main routing/state (24963 bytes)
├── server.js              # Express production server
├── smartclaim-ai-agent/   # Standalone AI claims module
└── generalgi_products/   # PDF/Excel assets
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Add product | `AddProductPage.tsx` | New product form |
| Edit company | `EditCompanyPage.tsx` | Company profile editor |
| Claims workflow | `ClaimCaseListPage.tsx`, `ClaimCaseDetailPage.tsx` | Claims list + detail |
| Invoice OCR | `invoiceOcrService.ts` | AI invoice recognition |
| Product schema | `schemas/` | JSON validation schemas |
| Type definitions | `types.ts` | All insurance types |

## CONVENTIONS

- **Chinese**: Business logic, UI labels, user-facing text
- **English**: Technical comments, function names
- **Styling**: Tailwind inline classes only (no CSS modules)
- **State**: React useState, lifted to App.tsx
- **Routing**: Custom view switching (no react-router)
- **Path alias**: `@/*` maps to root

## ANTI-PATTERNS (THIS PROJECT)

- **NEVER** use `as any` or `@ts-ignore` (strict mode OFF but avoid)
- **NO** ESLint/Prettier configured
- **NO** test runners (no Jest/Vitest)
- **NO** separate CSS files (inline Tailwind only)

## COMMANDS
```bash
npm run dev              # Admin: port 8080
npm run build            # Production build
npm run preview          # Preview: port 4173
npm start                # Express: port 3000
cd smartclaim-ai-agent && npm run dev  # AI: port 8081
```

## PORTS
- 8080: Admin system (DEV_PORT)
- 8081: SmartClaim AI (hardcoded in vite.config.ts)
- 3005/3008: PM2 production instances
- 4173: Preview server

## NOTES
- Mock data in `constants.ts` (247KB)
- AI features require `GEMINI_API_KEY` in `.env.local`
- Production deploy: `./deploy.sh <IP> <USER> <KEY> <PORT>`
- Flat structure (no src/ folder at root)
