import './style.css';

let worker;
let selectedTracks = new Set();
let availableStreams = [];
let currentSubtitleContent = '';
let currentSubtitleBlocks = [];

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
    document.getElementById('translationSection').style.display = 'block';
    document.getElementById('translateBtn').style.display = 'none';
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

const extractSubtitlesForProcessing = (trackIndices, callback) => {
    // For multiple tracks, extract them sequentially and combine
    const allSubtitles = [];
    let extracted = 0;

    const extractNext = () => {
        if (extracted >= trackIndices.length) {
            const merged = allSubtitles.join('\n\n');
            currentSubtitleContent = merged;
            currentSubtitleBlocks = parseSubtitleBlocks(merged);
            callback(merged);
            return;
        }

        const trackIndex = trackIndices[extracted];
        extracted++;

        const messageHandler = (event) => {
            if (event.data.type === 'SUBTITLE_EXTRACTED') {
                worker.onmessage = handleWorkerMessage;
                allSubtitles.push(event.data.data);
                extractNext();
            }
        };

        worker.onmessage = messageHandler;
        worker.postMessage({ type: 'EXTRACT_SUBTITLE', data: { trackIndex } });
    };

    extractNext();
};

const downloadSRT = (content) => {
    currentSubtitleContent = content;
    currentSubtitleBlocks = parseSubtitleBlocks(content);
    
    // Show translate button
    document.getElementById('translateBtn').style.display = 'inline-block';
    
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

const parseSubtitleBlocks = (srtContent) => {
    const blocks = [];
    const lines = srtContent.split('\n');
    let currentBlock = { number: '', timing: '', text: [] };
    
    for (const line of lines) {
        const trimmed = line.trim();
        
        if (/^\d+$/.test(trimmed)) {
            if (currentBlock.text.length > 0) {
                blocks.push(currentBlock);
            }
            currentBlock = { number: trimmed, timing: '', text: [] };
        } else if (/^\d{2}:\d{2}:\d{2}/.test(trimmed)) {
            currentBlock.timing = trimmed;
        } else if (trimmed !== '') {
            currentBlock.text.push(trimmed);
        } else if (currentBlock.text.length > 0) {
            if (currentBlock.text.length > 0) {
                blocks.push(currentBlock);
                currentBlock = { number: '', timing: '', text: [] };
            }
        }
    }
    
    if (currentBlock.text.length > 0) {
        blocks.push(currentBlock);
    }
    
    return blocks;
};

const generateAIPrompt = (blocks, targetLanguage) => {
    const lines = blocks.map((block, index) => {
        const textStr = block.text.join(' ');
        return `${index + 1}. ${textStr}`;
    }).join('\n');
    
    const prompt = `Please translate the following subtitle lines from their original language to ${targetLanguage}. Keep each translation on the same line as the number. Maintain the meaning and context, considering the surrounding lines for context. Do not add extra text or change the numbering. IMPORTANT: Do not convert hyphens or dashes (-) into bullet points or lists - preserve them exactly as they appear.

${lines}

After translation, provide only the translated lines in the same format (number. translated text), one per line.`;
    
    return prompt;
};

const generatePromptUI = () => {
    const targetLanguage = document.getElementById('targetLanguage').value;
    if (!targetLanguage) {
        showError('Please select a target language');
        return;
    }

    if (!currentSubtitleBlocks || currentSubtitleBlocks.length === 0) {
        showError('Please extract subtitles first');
        return;
    }
    
    const prompt = generateAIPrompt(currentSubtitleBlocks, targetLanguage);
    document.getElementById('promptTextarea').value = prompt;
    document.getElementById('promptSection').style.display = 'block';
    document.getElementById('mergeSection').style.display = 'block';
};

const mergeTranslations = () => {
    const translatedText = document.getElementById('translatedTextarea').value.trim();
    if (!translatedText) {
        showError('Please paste the translated lines');
        return;
    }
    
    const translatedLines = translatedText.split('\n');
    const result = [];
    let translationIndex = 0;
    
    for (const block of currentSubtitleBlocks) {
        // Find the corresponding translated line
        const lineNum = parseInt(block.number);
        let translation = null;
        
        for (const tLine of translatedLines) {
            if (tLine.match(new RegExp(`^${lineNum}\\.\\s+(.+)`))) {
                translation = tLine.replace(new RegExp(`^${lineNum}\\.\\s+`), '').trim();
                break;
            }
        }
        
        result.push(block.number);
        result.push(block.timing);
        result.push(translation || block.text.join(' '));
        result.push('');
    }
    
    const finalSRT = result.join('\n').trim() + '\n';
    
    const blob = new Blob([finalSRT], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `subtitles_translated_${Date.now()}.srt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    // Reset translation section
    document.getElementById('translatedTextarea').value = '';
    document.getElementById('promptTextarea').value = '';
    document.getElementById('promptSection').style.display = 'none';
    document.getElementById('mergeSection').style.display = 'none';
    document.getElementById('translationSection').style.display = 'none';
    
    showSuccess('Translated subtitle downloaded successfully!');
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
    selectedTracks.clear();
    availableStreams = [];

    // Check if it's an SRT file
    if (file.name.endsWith('.srt')) {
        handleSRTFileUpload(file);
    } else {
        // It's a video file
        showLoadingBar('Analyzing video...');
        worker.postMessage({ type: 'PROCESS_VIDEO', data: { file } });
    }
});

const handleSRTFileUpload = (file) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
        try {
            const content = e.target.result;
            currentSubtitleContent = content;
            currentSubtitleBlocks = parseSubtitleBlocks(content);
            
            // Create a single subtitle stream entry
            availableStreams = [{ 
                index: 0, 
                name: file.name, 
                language: 'Unknown',
                codec: 'srt'
            }];
            
            selectedTracks.add(0);
            displaySubtitleStreams(availableStreams);
            hideLoadingBar();
        } catch (error) {
            showError('Error reading SRT file: ' + error.message);
            hideLoadingBar();
        }
    };
    
    reader.onerror = () => {
        showError('Error reading file');
        hideLoadingBar();
    };
    
    reader.readAsText(file);
};

document.getElementById('downloadBtn').addEventListener('click', () => {
    if (selectedTracks.size === 0) return;

    // If we have currentSubtitleContent already (from SRT upload), just download it
    if (currentSubtitleContent && availableStreams[0] && availableStreams[0].codec === 'srt') {
        downloadSRT(currentSubtitleContent);
        return;
    }

    showLoadingBar('Extracting subtitles...');
    const trackIndices = Array.from(selectedTracks).sort();

    if (trackIndices.length === 1) {
        worker.postMessage({ type: 'EXTRACT_SUBTITLE', data: { trackIndex: trackIndices[0] } });
    } else {
        mergeSubtitles(trackIndices);
    }
});

document.getElementById('translateBtn').addEventListener('click', () => {
    document.getElementById('translationSection').style.display = 'block';
    document.getElementById('promptSection').style.display = 'none';
    document.getElementById('mergeSection').style.display = 'none';
    document.getElementById('translatedTextarea').value = '';
});

document.getElementById('generatePromptBtn').addEventListener('click', () => {
    if (selectedTracks.size === 0) {
        showError('Please select at least one subtitle track');
        return;
    }

    // If we already have subtitle blocks (from SRT upload), skip worker extraction
    if (currentSubtitleBlocks && currentSubtitleBlocks.length > 0 && availableStreams[0] && availableStreams[0].codec === 'srt') {
        generatePromptUI();
        return;
    }

    showLoadingBar('Extracting subtitles...');
    const trackIndices = Array.from(selectedTracks).sort();

    extractSubtitlesForProcessing(trackIndices, (content) => {
        hideLoadingBar();
        generatePromptUI();
    });
});

document.getElementById('copyPromptBtn').addEventListener('click', () => {
    const textarea = document.getElementById('promptTextarea');
    textarea.select();
    document.execCommand('copy');
    showSuccess('Prompt copied to clipboard!');
});

document.getElementById('mergeLinesBtn').addEventListener('click', mergeTranslations);

document.getElementById('backToDownloadBtn').addEventListener('click', () => {
    document.getElementById('translationSection').style.display = 'none';
    document.getElementById('promptSection').style.display = 'none';
    document.getElementById('mergeSection').style.display = 'none';
    document.getElementById('translatedTextarea').value = '';
    document.getElementById('promptTextarea').value = '';
});

document.getElementById('clearBtn').addEventListener('click', () => {
    document.getElementById('videoFile').value = '';
    document.getElementById('fileInfo').textContent = '';
    document.getElementById('subtitlesSection').style.display = 'none';
    document.getElementById('translationSection').style.display = 'none';
    document.getElementById('errorMessage').style.display = 'none';
    document.getElementById('successMessage').style.display = 'none';
    document.getElementById('translateBtn').style.display = 'none';
    selectedTracks.clear();
    availableStreams = [];
    currentSubtitleContent = '';
    currentSubtitleBlocks = [];
    hideLoadingBar();
});

// Initialize worker on page load
window.addEventListener('load', () => {
    initWorker();
});
