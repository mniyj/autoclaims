# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Commands

### Development
- `npm install` - Install dependencies
- `npm run dev` - Start Vite development server (port defaults to 3000, configurable via `DEV_PORT`)
- `npm run build` - Build for production
- `npm run preview` - Preview production build (port defaults to 4173, configurable via `PREVIEW_PORT`)
- `npm run start` - Start production Express server

### Testing
**No tests configured.** The project does not have test runners set up (no Jest, Vitest).

### Production Deployment with PM2
The application uses PM2 for process management. See [ecosystem.config.cjs](ecosystem.config.cjs):
- Runs two instances on ports 3005 and 3008
- Restart with: `pm2 restart ecosystem.config.cjs`
- Stop with: `pm2 stop ecosystem.config.cjs`
- Start with: `pm2 start ecosystem.config.cjs`

### Environment Variables
Set in [`.env.local`](.env.local):
- `GEMINI_API_KEY` - Required for AI features
- `DEV_PORT` - Development server port (default: 3000)
- `PREVIEW_PORT` - Preview server port (default: 4173)
- `BASE_PATH` - Subpath for deployment (default: `/`)
- `PORT` - Production Express server port (default: 3000)

**Port Configuration Summary:**
- **3000**: Default Vite development server (`npm run dev`, configurable via `DEV_PORT`)
- **4173**: Default Vite preview server (`npm run preview`, configurable via `PREVIEW_PORT`)
- **3005**: Production instance 1 via PM2 ([ecosystem.config.cjs](ecosystem.config.cjs))
- **3008**: Production instance 2 via PM2 ([ecosystem.config.cjs](ecosystem.config.cjs))

**Note:** The `.env.local` file is gitignored and not tracked in version control.

## Multi-System Access

This codebase contains **two separate applications** serving different purposes:

### 1. **后台配置系统** (Insurance Product Configuration System)

**Purpose**: Admin dashboard for insurance product management, configuration, and claims management.

**Start locally**:
```bash
cd "/Users/pegasus/Documents/trae_projects/保险产品配置页面 -理赔"
npm install
npm run dev
```

**Access**: http://localhost:8080 (configured via `DEV_PORT=8080` in `.env.local`)

**Login credentials**:
- **Admin**: `admin` / `234567`
- **Test User 1**: `test` / `123456` (Company: xintai, Tool: 省心配)
- **Test User 2**: `gclife` / `123456` (Company: gclife, Tool: 智能体)

### 2. **智能理赔助手** (SmartClaim AI System)

**Purpose**: AI-powered claims assistant for customers with chat interface and document upload.

**Location**: [smartclaim-ai-agent/](smartclaim-ai-agent/) subdirectory

**Start locally**:
```bash
cd "/Users/pegasus/Documents/trae_projects/保险产品配置页面 -理赔/smartclaim-ai-agent"
npm install
npm run dev
```

**Access**: http://localhost:8081 (configured in `smartclaim-ai-agent/vite.config.ts`)

**Login**: Uses invitation code system
- **Invitation Code**: `ant`
- Then provide name and gender

### Running Both Systems Simultaneously

Both systems can run at the same time since they use different ports:
- **Admin System**: Port 8080 (set via `DEV_PORT` in `.env.local`)
- **AI Assistant**: Port 8081 (hardcoded in `smartclaim-ai-agent/vite.config.ts`)

Open both URLs in different browser tabs to work with both systems concurrently.

### Port Configuration Notes

The development ports can be changed to avoid conflicts:
- **Main system**: Edit `.env.local` and set `DEV_PORT=<desired_port>`
- **SmartClaim AI**: Edit `smartclaim-ai-agent/vite.config.ts` line 9

## Project Architecture

### Tech Stack
- **Frontend**: React 19 with TypeScript ~5.8.2, Vite 6
- **Styling**: Tailwind CSS (inline utility classes, no CSS modules)
- **Production Server**: Express 5 with PM2 process management
- **Build Tool**: Vite with HMR support

### Directory Structure
```
components/          # React components
├── ui/              # Reusable UI primitives (Input, Select, Modal, etc.)
├── product-form/    # Product configuration form components
└── product-preview/ # Product preview components
services/            # Business logic and API services
schemas/             # JSON schemas for product validation
jsonlist/            # Sample product JSON files
smartclaim-ai-agent/ # Standalone AI claims processing module
generali_products/   # Insurance product documentation (PDFs, Excel files)
types.ts            # TypeScript type definitions
constants.ts        # Constants and mock data
utils/              # Utility functions
```

