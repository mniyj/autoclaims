# AGENTS.md - Insurance Product Configuration System

**Last Updated:** 2026-02-19

This file provides essential context for AI coding agents working on this project. Read this first before making any changes.

---

## 1. PROJECT OVERVIEW

This is a **React 19 + TypeScript** Single Page Application (SPA) for insurance product configuration and AI-powered claims processing. The system manages insurance products, clauses, companies, claims, and provides intelligent claims assistance.

### Two Applications in One Repository

| Application | Purpose | Port | Entry Point |
|-------------|---------|------|-------------|
| **Admin System** (保险产品配置页面) | Product/Company/Claims management | 8080 (`DEV_PORT`) | Root directory |
| **SmartClaim AI** (智能理赔助手) | AI claims assistant with chat | 8081 (hardcoded) | `smartclaim-ai-agent/` subdirectory |

---

## 2. TECHNOLOGY STACK

### Core Technologies
- **Frontend Framework:** React 19.1.1
- **Language:** TypeScript 5.8.2 (target: ES2022)
- **Build Tool:** Vite 6.2
- **Styling:** Tailwind CSS (loaded via CDN in index.html)
- **Runtime:** Node.js 20+
- **Server:** Express.js 5.2

### Key Dependencies
- `@google/genai` - Gemini AI integration
- `@langchain/core`, `@langchain/google-genai`, `@langchain/langgraph` - LangChain for AI agent
- `ali-oss` - Alibaba Cloud OSS for file storage
- `express-rate-limit` - API rate limiting

### AI/OCR Services
- **Gemini API** - Primary AI provider (text + vision)
- **GLM OCR** - Alternative OCR service
- **PaddleOCR** - Local OCR option (`server/paddle_ocr_server.py`)

---

## 3. PROJECT STRUCTURE

```
/
├── components/                    # 76 React components
│   ├── ui/                       # 10 reusable UI primitives (Button, Input, Modal, Select, etc.)
│   ├── product-form/             # 11 product form editors (Health, Accident, TermLife, etc.)
│   ├── product-preview/          # 6 preview components
│   └── ruleset/                  # 11 ruleset engine components
├── services/                     # 6 business services
│   ├── api.ts                    # Generic CRUD API client
│   ├── invoiceOcrService.ts      # AI invoice recognition
│   ├── invoiceAuditService.ts    # Invoice audit logic
│   ├── ossService.ts             # OSS upload/download
│   ├── clauseService.ts          # Clause search/matching
│   └── catalogMatchService.ts    # Medical catalog matching
├── server/                       # 24 JS files - Express backend
│   ├── apiHandler.js             # Main API request handler
│   ├── ai/                       # AI agent implementation (LangGraph)
│   ├── services/                 # Business logic services
│   ├── rules/                    # Rules engine (condition evaluator, action executor)
│   └── middleware/               # Express middleware
├── schemas/                      # 7 JSON product validation schemas
├── jsonlist/                     # JSON file-based data persistence
├── utils/                        # Utilities (calculations.ts)
├── types.ts                      # All TypeScript types (~1,500 lines)
├── constants.ts                  # Mock data (~4,200 lines)
├── App.tsx                       # Main app with routing/state (~1,000 lines)
├── server.js                     # Express production server entry
├── deploy.sh                     # Automated deployment script
├── ecosystem.config.cjs          # PM2 process configuration
├── Dockerfile                    # Container build config
└── smartclaim-ai-agent/          # Standalone AI claims module
    ├── App.tsx                   # Main AI assistant UI
    ├── geminiService.ts          # Gemini AI integration
    ├── ossService.ts             # File upload service
    └── ... (self-contained)
```

### File Size Reference
- `constants.ts`: ~4,200 lines (mock data)
- `types.ts`: ~1,500 lines (type definitions)
- `App.tsx`: ~1,000 lines (main routing)

---

## 4. BUILD & DEVELOPMENT COMMANDS

### Main Application (Admin System)
```bash
# Install dependencies
npm install

# Development server (reads DEV_PORT from .env.local, default 3000)
npm run dev

# Production build
npm run build

# Preview production build (reads PREVIEW_PORT from .env.local)
npm run preview

# Start Express production server (reads PORT from env, default 3000)
npm start
```

### SmartClaim AI (Subdirectory)
```bash
cd smartclaim-ai-agent
npm install
npm run dev    # Port 8081 (hardcoded)
```

