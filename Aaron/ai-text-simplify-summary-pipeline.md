# AI Text Simplify & Summary Pipeline — Implementation Report

## What Was Implemented

This feature adds a complete AI-powered worksheet adaptation pipeline to Trellis. An Educational Assistant (EA) can photograph or select a worksheet, configure adaptation options (simplify, summarize, add visual support), send it to GPT-4o for processing, then review and refine the AI-generated results before handing the device to a student.

### User Flow

```
Home → take photo / pick from library
  → Process Screen (configure 3 toggles)
    → GPT-4o processes the image
      → Review Screen (accept / regenerate each block)
        → Hand to Student (StudentView)
```

### Three Adaptation Toggles

| Toggle | Description |
|---|---|
| **Visual Support** | AI suggests image descriptions (visualHint) for each text block |
| **Simplification Level** | Off / Grade 1 (5–7 word sentences) / Grade 2 (8–12 word sentences) |
| **Summarize** | Condense full text into max 5 sentences |

---

## Files Changed / Created

### New Files

| File | Purpose |
|---|---|
| `shared/src/types.ts` | Shared TypeScript interfaces (ProcessRequest, ProcessResponse, AdaptedBlock, etc.) |
| `shared/src/index.ts` | Re-exports all types |
| `shared/package.json` | `@trellis/shared` workspace package |
| `shared/tsconfig.json` | TypeScript config for shared package |
| `server/src/prompts.ts` | System prompt, grade-level instructions, dynamic prompt builder, OpenAI Structured Output JSON schemas |
| `server/src/schemas.ts` | Zod v4 validation schemas for request bodies and GPT output |
| `server/src/routes/adapt.ts` | `POST /api/adapt/process` and `POST /api/adapt/regenerate` endpoints |
| `server/.env.example` | Environment variable template (OPENAI_API_KEY, PORT) |
| `app/src/services/adaptApi.ts` | API client with timeout, discriminated union return type |
| `app/src/screens/ProcessScreen.tsx` | Toggle configuration UI, image compression, API call |
| `app/src/screens/ReviewScreen.tsx` | Card list UI for reviewing/accepting/regenerating AI results |
| `app/.env.example` | Environment variable template (EXPO_PUBLIC_API_URL) |

### Modified Files

| File | Change |
|---|---|
| `package.json` | Added `"shared"` to workspaces array |
| `app/package.json` | Added `expo-image-picker`, `expo-image-manipulator`, `expo-file-system`, `@trellis/shared` |
| `server/package.json` | Added `openai`, `zod`, `dotenv`, `@trellis/shared` |
| `server/src/index.ts` | Added `dotenv/config`, body limit `20mb`, mounted `/api/adapt` router |
| `app/src/screens/HomeScreen.tsx` | Replaced hardcoded scan button with `expo-image-picker` (camera + library) |
| `app/src/navigation/types.ts` | Added `Process` and `Review` to `RootStackParamList`, re-exports shared types |
| `app/src/navigation/RootNavigator.tsx` | Registered `ProcessScreen` and `ReviewScreen` |

---

## Architecture

```
┌──────────────────────┐       POST /api/adapt/process        ┌───────────────────┐
│   React Native App   │ ──────────────────────────────────── │  Express BFF      │
│                      │       POST /api/adapt/regenerate     │  (server/)        │
│  ProcessScreen       │ ◄──────────────────────────────────  │                   │
│  ReviewScreen        │                                      │  Zod validation   │
│  adaptApi.ts         │                                      │  Prompt builder   │
└──────────────────────┘                                      │  Error classifier │
                                                              └─────────┬─────────┘
                                                                        │
                                                              OpenAI GPT-4o (multimodal)
                                                              Structured Outputs
```

- **No separate OCR step** — GPT-4o reads the worksheet image directly (multimodal)
- **Structured Outputs** — `response_format: { type: "json_schema" }` guarantees valid JSON
- **Stateless BFF** — No database, no sessions, no stored images
- **Lazy OpenAI client** — Only initializes when first request arrives (avoids crash without API key)

---

## API Endpoints

### `POST /api/adapt/process`

