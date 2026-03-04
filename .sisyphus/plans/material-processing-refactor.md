# 理赔材料处理统一化重构计划

## TL;DR

> **目标**: 将分散的材料分类/提取方案统一为配置化、可扩展的架构
> 
> **核心改进**:
> - 消除硬编码（`INVOICE_MATERIAL_IDS`）
> - 统一处理流程（分类→提取→校验）
> - 智能分类（AI识别+配置匹配）
> - 策略模式（Invoice/Structured/General/Image策略）
> - 完整审核结论（状态+清单+问题+建议）
> 
> **交付物**:
> - `services/material/` 统一服务层
> - 增强 `ClaimsMaterial` 类型定义
> - 智能 `MaterialClassifier` 分类器
> - 可复用的提取/校验组件
> 
> **Estimated Effort**: Large (4 phases, 20+ tasks)
> **Parallel Execution**: YES - 4 waves
> **Critical Path**: Type Enhancement → Strategy Base → All Strategies → Service Integration → UI Components

---

## Context

### Original Request
用户要求统一系统对材料分类、提取的方案。现有处理手段分散：
- InvoiceAuditPage 硬编码发票材料ID判断
- 分类仅基于关键词匹配（不准确）
- 发票8步流程与通用材料3步流程代码重复
- 缺乏统一的审核结论结构

### Interview Summary
**Key Discussions**:
- 索赔人提交时只需分类，不提取
- 理赔员可点击"格式化提取"按钮进行字段提取
- 理赔员批量导入时需要分类+提取
- **独立设计**：不依赖现有 InvoiceAuditPage 代码

**Research Findings**:
- 系统已有47种材料类型定义（claims-materials.json）
- 每种材料配有 jsonSchema 和 aiAuditPrompt
- MaterialCategory 已在 types/material-review.ts 定义（5分类）
- 现有 OCR 服务 (invoiceOcrService.ts) 可参考但非复用

### Metis Review
**Identified Gaps** (addressed in plan):
- Migration strategy for existing data (backward compatibility)
- Performance considerations for AI classification
- Error handling and fallback mechanisms
- Testing strategy for 47 material types

---

## Work Objectives

### Core Objective
构建统一的材料处理服务层，实现分类、提取、校验的标准化流程，消除硬编码，提升可维护性和扩展性。

### Concrete Deliverables
- Enhanced `ClaimsMaterial` interface with `category`, `processingStrategy`, `extractionConfig`
- `services/material/` directory with classifier, extractor, validator
- 4 processing strategies (Invoice, StructuredDoc, GeneralDoc, ImageOnly) - **独立设计，不依赖 InvoiceAuditPage**
- Smart `MaterialClassifier` with AI + config matching
- Complete `MaterialAuditConclusion` structure
- New MaterialProcessingPage component (独立页面，非重构 InvoiceAuditPage)

### Definition of Done
- [ ] All 47 material types have category and processingStrategy assigned
- [ ] InvoiceAuditPage uses new strategy pattern (no hard-coded IDs)
- [ ] Classification confidence ≥ 0.85 auto-confirms, < 0.85 shows alternatives
- [ ] All extraction flows go through UnifiedMaterialService
- [ ] Existing tests (if any) still pass
- [ ] New code has TypeScript strict mode compliance

### Must Have
- [ ] Backward compatibility with existing claims-materials.json
- [ ] Reuse existing invoiceOcrService and invoiceAuditService logic
- [ ] Support all 4 processing strategies
- [ ] Confidence threshold configuration (default 0.85)

### Must NOT Have (Guardrails)
- [ ] No changes to existing API endpoints (add new ones)
- [ ] No breaking changes to database schema (add nullable columns only)
- [ ] No removal of existing InvoiceAuditPage (gradual migration)
- [ ] No AI model training (use existing Gemini integration)

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: NO (no Jest/Vitest configured in project)
- **Automated tests**: NO (project has no test framework)
- **Verification method**: Agent-Executed QA Scenarios (Playwright for UI, manual verification for services)

### QA Policy
Every task MUST include agent-executed QA scenarios:
- **Frontend/UI**: Use Playwright - Navigate, interact, assert DOM, screenshot
- **Services**: Use Bash (bun/node REPL) - Import, call functions, compare output
- **Integration**: Test full flow with real file uploads

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Foundation - Start Immediately):
├── Task 1: Create services/material/ directory structure
├── Task 2: Define enhanced ClaimsMaterial types
├── Task 3: Create base Strategy interface and factory
├── Task 4: Create MaterialClassification types
└── Task 5: Create MaterialAuditConclusion types