### Deployment
```bash
# Deploy to production server (uses PM2)
./deploy.sh <SERVER_IP> [SERVER_USER] [SSH_KEY_PATH] [PORT]

# Examples:
./deploy.sh 121.43.159.216                    # Default: root, port 3005
./deploy.sh 121.43.159.216 root ~/.ssh/key.pem 3008

# PM2 management
pm2 start ecosystem.config.cjs
pm2 restart ecosystem.config.cjs
pm2 stop ecosystem.config.cjs
```

---

## 5. PORT CONFIGURATION

| Port | Purpose | Configuration |
|------|---------|---------------|
| 8080 | Admin dev server | `DEV_PORT` in `.env.local` |
| 8081 | SmartClaim AI dev | Hardcoded in `smartclaim-ai-agent/vite.config.ts` |
| 4173 | Preview server | `PREVIEW_PORT` in `.env.local` |
| 3005 | Production instance 1 | `ecosystem.config.cjs` |
| 3008 | Production instance 2 | `ecosystem.config.cjs` |
| 3000 | Express default | `PORT` env var |

---

## 6. ENVIRONMENT VARIABLES

Create `.env.local` in project root:

```bash
# Required for AI features
GEMINI_API_KEY=your_gemini_api_key

# Development ports
DEV_PORT=8080
PREVIEW_PORT=4173

# Alibaba Cloud OSS (for file storage)
ALIYUN_OSS_REGION=oss-cn-beijing
ALIYUN_OSS_ACCESS_KEY_ID=your_key
ALIYUN_OSS_ACCESS_KEY_SECRET=your_secret
ALIYUN_OSS_BUCKET=your_bucket

# GLM OCR API Key (alternative OCR)
GLM_OCR_API_KEY=your_key

# Production deployment
BASE_PATH=/              # Subpath for deployment (default: /)
PORT=3000                # Express server port
```

**Note:** `.env.local` is gitignored and never committed.

---

## 7. CODE CONVENTIONS

### Language Usage
- **Chinese:** Business logic, UI labels, user-facing text, data enums
- **English:** Technical comments, function names, variable names (internal)

Example:
```typescript
// Fetch product list from API
const fetchProducts = async () => {
  const products = await api.products.list();
  return products; // 产品列表
};

// Component with Chinese labels
const StatusBadge = () => (
  <span className="badge">生效</span> // "Active" in Chinese
);
```

### Styling
- **Tailwind CSS only** - inline classes (no CSS modules)
- **No separate CSS files** for components
- Custom brand colors defined in `index.html` tailwind config
- Common pattern: `bg-white rounded-lg shadow-sm border border-gray-200`

### State Management
- **React useState** - local component state
- **Lifted state** - managed in App.tsx for global sharing
- **No Redux/Zustand** - prop drilling for simple cases

### Routing
- **Custom view switching** - no react-router
- State-based routing in App.tsx:
```typescript
const [currentView, setCurrentView] = useState('product-list');
// Render different components based on currentView
```

### Path Aliases
- `@/*` maps to project root
- Example: `import { api } from '@/services/api'`

---

## 8. API ARCHITECTURE

### RESTful API Pattern
All data operations go through `/api/*` endpoints handled by `server/apiHandler.js`.

```typescript
// services/api.ts provides CRUD helpers
export const api = {
  products: buildResource("products"),
  clauses: buildResource("clauses"),
  claimCases: buildResource("claim-cases"),
  // ... more resources
};

// Usage
const products = await api.products.list();
await api.products.add(newProduct);
await api.products.update(id, updates);
await api.products.delete(id);
```

### Data Persistence
- **JSON file storage** in `jsonlist/` directory
- Each resource = one JSON file (e.g., `products.json`)
- No database - file-based persistence via `readData()` / `writeData()`

### Key API Resources
| Resource | File | Description |
|----------|------|-------------|
| products | `jsonlist/products.json` | Insurance products |
| clauses | `jsonlist/clauses.json` | Insurance clauses |
| claim-cases | `jsonlist/claim-cases.json` | Claims cases |
| companies | `jsonlist/companies.json` | Insurance companies |
| rulesets | `jsonlist/rulesets.json` | Business rules |
| users | `jsonlist/users.json` | System users |

---

## 9. KEY MODULES GUIDE

### Where to Look for Tasks

| Task | Location | Notes |
|------|----------|-------|
| Add/Edit Product | `AddProductPage.tsx`, `ProductConfigPage.tsx` | Product form wizard |
| Product forms by type | `components/product-form/` | Health, Accident, TermLife, etc. |
| Edit Company | `EditCompanyPage.tsx` | Company profile editor |
| Claims workflow | `ClaimCaseListPage.tsx`, `ClaimCaseDetailPage.tsx` | Claims list + detail views |
| Invoice OCR | `services/invoiceOcrService.ts` | AI invoice recognition |
| Rules engine | `server/rules/engine.js` | Condition evaluation, action execution |
| AI agent | `server/ai/agent.js` | LangGraph-based claims assistant |
| Product schema | `schemas/*.json` | JSON validation schemas |
| Type definitions | `types.ts` | All insurance-related types |
| Mock data | `constants.ts` | Sample data for development |

