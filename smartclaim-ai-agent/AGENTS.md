# SMARTCLAIM AI AGENT

**Standalone AI Claims Assistant** (separate app, port 8081)

## OVERVIEW

AI-powered claims assistant with chat interface and document upload. Runs on port 8081.

## STRUCTURE

```
smartclaim-ai-agent/
├── App.tsx               # Main app (91KB)
├── index.tsx            # Entry point
├── index.html           # HTML template
├── geminiService.ts     # Gemini AI integration (10KB)
├── ossService.ts        # OSS file upload
├── constants.ts         # Mock data (21KB)
├── types.ts             # Type definitions (6KB)
└── vite.config.ts       # Build config
```

## WHERE TO LOOK

| Task | File |
|------|------|
| AI chat logic | `geminiService.ts` |
| File upload | `ossService.ts` |
| Main UI | `App.tsx` |

## CONVENTIONS

- Same as parent (Tailwind, React 19)
- Requires `GEMINI_API_KEY` in `.env.local`
- Uses invitation code system (`ant`)
- Can run independently from main app

## COMMANDS

```bash
cd smartclaim-ai-agent
npm run dev    # Port 8081
npm run build  # Production build
```
