import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

let ffmpeg = null;
let isInitialized = false;

const initFFmpeg = async () => {
    if (isInitialized) return;

    ffmpeg = new FFmpeg();

    ffmpeg.on('log', ({ message }) => {
        console.log('[FFmpeg]', message);
    });

    try {
        const baseURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd';
        await ffmpeg.load({
            coreURL: `${baseURL}/ffmpeg-core.js`,
            wasmURL: `${baseURL}/ffmpeg-core.wasm`,
        });
        isInitialized = true;
        console.log('FFmpeg initialized successfully');
    } catch (error) {
        console.error('Failed to initialize FFmpeg:', error);
        throw error;
    }
};

const extractSubtitles = async (videoFile) => {
    try {
        await initFFmpeg();

        const videoFileName = 'input_video';
        const videoData = await fetchFile(videoFile);
        
        // Write file to FFmpeg filesystem
        await ffmpeg.writeFile(videoFileName, videoData);

        // Get stream info
        await ffmpeg.exec(['-i', videoFileName]);

        // This will show us available streams
        return { success: true };
    } catch (error) {
        console.error('Error processing video:', error);
        throw error;
    }
};

const extractSubtitleTrack = async (trackIndex) => {
    try {
        if (!isInitialized) {
            throw new Error('FFmpeg not initialized');
        }

        const outputFile = `subtitle_${trackIndex}.srt`;
        
        // Extract specific subtitle stream
        await ffmpeg.exec([
            '-i', 'input_video',
            '-map', `0:s:${trackIndex}`,
            '-c:s', 'srt',
            outputFile
        ]);

        const data = await ffmpeg.readFile(outputFile);
        const text = new TextDecoder().decode(data);

        // Clean up
        await ffmpeg.deleteFile(outputFile);

        return text;
    } catch (error) {
        console.error('Error extracting subtitle track:', error);
        throw error;
    }
};

const getSubtitleStreams = async () => {
    try {
        if (!ffmpeg || !isInitialized) {
            throw new Error('FFmpeg not initialized');
        }

        // We'll get streams info by trying to extract and catching errors
        const streams = [];
        
        // Try to get FFmpeg version info which includes stream details
        let streamIndex = 0;
        while (streamIndex < 10) {
            try {
                // Try to test if this subtitle stream exists
                const testOutput = `test_${streamIndex}.srt`;
                await ffmpeg.exec([
                    '-i', 'input_video',
                    '-map', `0:s:${streamIndex}`,
                    '-t', '1',
                    '-c:s', 'srt',
                    testOutput
                ]);
                
                const data = await ffmpeg.readFile(testOutput);
                const text = new TextDecoder().decode(data);
                
                streams.push({
                    index: streamIndex,
                    name: `Subtitle Track ${streamIndex + 1}`,
                    codec: 'srt'
                });

                await ffmpeg.deleteFile(testOutput);
                streamIndex++;
            } catch (e) {
                // No more subtitle streams
                break;
            }
        }

        return streams;
    } catch (error) {
        console.error('Error getting subtitle streams:', error);
        throw error;
    }
};

self.onmessage = async (event) => {
    const { type, data } = event.data;

    try {
        switch (type) {
            case 'INIT':
                await initFFmpeg();
                self.postMessage({ type: 'INIT_COMPLETE' });
                break;

            case 'PROCESS_VIDEO':
                await extractSubtitles(data.file);
                const streams = await getSubtitleStreams();
                self.postMessage({ type: 'STREAMS_FOUND', data: streams });
                break;

            case 'EXTRACT_SUBTITLE':
                const subtitleText = await extractSubtitleTrack(data.trackIndex);
                self.postMessage({ type: 'SUBTITLE_EXTRACTED', data: subtitleText });
                break;

            default:
                self.postMessage({ type: 'ERROR', error: 'Unknown message type' });
        }
    } catch (error) {
        self.postMessage({ type: 'ERROR', error: error.message });
    }
};
