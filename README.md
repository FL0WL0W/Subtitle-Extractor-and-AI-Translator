# Subtitle Extractor

A web application that extracts subtitle tracks from video files and downloads them as SRT files. Includes AI-powered translation assistance to translate subtitles using your preferred AI service. Built with Node.js, Webpack, and FFmpeg WebWorker. Built with copilot Claude Haiku 4.5

## Features

- 📁 Upload video files in any common format
- 🎬 Automatically detect all subtitle tracks
- ☑️ Select multiple subtitle tracks
- ⬇️ Download subtitles as SRT files
- 🤖 AI Translation Assistant - generate prompts formatted for AI translation services
- ⚡ Fast processing using FFmpeg WebWorker
- 📱 Responsive design

## Prerequisites

- Node.js 14+ and npm

## Installation

1. Clone the repository:
```bash
cd SubtitleExtractor
```

2. Install dependencies:
```bash
npm install
```

## Development

Start the development server:
```bash
npm start
```

The app will open at `http://localhost:8080`

## Build for Production

```bash
npm run build
```

This creates an optimized build in the `dist/` folder.

## Usage

### Extract and Download Subtitles

1. Click on the upload area or drag and drop a video file
2. Wait for the app to analyze the video and detect subtitle tracks
3. Select the subtitle tracks you want to extract
4. Click the "Download SRT" button
5. The subtitle file will be downloaded to your computer

### Translate Subtitles with AI

1. After selecting subtitle tracks, scroll down to the "AI Translation Assistant" section
2. Select your target language from the dropdown
3. Click "Generate Prompt for AI" - this extracts the subtitles and formats them as a numbered list
4. Click "Copy Prompt" to copy the prompt to your clipboard
5. Paste the prompt into your preferred AI service (ChatGPT, Claude, etc.)
6. Copy the translated lines from the AI's response
7. Paste the translations into the "Paste the translated lines here" textarea
8. Click "Merge Translations & Download SRT" to create an SRT file with the translated text

**Note**: The prompt includes instructions to preserve hyphens and dashes exactly as they appear.

## How It Works

- **Frontend**: Vanilla JavaScript with webpack bundling
- **FFmpeg Integration**: Uses `@ffmpeg/ffmpeg` library with WebAssembly
- **Web Worker**: Processes video files in a separate thread to prevent UI blocking
- **Subtitle Extraction**: Converts subtitles to SRT format for compatibility
- **AI Translation**: Generates formatted prompts with surrounding context for better AI translations

## File Structure

```
src/
├── index.html          # Main HTML template
├── index.js            # Main application logic & UI
├── ffmpeg-worker.js    # Web worker for FFmpeg processing
└── style.css           # Styling
```

## Troubleshooting

### Slow Initial Load
The first use requires downloading FFmpeg WASM (~30MB). Subsequent uses will be faster due to browser caching.

### No Subtitles Found
Not all video files have embedded subtitles. The app will only detect tracks that are actually present in the file.

### AI Translation Tips
- For best results, use an AI with a large context window (ChatGPT-4, Claude, etc.)
- The prompt includes surrounding lines for context to improve translation accuracy
- Always review the AI translation before merging to ensure quality
- Some AIs may reformat the output - ensure translations follow the format: `number. translated text`

- `@ffmpeg/ffmpeg` - FFmpeg.js bindings for WASM
- `@ffmpeg/util` - Utility functions for FFmpeg
- `webpack` - Module bundler
- `babel-loader` - JavaScript transpiler for webpack

## License

MIT
