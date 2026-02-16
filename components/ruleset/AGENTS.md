# RULESET ENGINE

**Score:** 52 (11 files, complex domain)

## OVERVIEW

Visual ruleset configuration engine with condition trees, action parameters, and execution pipeline management.

## STRUCTURE

```
ruleset/
├── ConditionTreeBuilder.tsx      # Visual condition tree editor
├── ActionParamsEditor.tsx        # Action parameter configuration
├── ExecutionPipelineTab.tsx      # Pipeline execution flow
├── FieldDictionaryTab.tsx        # Field definitions
├── OverrideChainsTab.tsx         # Override chain configuration
├── ImportRulesetModal.tsx        # Import ruleset from JSON
├── RuleDetailModal.tsx          # Single rule editor
├── RuleListTab.tsx              # Rule list management
├── RulesetDetailView.tsx         # Full ruleset view
└── RulesetListView.tsx          # Ruleset list
```

## WHERE TO LOOK

| Task | File |
|------|------|
| Build condition tree | `ConditionTreeBuilder.tsx` |
| Configure actions | `ActionParamsEditor.tsx` |
| Manage rules | `RuleListTab.tsx` |
| Import/export | `ImportRulesetModal.tsx` |

## CONVENTIONS

- Complex state management (nested objects)
- JSON schema validation via `insurance_ruleset_schema_v2.json`
- Visual UI for non-technical users
- Follows same Tailwind patterns as parent
