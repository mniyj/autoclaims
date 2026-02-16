# SERVICES

**Score:** 37 (6 files, complex business logic)

## OVERVIEW

Business logic services for API calls, OCR, catalog matching, and file storage.

## FILES

```
services/
├── api.ts                    # Core API client
├── catalogMatchService.ts    # Product catalog matching (24KB)
├── clauseService.ts         # Clause management
├── invoiceAuditService.ts   # Invoice audit workflow (51KB)
├── invoiceOcrService.ts    # AI invoice OCR (17KB)
└── ossService.ts            # OSS file storage
```

## WHERE TO LOOK

| Task | File |
|------|------|
| API calls | `api.ts` |
| Invoice OCR | `invoiceOcrService.ts` |
| Invoice audit | `invoiceAuditService.ts` |
| Catalog matching | `catalogMatchService.ts` |

## CONVENTIONS

- Async/await with simulated delays (mock data)
- All services use mock data initially
- OCR requires `GEMINI_API_KEY`