Wave 2 (Core Strategies - MAX PARALLEL):
├── Task 6: Implement StructuredDocStrategy (3-step flow)
├── Task 7: Implement GeneralDocStrategy (AI-based)
├── Task 8: Implement ImageOnlyStrategy (basic OCR)
├── Task 9: Implement InvoiceStrategy (8-step flow, migrate from InvoiceAuditPage)
├── Task 10: Create MaterialExtractor service
└── Task 11: Create MaterialValidator service

Wave 3 (Classification & Integration):
├── Task 12: Implement MaterialClassifier with AI matching
├── Task 13: Create UnifiedMaterialService facade
├── Task 14: Update ClaimsMaterial mock data with new fields
├── Task 15: Create classification API endpoint
├── Task 16: Create extraction API endpoint
└── Task 17: Create batch processing API endpoint

Wave 4 (UI Integration):
├── Task 18: Create MaterialUpload component
├── Task 19: Create ClassificationModal component
├── Task 20: Create ExtractResultViewer component
├── Task 21: Create MaterialProcessingPage (独立页面)
└── Task 22: Create migration script for existing data

Wave FINAL (Verification):
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Code quality review
├── Task F3: Integration testing
└── Task F4: Scope fidelity check

Critical Path: Task 2 → Task 3 → Tasks 6-11 → Task 13 → Tasks 18-21 → F1-F4
Parallel Speedup: ~60% faster than sequential
Max Concurrent: 6 (Wave 2)
```

### Dependency Matrix

- **1-5**: — — 6-11
- **6-11**: 3 — 12-17
- **12-17**: 11 — 18-22
- **18-22**: 13, 17 — F1-F4

### Agent Dispatch Summary

- **1**: **5** - All quick tasks → `quick` agent
- **2**: **6** - Strategies → `deep` agent for complex logic
- **3**: **6** - Classification & Integration → `deep` + `unspecified-high`
- **4**: **5** - UI components → `visual-engineering`
- **FINAL**: **4** - Review tasks → `oracle`, `unspecified-high`, `deep`

---

## TODOs

- [ ] 1. Create services/material/ directory structure

  **What to do**:
  - Create `services/material/` directory
  - Create `services/material/strategies/` subdirectory
  - Create `index.ts`, `materialClassifier.ts`, `materialExtractor.ts`, `materialValidator.ts` files with basic exports
  - Add placeholder classes/interfaces

  **Must NOT do**:
  - Don't implement actual logic yet
  - Don't modify existing files

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Reason**: Simple file creation and scaffolding

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: Tasks 2-5
  - **Blocked By**: None

  **References**:
  - Pattern: `services/invoiceOcrService.ts` - Service file structure
  - Pattern: `services/invoiceAuditService.ts` - Export patterns

  **Acceptance Criteria**:
  - [ ] Directory structure exists
  - [ ] All files have basic TypeScript exports
  - [ ] No TypeScript errors

  **QA Scenarios**:
  ```
  Scenario: Verify directory structure
    Tool: Bash
    Steps:
      1. ls -la services/material/
      2. ls -la services/material/strategies/
    Expected: All directories and files exist
  ```

  **Commit**: YES
  - Message: `chore(material): create service directory structure`
  - Files: `services/material/**`

- [ ] 2. Define enhanced ClaimsMaterial types

  **What to do**:
  - Add `category: MaterialCategory` field to ClaimsMaterial
  - Add `processingStrategy: ProcessingStrategy` field
  - Add `extractionConfig: ExtractionConfig` field
  - Define ProcessingStrategy union type
  - Define ExtractionConfig interface with jsonSchema, aiAuditPrompt, validationRules
  - Update types.ts with new definitions

  **Must NOT do**:
  - Don't remove existing fields (backward compatibility)
  - Don't make new fields required initially

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Reason**: Type definitions only, no logic

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 1)
  - **Parallel Group**: Wave 1
  - **Blocks**: Tasks 3-5
  - **Blocked By**: None

  **References**:
  - Reference: `types.ts:435-444` - Current ClaimsMaterial
  - Reference: `types/material-review.ts:15-21` - MaterialCategory enum
  - Pattern: Use existing type conventions

  **Acceptance Criteria**:
  - [ ] Types compile without errors
  - [ ] Existing code still compiles (backward compatible)
  - [ ] New fields are optional (?)

  **QA Scenarios**:
  ```
  Scenario: Type compilation check
    Tool: Bash
    Steps:
      1. npx tsc --noEmit types.ts
    Expected: No TypeScript errors
  ```

  **Commit**: YES
  - Message: `types(material): enhance ClaimsMaterial with category and strategy`
  - Files: `types.ts`

- [ ] 3. Create base Strategy interface and factory

  **What to do**:
  - Define `ProcessingStrategy` interface with `process()` method
  - Define `StrategyContext` type for shared context
  - Create `StrategyFactory` class with `createStrategy()` method
  - Implement strategy registration mechanism

  **Must NOT do**:
  - Don't implement concrete strategies yet
  - Don't hard-code strategy mappings

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Reason**: Core architecture design

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on Task 2)
  - **Parallel Group**: Wave 1
  - **Blocks**: Tasks 6-11
  - **Blocked By**: Task 2

  **References**:
  - Pattern: Strategy pattern implementation
  - Reference: `invoiceAuditService.ts:467-802` - Current flow

  **Acceptance Criteria**:
  - [ ] Strategy interface defined
  - [ ] Factory can create strategies by name
  - [ ] Type-safe strategy creation

  **QA Scenarios**:
  ```
  Scenario: Factory creates strategies
    Tool: Node REPL
    Steps:
      1. const factory = new StrategyFactory()
      2. factory.register('test', TestStrategy)
      3. const strategy = factory.create('test')
    Expected: strategy is instance of TestStrategy
  ```

  **Commit**: YES
  - Message: `feat(material): create strategy interface and factory`
  - Files: `services/material/strategies/baseStrategy.ts`

- [ ] 4. Create MaterialClassification types

  **What to do**:
  - Define `ClassificationResult` interface
  - Define `AiClassification` interface
  - Define classification confidence thresholds
  - Create type guards for classification results

  **Must NOT do**:
  - Don't implement classification logic yet

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Reason**: Type definitions

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 1-3)
  - **Parallel Group**: Wave 1
  - **Blocks**: Task 12
  - **Blocked By**: None

  **References**:
  - Reference: Design doc "智能分类器实现" section

  **Acceptance Criteria**:
  - [ ] All classification types defined
  - [ ] Confidence threshold constant defined (0.85)

  **QA Scenarios**:
  ```
  Scenario: Type check
    Tool: TypeScript compiler
    Steps: npx tsc --noEmit
    Expected: No errors
  ```

  **Commit**: YES (group with Task 2)
  - Message: `types(material): add classification types`
  - Files: `types.ts`

- [ ] 5. Create MaterialAuditConclusion types

  **What to do**:
  - Define `MaterialAuditConclusion` interface
  - Define `AuditChecklistItem` interface
  - Define `AuditIssue` interface
  - Define conclusion status union type

  **Must NOT do**:
  - Don't modify existing MaterialAuditResult yet

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Reason**: Type definitions

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 1-4)
  - **Parallel Group**: Wave 1
  - **Blocks**: Task 11
  - **Blocked By**: None

  **References**:
  - Reference: Design doc "增强审核结论" section

  **Acceptance Criteria**:
  - [ ] All conclusion types defined
  - [ ] Nested types properly structured

  **QA Scenarios**:
  ```
  Scenario: Type completeness
    Tool: TypeScript
    Steps: Create sample conclusion object
    Expected: No type errors
  ```

  **Commit**: YES (group with Task 2)
  - Message: `types(material): add audit conclusion types`
  - Files: `types.ts`

- [ ] 6. Implement StructuredDocStrategy (3-step flow)

  **What to do**:
  - Implement `StructuredDocStrategy` class implementing `ProcessingStrategy`
  - Port logic from `performMaterialAudit()` in invoiceAuditService.ts
  - 3 steps: upload → OCR+extract → save
  - Use material's jsonSchema and aiAuditPrompt

  **Must NOT do**:
  - Don't modify existing performMaterialAudit yet (copy logic)
  - Don't handle invoice-specific logic

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Reason**: Complex business logic migration
  - **Skills**: `git-master` for safe code copying

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 7-8)
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 13
  - **Blocked By**: Task 3

  **References**:
  - Source: `invoiceAuditService.ts:1246-1377` - performMaterialAudit
  - Source: `invoiceOcrService.ts:264-369` - recognizeClaimMaterial

  **Acceptance Criteria**:
  - [ ] Strategy implements interface correctly
  - [ ] 3-step flow works end-to-end
  - [ ] Uses configurable schema and prompt

  **QA Scenarios**:
  ```
  Scenario: Process ID card
    Tool: Bun test script
    Preconditions: ID card image available
    Steps:
      1. Create strategy instance
      2. Call process() with ID card image
      3. Verify extractedData has name, id_number fields
    Expected: Extracted fields match schema
  ```

  **Commit**: YES
  - Message: `feat(material): implement structured document strategy`
  - Files: `services/material/strategies/structuredDocStrategy.ts`

- [ ] 7. Implement GeneralDocStrategy (AI-based)

  **What to do**:
  - Implement `GeneralDocStrategy` for free-form document analysis
  - Use Gemini for text extraction and summarization
  - Return flexible structured data
  - Handle documents without strict schema

  **Must NOT do**:
  - Don't require fixed schema
  - Don't validate against strict rules

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Reason**: AI integration

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 6, 8)
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 13
  - **Blocked By**: Task 3

  **References**:
  - Pattern: `invoiceOcrService.ts` - Gemini API calls
  - Reference: Gemini prompt engineering patterns

  **Acceptance Criteria**:
  - [ ] Handles arbitrary documents
  - [ ] Returns AI summary and extracted fields
  - [ ] Gracefully handles unclear documents

  **QA Scenarios**:
  ```
  Scenario: Process unclear document
    Tool: Bun test
    Steps: Process blurry image
    Expected: Returns low confidence, not crash
  ```

  **Commit**: YES
  - Message: `feat(material): implement general document strategy`
  - Files: `services/material/strategies/generalDocStrategy.ts`

- [ ] 8. Implement ImageOnlyStrategy (basic OCR)

  **What to do**:
  - Implement `ImageOnlyStrategy` for pure image OCR
  - Extract visible text only
  - No AI analysis, no validation
  - Return raw OCR text

  **Must NOT do**:
  - Don't call AI for analysis
  - Don't attempt field extraction

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Reason**: Simple OCR wrapper

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 6-7)
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 13
  - **Blocked By**: Task 3

  **References**:
  - Pattern: OCR service integration

  **Acceptance Criteria**:
  - [ ] Returns raw OCR text
  - [ ] Fast processing (no AI delay)
  - [ ] Works with any image

  **QA Scenarios**:
  ```
  Scenario: Extract text from photo
    Tool: Bun test
    Steps: Process image with text
    Expected: Returns extracted text string
  ```

  **Commit**: YES
  - Message: `feat(material): implement image-only strategy`
  - Files: `services/material/strategies/imageOnlyStrategy.ts`

- [ ] 9. Implement InvoiceStrategy (8-step flow)

  **What to do**:
  - Implement `InvoiceStrategy` class - **独立设计，不依赖现有代码**
  - Steps: upload → OCR → hospital validation → catalog fetch → sync match → AI match → summary → save
  - Design new OCR prompt for medical invoices
  - Implement hospital validation logic
  - Implement medical catalog matching
  - Support multi-image merging (summary + detail pages)

  **Must NOT do**:
  - Don't copy from InvoiceAuditPage (独立设计)
  - Don't depend on existing invoice audit service internals

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Reason**: Complex domain logic (medical insurance)

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 6-8)
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 13
  - **Blocked By**: Task 3

  **References**:
  - Reference: 医疗发票数据结构理解 (from types.ts)
  - Reference: 医保目录匹配逻辑理解
  - Reference: 医院资质校验需求

  **Acceptance Criteria**:
  - [ ] All 8 steps implemented independently
  - [ ] Hospital validation works with hospital database
  - [ ] Catalog matching with province-specific catalogs
  - [ ] Multi-image merging (summary + detail)
  - [ ] Step timing tracked
  - [ ] Independent of InvoiceAuditPage code

  **QA Scenarios**:
  ```
  Scenario: Process medical invoice independently
    Tool: Bun test with real invoice image
    Steps:
      1. Create strategy (no dependency on existing code)
      2. Process invoice image
      3. Verify all 8 steps complete independently
      4. Check hospital validation result
      5. Check catalog matching results
    Expected: Complete audit result, code is independent
  ```

  **Commit**: YES
  - Message: `feat(material): implement invoice strategy (8-step flow, independent design)`
  - Files: `services/material/strategies/invoiceStrategy.ts`

- [ ] 10. Create MaterialExtractor service

  **What to do**:
  - Create `MaterialExtractor` class
  - Coordinate with StrategyFactory
  - Handle file preprocessing (OSS upload, base64 conversion)
  - Route to appropriate strategy based on processingStrategy
  - Return standardized extraction result

  **Must NOT do**:
  - Don't implement strategy logic (delegate to strategies)
  - Don't handle classification (separate concern)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Reason**: Service orchestration

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on Tasks 6-9)
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 13
  - **Blocked By**: Tasks 3, 6-9

  **References**:
  - Pattern: `invoiceAuditService.ts` - Flow orchestration
  - Pattern: `ossService.ts` - File upload

  **Acceptance Criteria**:
  - [ ] Routes to correct strategy
  - [ ] Handles file upload
  - [ ] Returns consistent result format

  **QA Scenarios**:
  ```
  Scenario: Extract different material types
    Tool: Bun test
    Steps:
      1. Test with invoice (routes to InvoiceStrategy)
      2. Test with ID card (routes to StructuredDocStrategy)
    Expected: Correct strategy used for each
  ```

  **Commit**: YES
  - Message: `feat(material): create MaterialExtractor service`
  - Files: `services/material/materialExtractor.ts`

- [ ] 11. Create MaterialValidator service

  **What to do**:
  - Create `MaterialValidator` class
  - Validate extracted data against jsonSchema
  - Apply validationRules from ExtractionConfig
  - Generate AuditChecklistItem array
  - Generate AuditIssue array
  - Produce MaterialAuditConclusion

  **Must NOT do**:
  - Don't implement AI-based validation (use rules)
  - Don't modify extracted data

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Reason**: Validation logic

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on Task 5 for types)
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 13
  - **Blocked By**: Task 5

  **References**:
  - Pattern: JSON Schema validation
  - Reference: `invoiceAuditService.ts:189-255` - determineQualification

  **Acceptance Criteria**:
  - [ ] Validates required fields
  - [ ] Applies custom validation rules
  - [ ] Generates complete conclusion

  **QA Scenarios**:
  ```
  Scenario: Validate incomplete data
    Tool: Bun test
    Steps:
      1. Create extracted data missing required field
      2. Call validator
    Expected: Returns failed conclusion with issues
  ```

  **Commit**: YES
  - Message: `feat(material): create MaterialValidator service`
  - Files: `services/material/materialValidator.ts`

- [ ] 12. Implement MaterialClassifier with AI matching

  **What to do**:
  - Implement `MaterialClassifier` class
  - AI-based document type detection
  - Configuration matching with ClaimsMaterial
  - Confidence calculation and threshold handling
  - Alternative suggestions when confidence < threshold

  **Must NOT do**:
  - Don't use simple keyword matching (use AI)
  - Don't require exact matches

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Reason**: AI integration + algorithm design

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 13-17)
  - **Parallel Group**: Wave 3
  - **Blocks**: Task 18-22
  - **Blocked By**: Tasks 3, 4

  **References**:
  - Reference: Design doc "智能分类器实现" section

  **Acceptance Criteria**:
  - [ ] AI classification implemented
  - [ ] Config matching works
  - [ ] Confidence threshold (0.85) enforced
  - [ ] Alternatives returned when needed

  **QA Scenarios**:
  ```
  Scenario: Classify ID card
    Tool: Bun test
    Steps:
      1. Upload ID card image
      2. Call classifier
    Expected: Returns mat-1 or mat-2 with high confidence
  ```

  **Commit**: YES
  - Message: `feat(material): implement MaterialClassifier`
  - Files: `services/material/materialClassifier.ts`

- [ ] 13. Create UnifiedMaterialService facade

  **What to do**:
  - Create `UnifiedMaterialService` class
  - Orchestrate classifier → extractor → validator flow
  - Provide high-level API for classification only
  - Provide high-level API for full processing
  - Handle errors and partial failures

  **Must NOT do**:
  - Don't implement business logic (delegate to components)

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Reason**: Service orchestration

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 12, 14-17)
  - **Parallel Group**: Wave 3
  - **Blocks**: Task 18-22
  - **Blocked By**: Tasks 10-12

  **References**:
  - Pattern: Facade pattern

  **Acceptance Criteria**:
  - [ ] Single API for classification
  - [ ] Single API for full processing
  - [ ] Error handling works
  - [ ] Batch processing supported

  **QA Scenarios**:
  ```
  Scenario: Process material end-to-end
    Tool: Bun test
    Steps:
      1. Call unifiedService.process(file)
    Expected: Returns complete result
  ```

  **Commit**: YES
  - Message: `feat(material): create UnifiedMaterialService`
  - Files: `services/material/index.ts`

- [ ] 14. Update ClaimsMaterial mock data with new fields

  **What to do**:
  - Update `MOCK_CLAIMS_MATERIALS` in constants.ts
  - Add `category` to all 47 materials
  - Add `processingStrategy` to all materials
  - Add `extractionConfig` with proper schemas

  **Must NOT do**:
  - Don't remove existing fields
  - Don't break existing references

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Reason**: Data entry

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 12-13, 15-17)
  - **Parallel Group**: Wave 3
  - **Blocks**: None
  - **Blocked By**: Task 2

  **References**:
  - Source: `constants.ts:5192+` - MOCK_CLAIMS_MATERIALS

  **Acceptance Criteria**:
  - [ ] All 47 materials have category
  - [ ] All 47 materials have processingStrategy
  - [ ] All 47 materials have extractionConfig

  **QA Scenarios**:
  ```
  Scenario: Data integrity
    Tool: TypeScript
    Steps: Load mock data, verify all fields
    Expected: No missing required fields
  ```

  **Commit**: YES
  - Message: `data(material): update mock data with new fields`
  - Files: `constants.ts`

- [ ] 15. Create classification API endpoint

  **What to do**:
  - Create `/api/materials/classify` endpoint
  - Accept file upload
  - Return classification result
  - Support targetMaterialId override

  **Must NOT do**:
  - Don't modify existing API endpoints

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Reason**: Backend API

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 12-14, 16-17)
  - **Parallel Group**: Wave 3
  - **Blocks**: Task 18-22
  - **Blocked By**: Task 12

  **References**:
  - Pattern: `server/apiHandler.js` - Existing API patterns

  **Acceptance Criteria**:
  - [ ] Endpoint accepts file upload
  - [ ] Returns classification result
  - [ ] Error handling works

  **QA Scenarios**:
  ```
  Scenario: API classification
    Tool: curl
    Steps:
      curl -X POST /api/materials/classify -F "file=@idcard.jpg"
    Expected: Returns JSON with materialId and confidence
  ```

  **Commit**: YES
  - Message: `feat(api): add material classification endpoint`
  - Files: `server/apiHandler.js`

- [ ] 16. Create extraction API endpoint

  **What to do**:
  - Create `/api/materials/extract` endpoint
  - Accept file + materialId
  - Return extraction result with audit conclusion

  **Must NOT do**:
  - Don't duplicate classification logic

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Reason**: Backend API

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 12-15, 17)
  - **Parallel Group**: Wave 3
  - **Blocks**: Task 18-22
  - **Blocked By**: Task 13

  **Acceptance Criteria**:
  - [ ] Endpoint accepts file + materialId
  - [ ] Returns extraction result
  - [ ] Includes audit conclusion

  **QA Scenarios**:
  ```
  Scenario: API extraction
    Tool: curl
    Steps:
      curl -X POST /api/materials/extract -F "file=@invoice.jpg" -F "materialId=mat-20"
    Expected: Returns JSON with extractedData and conclusion
  ```

  **Commit**: YES
  - Message: `feat(api): add material extraction endpoint`
  - Files: `server/apiHandler.js`

- [ ] 17. Create batch processing API endpoint

  **What to do**:
  - Create `/api/materials/batch` endpoint
  - Accept multiple files
  - Process each with classification + extraction
  - Return aggregated results

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Reason**: Backend API

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 12-16)
  - **Parallel Group**: Wave 3
  - **Blocks**: Task 18-22
  - **Blocked By**: Tasks 15-16

  **Acceptance Criteria**:
  - [ ] Endpoint accepts multiple files
  - [ ] Processes concurrently
  - [ ] Returns aggregated results

  **QA Scenarios**:
  ```
  Scenario: Batch processing
    Tool: curl
    Steps:
      curl -X POST /api/materials/batch -F "files=@1.jpg" -F "files=@2.jpg"
    Expected: Returns array of results
  ```

  **Commit**: YES
  - Message: `feat(api): add batch processing endpoint`
  - Files: `server/apiHandler.js`

- [ ] 18. Create MaterialUpload component

  **What to do**:
  - Create `MaterialUpload` component
  - Support drag & drop
  - Support multiple file selection
  - Show upload progress
  - Integration with classification API

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Reason**: UI component

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 19-22)
  - **Parallel Group**: Wave 4
  - **Blocks**: F1-F4
  - **Blocked By**: Task 15

  **Acceptance Criteria**:
  - [ ] Drag & drop works
  - [ ] Multiple files supported
  - [ ] Shows progress
  - [ ] Calls classification API

  **QA Scenarios**:
  ```
  Scenario: Upload files
    Tool: Playwright
    Steps:
      1. Drag files to upload area
      2. Verify progress shown
      3. Verify classification results
    Expected: Files uploaded and classified
  ```

  **Commit**: YES
  - Message: `feat(ui): create MaterialUpload component`
  - Files: `components/MaterialUpload.tsx`

- [ ] 19. Create ClassificationModal component

  **What to do**:
  - Create `ClassificationModal` component
  - Show classification confidence
  - Show material type options
  - Allow user to select/confirm material type
  - Show alternatives when confidence low

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Reason**: UI component

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 18, 20-22)
  - **Parallel Group**: Wave 4
  - **Blocks**: F1-F4
  - **Blocked By**: Task 12

  **Acceptance Criteria**:
  - [ ] Shows confidence score
  - [ ] Shows material options
  - [ ] Handles low confidence case
  - [ ] User can override selection

  **QA Scenarios**:
  ```
  Scenario: Classification confirmation
    Tool: Playwright
    Steps:
      1. Upload unclear document
      2. Verify modal shows alternatives
      3. Select correct material
    Expected: User can override classification
  ```

  **Commit**: YES
  - Message: `feat(ui): create ClassificationModal component`
  - Files: `components/ClassificationModal.tsx`

- [ ] 20. Create ExtractResultViewer component

  **What to do**:
  - Create `ExtractResultViewer` component
  - Display extracted fields in table/form
  - Show audit conclusion with checklist
  - Show issues and warnings
  - Support editing extracted data

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Reason**: UI component

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 18-19, 21-22)
  - **Parallel Group**: Wave 4
  - **Blocks**: F1-F4
  - **Blocked By**: Task 5

  **Acceptance Criteria**:
  - [ ] Shows extracted fields
  - [ ] Shows audit conclusion
  - [ ] Shows checklist
  - [ ] Shows issues if any

  **QA Scenarios**:
  ```
  Scenario: View extraction results
    Tool: Playwright
    Steps:
      1. Extract ID card
      2. Verify fields displayed
      3. Verify conclusion shown
    Expected: Complete result view
  ```

  **Commit**: YES
  - Message: `feat(ui): create ExtractResultViewer component`
  - Files: `components/ExtractResultViewer.tsx`

- [ ] 21. Create MaterialProcessingPage (独立页面)

  **What to do**:
  - Create new `MaterialProcessingPage` component - **独立设计，不依赖 InvoiceAuditPage**
  - Design new UI for material upload + classification + extraction
  - Support both single and batch processing
  - Show classification confidence and alternatives
  - Display extraction results with audit conclusion

  **Must NOT do**:
  - Don't copy InvoiceAuditPage code (独立设计)
  - Don't depend on InvoiceAuditPage components

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Reason**: New UI design

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 18-20, 22)
  - **Parallel Group**: Wave 4
  - **Blocks**: F1-F4
  - **Blocked By**: Tasks 13, 17, 18-20

  **References**:
  - Pattern: Modern React component patterns
  - Reference: UnifiedMaterialService API

  **Acceptance Criteria**:
  - [ ] Clean, modern UI design
  - [ ] Supports all 4 processing strategies
  - [ ] Shows classification confidence
  - [ ] Shows extraction results with conclusion
  - [ ] Independent of InvoiceAuditPage

  **QA Scenarios**:
  ```
  Scenario: Material processing page works
    Tool: Playwright
    Steps:
      1. Navigate to MaterialProcessingPage
      2. Upload material
      3. Verify classification shows confidence
      4. Click extract
      5. Verify results display
    Expected: Complete flow with new UI
  ```

  **Commit**: YES
  - Message: `feat(ui): create MaterialProcessingPage (independent design)`
  - Files: `components/MaterialProcessingPage.tsx`

- [ ] 22. Create migration script for existing data

  **What to do**:
  - Create script to migrate existing material data
  - Add default category to existing materials
  - Add default processingStrategy
  - Ensure backward compatibility

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Reason**: Data migration

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 18-21)
  - **Parallel Group**: Wave 4
  - **Blocks**: F1-F4
  - **Blocked By**: Task 14

  **Acceptance Criteria**:
  - [ ] Script runs without errors
  - [ ] Existing data migrated
  - [ ] Backward compatibility maintained

  **QA Scenarios**:
  ```
  Scenario: Migration
    Tool: Bash
    Steps:
      1. Run migration script
      2. Verify data integrity
    Expected: All data migrated
  ```

  **Commit**: YES
  - Message: `chore(data): add migration script for new material fields`
  - Files: `scripts/migrate-materials.ts`

---

## Final Verification Wave

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, curl endpoint, run command). For each "Must NOT Have": search codebase for forbidden patterns — reject with file:line if found. Check evidence files exist in .sisyphus/evidence/. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality Review** — `unspecified-high`
  Run `tsc --noEmit` + linter + `bun test`. Review all changed files for: `as any`/`@ts-ignore`, empty catches, console.log in prod, commented-out code, unused imports. Check AI slop: excessive comments, over-abstraction, generic names (data/result/item/temp).
  Output: `Build [PASS/FAIL] | Lint [PASS/FAIL] | Tests [N pass/N fail] | Files [N clean/N issues] | VERDICT`

- [ ] F3. **Real Manual QA** — `unspecified-high` (+ `playwright` skill if UI)
  Start from clean state. Execute EVERY QA scenario from EVERY task — follow exact steps, capture evidence. Test cross-task integration (features working together, not isolation). Test edge cases: empty state, invalid input, rapid actions. Save to `.sisyphus/evidence/final-qa/`.
  Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [ ] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual diff (git log/diff). Verify 1:1 — everything in spec was built (no missing), nothing beyond spec was built (no creep). Check "Must NOT do" compliance. Detect cross-task contamination: Task N touching Task M's files. Flag unaccounted changes.
  Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

- **Wave 1**: `types(material): ...` or `chore(material): ...`
- **Wave 2**: `feat(material): implement ...`
- **Wave 3**: `feat(material): create ...`
- **Wave 4**: `refactor(ui): ...` or `feat(ui): ...`
- **Wave FINAL**: `docs(material): ...` or `test(material): ...`

---

## Success Criteria

### Verification Commands
```bash
# Type check
npx tsc --noEmit

# Build check
npm run build

# Verify all services exist
ls -la services/material/
ls -la services/material/strategies/

# Verify types enhanced
grep -n "processingStrategy" types.ts
grep -n "MaterialAuditConclusion" types.ts
```

### Final Checklist
- [ ] All 47 material types have category assigned in mock data
- [ ] InvoiceAuditPage no longer has hard-coded material IDs
- [ ] All 4 strategies implemented and registered
- [ ] Classification confidence threshold configurable
- [ ] Backward compatibility maintained (existing data loads)
- [ ] Documentation updated

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Breaking existing code | Keep new fields optional (?), maintain backward compatibility |
| InvoiceAuditPage breaks | Don't modify initially, only after strategies tested |
| AI classification inaccurate | Configurable threshold + human fallback |
| Performance degradation | Lazy load strategies, cache classification results |

---

## Post-Implementation

After completing all tasks:
1. Run full regression test on claim submission flow
2. Test with real invoice images
3. Verify all 47 material types process correctly
4. Update developer documentation
5. Schedule demo for stakeholders