---

## 10. TESTING STRATEGY

**No automated tests configured.**

- No Jest, Vitest, or other test runners
- No test files in the project
- Testing is manual via browser

When making changes:
1. Run `npm run dev` to test locally
2. Verify functionality in browser
3. Check for TypeScript errors

---

## 11. ANTI-PATTERNS (AVOID THESE)

### Strictly Avoid
- **`as any`** or **`@ts-ignore`** - TypeScript strict mode is OFF but avoid type escapes
- **Separate CSS files** - Use Tailwind inline classes only
- **React Router** - Use custom view switching in App.tsx
- **Type casting without guards** - Use proper type narrowing

### Current Project Characteristics
- **NO ESLint/Prettier configured** - Manual code formatting
- **NO test runners** - No Jest/Vitest (see Section 10)
- **NO separate CSS modules** - Tailwind inline only
- **Flat structure** - No `src/` folder at root level

---

## 12. LOGIN CREDENTIALS (Development)

### Admin System
| Username | Password | Role |
|----------|----------|------|
| admin | 234567 | Administrator |
| test | 123456 | Test user (Company: xintai) |
| gclife | 123456 | Test user (Company: gclife) |

### SmartClaim AI
- **Invitation Code:** `ant`
- Then provide name and gender

---

## 13. DEPLOYMENT DETAILS

### Production Setup
- **Host:** Alibaba Cloud ECS
- **Process Manager:** PM2 (`ecosystem.config.cjs`)
- **Web Server:** Express.js (static + API)
- **File Storage:** Alibaba Cloud OSS

### Deployment Flow
1. Local build: `npm run build`
2. Package: `deploy.tar.gz` (dist/, server.js, server/, jsonlist/, package.json)
3. Upload via SCP to remote server
4. Extract and install dependencies on server
5. PM2 restart with zero downtime
6. Firewall configuration (firewalld)

### Docker Support
```bash
# Build Docker image
docker build -t insurance-config .

# Run container
docker run -p 3000:3000 -e GEMINI_API_KEY=xxx insurance-config
```

---

## 14. AI FEATURES

### Invoice OCR
- **Location:** `services/invoiceOcrService.ts`
- **Models:** Gemini 2.5 Flash, GLM OCR, PaddleOCR
- **Input:** Image file (Blob, base64, or OSS URL)
- **Output:** Structured `MedicalInvoiceData`

### Claims AI Agent
- **Location:** `server/ai/agent.js`
- **Framework:** LangGraph with checkpointer
- **Tools:** 
  - `checkEligibilityTool` - Verify claim eligibility
  - `calculateAmountTool` - Calculate claim amounts
  - `queryHospitalInfoTool` - Hospital database lookup
  - `queryMedicalCatalogTool` - Medical item catalog

### SmartClaim AI (Standalone)
- **Location:** `smartclaim-ai-agent/`
- **Features:** Chat interface, document upload, claims guidance
- **AI:** Gemini for text generation and analysis

---

## 15. FILE NAMING CONVENTIONS

- **Components:** PascalCase (e.g., `ProductListPage.tsx`)
- **Services:** camelCase (e.g., `api.ts`, `invoiceOcrService.ts`)
- **Utils:** camelCase (e.g., `calculations.ts`)
- **Server files:** camelCase (e.g., `apiHandler.js`, `engine.js`)
- **Constants:** UPPER_SNAKE_CASE for exports (e.g., `MOCK_CLAUSES`)

---

## 16. SUMMARY FOR QUICK REFERENCE

```
PROJECT: Insurance Product Configuration & Claims System
TECH: React 19 + TypeScript 5.8 + Vite 6 + Tailwind + Express
STRUCTURE: 76 components, 24 server files, flat structure
DATA: JSON file persistence (jsonlist/)
AI: Gemini API, LangGraph agent, Invoice OCR
DEPLOY: deploy.sh + PM2 + Aliyun ECS
PORTS: 8080 (dev), 3005/3008 (prod), 8081 (AI assistant)
```

When in doubt, check:
1. `types.ts` for data structures
2. `constants.ts` for sample data
3. `App.tsx` for routing logic
4. `services/api.ts` for API patterns
5. `server/apiHandler.js` for backend logic
