# Study Hub

A calm place to plan, practice, and improve — an AI-powered study companion for GCSE and A-Level students.

## Features

- **Revision workspaces** — scan exams and generate AI study materials (video, audio, slides).
- **Exam preparation** — generate realistic GCSE / A-Level past-paper-style exams with AI, then grade your answers against the mark scheme.
- **Tutor chat** — ask an AI tutor anything, with live web research and full math rendering (KaTeX) plus function graphs and geometric figures.
- **Desktop apps** for macOS and Windows (see [Releases](https://github.com/pleees12345/study-hub/releases)).

## Download

Get the desktop app from the [latest release](https://github.com/pleees12345/study-hub/releases/latest):

| Platform | File |
| --- | --- |
| macOS (Apple Silicon) | `Study-Hub-2.0.0-mac-arm64.dmg` |
| Windows (x64) | `Study-Hub-2.0.0-win-x64.exe` |

## Development

```bash
npm install
npm run dev          # start the Vite dev server on http://localhost:5183
```

### Build desktop apps

```bash
npm run electron:build      # macOS (.dmg + .zip)
npm run electron:build:win  # Windows (.exe + .zip)
```

Output goes to `release/`.

### Environment

Copy `.env.example` to `.env.local` and set `VITE_GROQ_API_KEY` to enable AI features in the packaged app. The Vite dev server proxies Groq calls automatically.

## License

Private project — all rights reserved.