**Note**: Flat project structure - no `src/` folder. All files at root level.

### Key Architectural Patterns

**State Management**: Application uses React's built-in `useState` with state lifted to top-level [App.tsx](App.tsx). No external state management library.

**Navigation & Routing**: Custom view switching system (no react-router):
- Centralized in [App.tsx](App.tsx) using `AppView` type union for all possible views
- State-driven navigation with `useState` for current view tracking
- Explicit view switching via `renderContent()` function
- Collapsible sidebar with grouped navigation items (智能保顾配置, 理赔管理, 系统管理)
- Active state highlighting for parent and child navigation items

**Type System**: Comprehensive TypeScript types defined in [types.ts](types.ts) covering:
- Insurance products (health, accident, critical illness, term life, whole life, annuity)
- Company profiles and management
- Decision tables for strategy management
- Industry data and responsibility items

**Path Aliases**: Use `@/` for imports from project root (configured in [vite.config.ts](vite.config.ts) and [tsconfig.json](tsconfig.json))

**Component Organization**:
- Page components in root directory (e.g., `ProductListPage.tsx`, `CompanyManagementPage.tsx`)
- Reusable UI components in `components/ui/`
- Feature-specific components grouped in subdirectories

**Component Architecture Patterns**:
- **Props Drilling**: State lifted to `App.tsx`, passed down through component props
- **Callback Pattern**: Pages accept `onBack`, `onSave`, `onEdit`, `onAdd` etc. callbacks for parent communication
- **Consistent Props Interface**: Most page components follow pattern:
  ```typescript
  interface PageProps {
    data?: DataType;
    onBack: () => void;
    onSave?: (data: DataType) => void;
    onEdit?: (data: DataType) => void;
  }
  ```
- **Manual Form Validation**: No form validation library - inline error messages with client-side checks
- **Controlled Components**: All form inputs controlled via component state

### TypeScript Configuration Notes

Important compiler flags in [tsconfig.json](tsconfig.json):
- `noEmit: true` - No type checking during build
- `skipLibCheck: true` - Skip library type checking
- `allowImportingTsExtensions: true` - Can import `.ts` files directly
- **Strict mode is NOT enabled** - No strict type checking by default

### Code Style Guidelines

**Import Conventions**:
```typescript
// Type imports use 'type' keyword
import { type InsuranceProduct, ProductStatus } from './types';

// Named imports for components and utilities
import React, { useState, useEffect } from 'react';
import { MOCK_CLAUSES } from '../constants';
```

**Naming Conventions**:
- **Components**: PascalCase (`ProductForm`, `AddClausePage`)
- **Functions/Methods**: camelCase (`handleSave`, `calculatePensionGap`)
- **Constants**: UPPER_SNAKE_CASE (`MOCK_CLAUSES`, `DEV_PORT`)
- **Interfaces/Types**: PascalCase (`InsuranceProduct`, `CompanySolvency`)

**Component Patterns**:
- Functional components with explicit TypeScript interfaces
- `React.FC<ComponentProps>` for component type annotation
- Lazy initialization for expensive computations: `useState(() => initialValue())`
- Default exports for main components

**Styling (Tailwind CSS)**:
- All styling via inline Tailwind classes
- No separate CSS files or CSS modules
- Common patterns:
  - `bg-white p-6 rounded-lg shadow-sm border border-gray-200` (cards)
  - `text-sm font-medium text-gray-700` (typography)
  - `flex items-center space-x-4` (layout)

**Comments**:
- Chinese comments for business logic and user-facing text
- English comments for technical implementation details

### Product Configuration System

The application manages insurance products with a hierarchical classification system:
- **3-Level Categories**: Primary, secondary, and detailed classifications
- **Regulatory vs Marketing Names**: Separate fields for official regulatory names vs customer-facing names
- **Type-Specific Schemas**: Each insurance type has its own JSON schema in [schemas/](schemas/)

**Product Status Lifecycle**: Draft → Active → Inactive

