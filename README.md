# Subtitle Extractor

A web application that extracts subtitle tracks from video files and downloads them as SRT files. Built with Node.js, Webpack, and FFmpeg WebWorker.

## Features

- 📁 Upload video files in any common format
- 🎬 Automatically detect all subtitle tracks
- ☑️ Select multiple subtitle tracks
- ⬇️ Download subtitles as SRT files
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

1. Click on the upload area or drag and drop a video file
2. Wait for the app to analyze the video and detect subtitle tracks
3. Select the subtitle tracks you want to extract
4. Click the "Download SRT" button
5. The subtitle file will be downloaded to your computer

## How It Works

- **Frontend**: React-like vanilla JS with webpack bundling
- **FFmpeg Integration**: Uses `@ffmpeg/ffmpeg` library with WebAssembly
- **Web Worker**: Processes video files in a separate thread to prevent UI blocking
- **Subtitle Extraction**: Converts subtitles to SRT format for compatibility

## File Structure

```
src/
├── index.html          # Main HTML template
├── index.js            # Main application logic
├── ffmpeg-worker.js    # Web worker for FFmpeg processing
└── style.css           # Styling
```

## Troubleshooting

### Slow Initial Load
The first use requires downloading FFmpeg WASM (~30MB). Subsequent uses will be faster due to browser caching.

### No Subtitles Found
Not all video files have embedded subtitles. The app will only detect tracks that are actually present in the file.

### CORS Issues
If you encounter CORS errors, ensure the FFmpeg CDN is accessible from your network.

## Dependencies

- `@ffmpeg/ffmpeg` - FFmpeg.js bindings for WASM
- `@ffmpeg/util` - Utility functions for FFmpeg
- `webpack` - Module bundler
- `babel-loader` - JavaScript transpiler for webpack

## License

MIT