Accepts a worksheet image + toggles, returns adapted text blocks and optional summary.

**Request:**
```json
{
  "imageBase64": "data:image/jpeg;base64,...",
  "toggles": {
    "visualSupport": true,
    "simplifyLevel": "G1",
    "summarize": true
  },
  "options": {
    "summaryMaxSentences": 5,
    "language": "en"
  }
}
```

**Response:**
```json
{
  "blocks": [
    {
      "blockId": "b1",
      "label": "Section Title",
      "originalText": "...",
      "simplifiedText": "...",
      "keywords": ["word1", "word2"],
      "visualHint": "A diagram showing..."
    }
  ],
  "summary": {
    "sentences": ["...", "..."],
    "warnings": []
  },
  "meta": {
    "simplifyLevel": "G1",
    "toggles": { ... },
    "latencyMs": { "total": 4200 }
  }
}
```

### `POST /api/adapt/regenerate`

Regenerates a single block or summary with higher temperature (0.7) for variety.

---

## How to Test

### Prerequisites

1. Copy environment files:
   ```bash
   cp server/.env.example server/.env
   cp app/.env.example app/.env
   ```

2. Add your OpenAI API key to `server/.env`:
   ```
   OPENAI_API_KEY=sk-...
   ```

3. Install dependencies from project root:
   ```bash
   npm install
   ```

### Start the Server

```bash
npm run server
# or: cd server && npx tsx watch src/index.ts
```

Verify it works:
```bash
# Health check
curl http://localhost:3001/health
# Expected: {"status":"ok","service":"adapted-bff"}

# Validation test (should return 400)
curl -X POST http://localhost:3001/api/adapt/process \
  -H "Content-Type: application/json" \
  -d '{}'
# Expected: {"code":"VALIDATION_ERROR","message":"..."}
```

### Start the App

```bash
npm run app
# or: cd app && npx expo start
```

Press `i` for iOS simulator or scan QR for Expo Go.

### End-to-End Test Steps

1. **Home Screen** — Tap "Take a photo" (camera) or "Choose from library" (photo picker)
2. **Process Screen** — Verify:
   - Image preview is displayed
   - All 3 toggles work (Visual Support switch, Simplification Level chips, Summarize switch)
   - "Process Now" button is disabled when all toggles are off
   - Tap "Process Now" → loading indicator with step messages appears
3. **Review Screen** — Verify:
   - Original image shown at top
   - Latency and simplify level displayed
   - Summary card appears (if summarize was on)
   - Text block cards show original → simplified text → keywords
   - "Accept" button adds green border + checkmark
   - "Regenerate" button calls API and replaces content (removes accepted state)
   - "Accept All & Hand Off" button navigates to StudentView
4. **Error Cases** — Verify:
   - No API key → server throws clear error message at first request
   - Network down → app shows "Network error. Is the server running?"
   - All toggles off → "At least one toggle must be enabled" (400)

### Server-Only Tests (No OpenAI Key Needed)

```bash
# All toggles off → validation error
curl -X POST http://localhost:3001/api/adapt/process \
  -H "Content-Type: application/json" \
  -d '{"imageBase64":"data:image/jpeg;base64,abc","toggles":{"visualSupport":false,"simplifyLevel":null,"summarize":false}}'

# Missing imageBase64 → validation error
curl -X POST http://localhost:3001/api/adapt/process \
  -H "Content-Type: application/json" \
  -d '{"toggles":{"visualSupport":true,"simplifyLevel":null,"summarize":false}}'

# Invalid regenerate target → validation error
curl -X POST http://localhost:3001/api/adapt/regenerate \
  -H "Content-Type: application/json" \
  -d '{"target":{"type":"block","blockId":""},"context":{"originalText":"hello"}}'
```

---

## Known Limitations

- Pre-existing JSX type warnings in the app (`'View' cannot be used as a JSX component`) — this is a React 19 + React Native types version mismatch, unrelated to this feature
- `expo-image-picker` camera does not work in iOS Simulator (use "Choose from library" for simulator testing)
- No persistent storage — adapted worksheets are lost when navigating away
