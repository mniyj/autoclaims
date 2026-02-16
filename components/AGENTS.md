# COMPONENTS DIRECTORY

**Score:** 136 (high complexity - 36 files, 4 subdirectories)

## OVERVIEW

React component library with 36 top-level files organized into 4 functional subdirectories.

## STRUCTURE

```
components/
├── ui/                    # 10 reusable UI primitives
├── product-form/          # 11 product form editors  
├── product-preview/       # 6 preview components
├── ruleset/              # 11 ruleset engine components
└── *.tsx                 # 29 page-level components
```

## SUBMODULES

| Module | Files | Purpose |
|--------|-------|---------|
| `ui/` | 10 | Reusable: Modal, Input, Select, Pagination, FileUpload, etc. |
| `product-form/` | 11 | Product configuration editors (GeneralInfoForm, CoverageDetailEditor, etc.) |
| `product-preview/` | 6 | Product display (ProductCard, ProductDetail, etc.) |
| `ruleset/` | 11 | Ruleset engine (ConditionTreeBuilder, ActionParamsEditor, etc.) |

## PAGE COMPONENTS (root)

Key pages:
- `ProductListPage.tsx`, `AddProductPage.tsx`, `ProductConfigPage.tsx`
- `CompanyManagementPage.tsx`, `AddCompanyPage.tsx`, `EditCompanyPage.tsx`
- `ClaimCaseListPage.tsx`, `ClaimCaseDetailPage.tsx`
- `ClaimsMaterialManagementPage.tsx`, `ClaimItemConfigPage.tsx`

## CONVENTIONS

- All components use inline Tailwind classes
- Props follow pattern: `{ data, onBack, onSave, onEdit }`
- Default exports for main components
- Chinese labels for UI, English for technical comments
