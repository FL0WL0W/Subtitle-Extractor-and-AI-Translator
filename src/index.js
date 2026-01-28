import './style.css';

let worker;
let selectedTracks = new Set();
let availableStreams = [];

// Initialize the web worker
const initWorker = () => {
    worker = new Worker(new URL('./ffmpeg-worker.js', import.meta.url), { type: 'module' });
    
    worker.onmessage = handleWorkerMessage;
    worker.onerror = (error) => {
        showError(`Worker error: ${error.message}`);
        console.error('Worker error:', error);
    };

    worker.postMessage({ type: 'INIT' });
};

const handleWorkerMessage = (event) => {
    const { type, data, error } = event.data;

    switch (type) {
        case 'INIT_COMPLETE':
            console.log('FFmpeg worker initialized');
            break;

        case 'STREAMS_FOUND':
            displaySubtitleStreams(data);
            hideLoadingBar();
            break;

        case 'SUBTITLE_EXTRACTED':
            downloadSRT(data);
            break;

        case 'ERROR':
            showError(`Processing error: ${error}`);
            hideLoadingBar();
            break;

        default:
            console.log('Unknown message from worker:', type);
    }
};

const displaySubtitleStreams = (streams) => {
    availableStreams = streams;
    selectedTracks.clear();

    const subtitlesList = document.getElementById('subtitlesList');
    subtitlesList.innerHTML = '';

    if (streams.length === 0) {
        subtitlesList.innerHTML = '<p style="color: #999; text-align: center;">No subtitle tracks found</p>';
        document.getElementById('subtitlesSection').style.display = 'block';
        return;
    }

    streams.forEach((stream) => {
        const item = document.createElement('div');
        item.className = 'subtitle-item';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `subtitle-${stream.index}`;
        checkbox.value = stream.index;
        checkbox.onchange = (e) => {
            if (e.target.checked) {
                selectedTracks.add(parseInt(stream.index));
            } else {
                selectedTracks.delete(parseInt(stream.index));
            }
            updateDownloadButton();
        };

        const label = document.createElement('label');
        label.htmlFor = `subtitle-${stream.index}`;

        const name = document.createElement('div');
        name.className = 'subtitle-name';
        name.textContent = stream.name;

        const info = document.createElement('div');
        info.className = 'subtitle-info';
        info.textContent = `Codec: ${stream.codec}`;

        label.appendChild(name);
        label.appendChild(info);

        item.appendChild(checkbox);
        item.appendChild(label);

        subtitlesList.appendChild(item);
    });

    document.getElementById('subtitlesSection').style.display = 'block';
    updateDownloadButton();
};

const updateDownloadButton = () => {
    const downloadBtn = document.getElementById('downloadBtn');
    downloadBtn.disabled = selectedTracks.size === 0;
};

const showLoadingBar = (message = 'Processing video...') => {
    document.getElementById('loadingBar').style.display = 'block';
    document.getElementById('loadingStatus').style.display = 'block';
    document.getElementById('loadingStatus').textContent = message;
};

const hideLoadingBar = () => {
    document.getElementById('loadingBar').style.display = 'none';
    document.getElementById('loadingStatus').style.display = 'none';
};

const showError = (message) => {
    const errorDiv = document.getElementById('errorMessage');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    setTimeout(() => {
        errorDiv.style.display = 'none';
    }, 5000);
};

const showSuccess = (message) => {
    const successDiv = document.getElementById('successMessage');
    successDiv.textContent = message;
    successDiv.style.display = 'block';
    setTimeout(() => {
        successDiv.style.display = 'none';
    }, 3000);
};

const downloadSRT = (content) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `subtitles_${Date.now()}.srt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showSuccess('Subtitle downloaded successfully!');
};

const mergeSubtitles = async (trackIndices) => {
    // For multiple tracks, we'll extract them sequentially and combine
    const allSubtitles = [];

    for (const trackIndex of trackIndices) {
        const promise = new Promise((resolve) => {
            const messageHandler = (event) => {
                if (event.data.type === 'SUBTITLE_EXTRACTED') {
                    worker.onmessage = null;
                    worker.onmessage = handleWorkerMessage;
                    resolve(event.data.data);
                }
            };
            worker.onmessage = messageHandler;
            worker.postMessage({ type: 'EXTRACT_SUBTITLE', data: { trackIndex } });
        });

        const subtitle = await promise;
        allSubtitles.push(subtitle);
    }

    // Merge all subtitles
    const merged = allSubtitles.join('\n\n');
    downloadSRT(merged);
};

// Event listeners
document.getElementById('videoFile').addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;

    document.getElementById('fileInfo').textContent = `Selected: ${file.name}`;
    showLoadingBar('Analyzing video...');
    selectedTracks.clear();
    availableStreams = [];

    worker.postMessage({ type: 'PROCESS_VIDEO', data: { file } });
});

document.getElementById('downloadBtn').addEventListener('click', () => {
    if (selectedTracks.size === 0) return;

    showLoadingBar('Extracting subtitles...');
    const trackIndices = Array.from(selectedTracks).sort();

    if (trackIndices.length === 1) {
        worker.postMessage({ type: 'EXTRACT_SUBTITLE', data: { trackIndex: trackIndices[0] } });
    } else {
        mergeSubtitles(trackIndices);
    }
});

document.getElementById('clearBtn').addEventListener('click', () => {
    document.getElementById('videoFile').value = '';
    document.getElementById('fileInfo').textContent = '';
    document.getElementById('subtitlesSection').style.display = 'none';
    document.getElementById('errorMessage').style.display = 'none';
    document.getElementById('successMessage').style.display = 'none';
    selectedTracks.clear();
    availableStreams = [];
    hideLoadingBar();
});

// Initialize worker on page load
window.addEventListener('load', () => {
    initWorker();
});
