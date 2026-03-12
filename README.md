# Trellis

AI-powered worksheet adaptation tool for Educational Assistants supporting students with learning disabilities (Grades 4–7). Built for iPad.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React Native + TypeScript (Expo) |
| Backend | Node.js + Express.js (stateless BFF) |
| Package Manager | npm workspaces (monorepo) |

## Project Structure

```
Trellis/
├── app/             # Expo React Native iPad client
├── server/          # Express.js API gateway
└── document/        # Design docs & style guide
```

## Prerequisites

- **Node.js** ≥ 18
- **npm** ≥ 9
- For iOS Simulator: **Xcode** (macOS only, install from App Store)
- For Android Emulator: **Android Studio**
- Or just use **Expo Go** app on a physical device (easiest)

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Start the backend

```bash
npm run server
```

Server runs at `http://localhost:3001`. Verify with:

```bash
curl http://localhost:3001/health
```

### 3. Start the Expo dev server

Open a new terminal:

```bash
npm run app
```

This launches the Expo dev server and shows a QR code + menu in the terminal.

---

## Viewing the App

### Option A: Expo Go on a physical device (fastest setup)

1. Install **Expo Go** from the App Store (iOS) or Google Play (Android)
2. Run `npm run app`
3. Scan the QR code shown in the terminal with your device camera (iOS) or the Expo Go app (Android)
4. The app opens in Expo Go

> Make sure your phone and computer are on the **same Wi-Fi network**.

### Option B: iOS Simulator (macOS only)

**Setup (one-time):**

1. Install **Xcode** from the Mac App Store
2. Open Xcode → Settings → Platforms → download **iOS** simulator runtime
3. Open Xcode → Open Developer Tool → **Simulator**
4. In Simulator's menu bar: File → Open Simulator → choose an **iPad** device (e.g. iPad Pro 11-inch)

**Run:**

```bash
npm run app
```

Then press **`i`** in the Expo terminal to launch in the iOS Simulator.

Or run directly:

```bash
cd app && npx expo start --ios
```

> **Tip:** To target an iPad specifically, open the Simulator app first and select an iPad model before pressing `i`.

### Option C: Android Emulator

**Setup (one-time):**

1. Install [Android Studio](https://developer.android.com/studio)
2. Open Android Studio → More Actions → **Virtual Device Manager**
3. Create a new device → select a **tablet** (e.g. Pixel Tablet or Nexus 9)
4. Download a system image and finish setup
5. Launch the emulator

**Run:**

```bash
npm run app
```

Then press **`a`** in the Expo terminal to launch in the Android Emulator.

### Option D: Web browser (quick preview)

```bash
npm run app
```

Then press **`w`** in the Expo terminal. The app opens in your default browser.

> Web mode is useful for quick layout checks but won't have native device APIs (camera, etc.).

---

## Expo Terminal Controls

When `npm run app` is running, these keyboard shortcuts are available:

| Key | Action |
|-----|--------|
| `i` | Open in iOS Simulator |
| `a` | Open in Android Emulator |
| `w` | Open in web browser |
| `r` | Reload the app |
| `j` | Open React DevTools |
| `?` | Show all commands |

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run app` | Start Expo dev server |
| `npm run server` | Start Express backend (hot-reload via tsx) |
| `npm run dev` | Start both simultaneously (requires `concurrently`) |