**Main Page Components**:
- `ProductListPage` - Product listing with filtering and pagination
- `ProductConfigPage` - Individual product configuration
- `AddProductPage` - Create new products
- `ClauseManagementPage` - Manage insurance clauses
- `CompanyManagementPage` - Manage insurance companies
- `StrategyManagementPage` - Configure product recommendation rules
- `InsuranceTypeManagementPage` - Manage insurance type classifications
- `ResponsibilityManagementPage` - Manage coverage responsibilities

### Claims Management System

The application includes a comprehensive claims management module (理赔管理):
- **ClaimsMaterialManagementPage** - Manage claims materials and required documents
- **ClaimItemConfigPage** - Configure claim items and validation rules
- **ClaimCaseListPage** - List and manage claim cases with filtering
- **ClaimCaseDetailPage** - View detailed claim case information and status

These components handle the complete claims workflow from material submission to case resolution.

### Mock Data Pattern

The application uses comprehensive mock data for development (no backend required):
- Mock services in [services/](services/) simulate API calls with delays
- Search functionality is implemented client-side
- All data structures match the TypeScript types in [types.ts](types.ts)

### File Upload Architecture

Different upload scenarios use specialized components:
- `MultiImageUpload` - Image galleries
- `FileUpload` - Single file uploads (documents, rate tables)
- `ExcelImportModal` - Excel data import with column mapping

### Production Server

The [server.js](server.js) file:
- Serves static files from `dist/`
- Supports SPA routing with HTML5 history mode
- Configurable base path via `BASE_PATH` environment variable
- Used by PM2 for multi-instance deployment

### Deployment

The project includes an automated deployment script [deploy.sh](deploy.sh) for deploying to production servers.

**Usage:**
```bash
./deploy.sh <SERVER_IP> [SERVER_USER] [SSH_KEY_PATH] [PORT]
```

**Example:**
```bash
./deploy.sh 121.43.159.216 root ~/.ssh/aliyun.pem 3008
```

**Deployment Workflow:**
1. Local build (`npm run build`)
2. Package files (`dist/`, `server.js`, `package.json`, `ecosystem.config.cjs`)
3. Upload to remote server via SSH
4. Remote installation and PM2 process management
5. Firewall configuration (opens specified port)
6. Service restart and verification

**Port-Specific Deployment:**
- Default deploys to port 3005 (instance: `insurance-config-page`)
- Specify `3008` to deploy to second instance (instance: `insurance-config-page-3008`)
- Both instances defined in [ecosystem.config.cjs](ecosystem.config.cjs)

### Special Assets

When adding new pages or modifying [index.html](index.html):
- **Favicon**: Always use `https://gw.alipayobjects.com/zos/bmw-prod/d7490aea-bbd4-4031-97c4-497ee4d19be3.ico`
- **Logo**: Use `https://mdn.alipayobjects.com/huamei_wbchdc/afts/img/A*2yRxQIapKMwAAAAAAAAAAAAADkOZAQ/original`
- **Icons**: Inline SVG components, no external icon libraries
- **Images**: Use CDN URLs from imgdb.cn for product images

### Type Safety Guidelines

**Important**:
- **DO NOT** use `as any` or `@ts-ignore` unless absolutely necessary
- Use type assertions sparingly and only when you're certain of the type
- Prefer type guards over assertions
- Note: Strict mode is NOT enabled in tsconfig.json

### API Integration

Currently using mock data from `constants.ts`:
- Services use async/await with simulated delays
- Search functionality is implemented client-side
- All data structures match the TypeScript types in [types.ts](types.ts)
- Consider replacing mocks with real API calls when backend is ready

### AI Agent Module

The [smartclaim-ai-agent/](smartclaim-ai-agent/) directory contains a standalone AI-powered claims processing module:
- Separate React application with its own `App.tsx` and `index.tsx`
- Focuses on intelligent claims processing and automation
- May use different AI models or services than the main application
- Can be developed and deployed independently

### Product Assets

The [generali_products/](generali_products/) directory contains insurance product documentation assets:
- **条款** (Clauses) - PDF files with policy terms and conditions
- **产品说明书** (Product Brochures) - PDF files with product descriptions
- **费率表** (Rate Tables) - PDF files with premium rates
- **现金价值表** (Cash Value Tables) - Excel files with cash value calculations

These documents serve as reference materials or for data extraction purposes.

### Code Quality Notes

- No linting configured (no ESLint, no Prettier)
- Follow existing patterns when adding new code
- The project uses Chinese for business logic and user-facing text, English for technical comments
