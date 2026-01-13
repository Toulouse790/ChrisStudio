// Initialize Socket.IO
const socket = io();

// DOM Elements
const generateForm = document.getElementById('generateForm');
const channelSelect = document.getElementById('channel');
const topicInput = document.getElementById('topic');
const channelDescription = document.getElementById('channelDescription');
const generateBtn = document.getElementById('generateBtn');
const progressCard = document.getElementById('progressCard');
const progressFill = document.getElementById('progressFill');
const progressLog = document.getElementById('progressLog');
const resultCard = document.getElementById('resultCard');
const resultInfo = document.getElementById('resultInfo');
const downloadBtn = document.getElementById('downloadBtn');
const newVideoBtn = document.getElementById('newVideoBtn');
const historyList = document.getElementById('historyList');
const statTotal = document.getElementById('statTotal');
const statWeek = document.getElementById('statWeek');

let currentJobId = null;

// Load channels
async function loadChannels() {
    try {
        const response = await fetch('/api/channels');
        const channels = await response.json();
        
        channelSelect.innerHTML = '<option value="">-- Select a channel --</option>';
        channels.forEach(channel => {
            const option = document.createElement('option');
            option.value = channel.id;
            option.textContent = `${channel.name}`;
            option.dataset.description = channel.description;
            option.dataset.theme = channel.theme;
            channelSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Failed to load channels:', error);
        channelSelect.innerHTML = '<option value="">Error loading channels</option>';
    }
}

// Update channel description
channelSelect.addEventListener('change', (e) => {
    const selected = e.target.selectedOptions[0];
    if (selected && selected.dataset.description) {
        channelDescription.textContent = `📺 ${selected.dataset.description}`;
        channelDescription.style.display = 'block';
        
        // Update placeholder based on channel
        const examples = {
            'what-if': 'e.g., What if humans could breathe underwater?',
            'human-odyssey': 'e.g., The rise and fall of the Roman Empire',
            'classified-files': 'e.g., The mystery of the Bermuda Triangle'
        };
        topicInput.placeholder = examples[selected.value] || 'Enter your video topic...';
    } else {
        channelDescription.style.display = 'none';
    }
});

// Handle form submission
generateForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const channelId = channelSelect.value;
    const topic = topicInput.value.trim();
    const mode = document.getElementById('mode').value;
    
    if (!channelId || !topic) {
        alert('Please select a channel and enter a topic');
        return;
    }
    
    // Disable form
    generateBtn.disabled = true;
    generateBtn.textContent = '⏳ Starting...';
    
    // Show progress card
    progressCard.style.display = 'block';
    resultCard.style.display = 'none';
    progressLog.innerHTML = '';
    updateProgressSteps('script', 'active');
    
    try {
        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ channelId, topic, mode })
        });
        
        const data = await response.json();
        currentJobId = data.jobId;
        
        // Subscribe to job updates
        socket.emit('subscribe', currentJobId);
        
        addLog(`🚀 Generation started (Job ID: ${currentJobId})`);
        addLog(`📺 Channel: ${channelSelect.selectedOptions[0].textContent}`);
        addLog(`📝 Topic: ${topic}`);
        
    } catch (error) {
        console.error('Generation failed:', error);
        addLog(`❌ Error: ${error.message}`, 'error');
        resetForm();
    }
});

// Socket event handlers
socket.on('progress', (data) => {
    addLog(data.message);
    
    // Update progress based on keywords
    const msg = data.message.toLowerCase();
    if (msg.includes('script')) {
        updateProgressSteps('script', 'active');
        updateProgress(20);
    } else if (msg.includes('audio') || msg.includes('voice')) {
        updateProgressSteps('script', 'completed');
        updateProgressSteps('audio', 'active');
        updateProgress(40);
    } else if (msg.includes('collecting') || msg.includes('assets')) {
        updateProgressSteps('audio', 'completed');
        updateProgressSteps('assets', 'active');
        updateProgress(60);
    } else if (msg.includes('download')) {
        updateProgressSteps('assets', 'completed');
        updateProgressSteps('download', 'active');
        updateProgress(75);
    } else if (msg.includes('compos') || msg.includes('ffmpeg')) {
        updateProgressSteps('download', 'completed');
        updateProgressSteps('compose', 'active');
        updateProgress(90);
    }
});

socket.on('complete', (data) => {
    addLog('✅ Video generation complete!', 'success');
    updateProgressSteps('compose', 'completed');
    updateProgress(100);
    
    setTimeout(() => {
        progressCard.style.display = 'none';
        showResult(data);
        resetForm();
        loadHistory();
    }, 2000);
});

socket.on('error', (data) => {
    addLog(`❌ Error: ${data.error}`, 'error');
    resetForm();
});

// Helper functions
function addLog(message, type = 'info') {
    const p = document.createElement('p');
    p.textContent = message;
    if (type === 'error') p.style.color = 'var(--error)';
    if (type === 'success') p.style.color = 'var(--success)';
    progressLog.appendChild(p);
    progressLog.scrollTop = progressLog.scrollHeight;
}

function updateProgress(percent) {
    progressFill.style.width = `${percent}%`;
}

function updateProgressSteps(step, status) {
    const stepEl = document.querySelector(`[data-step="${step}"]`);
    if (stepEl) {
        stepEl.classList.remove('active', 'completed');
        if (status) stepEl.classList.add(status);
    }
}

function showResult(data) {
    resultCard.style.display = 'block';
    resultInfo.innerHTML = `
        <p><strong>🎬 Video Path:</strong> ${data.videoPath}</p>
        <p><strong>⏱️ Generation Time:</strong> ~7-10 minutes</p>
        <p><strong>📊 Quality:</strong> 1080p, 30fps</p>
    `;
    
    // Extract filename from path for download API
    const filename = data.videoPath.split('/').pop();
    downloadBtn.href = `/api/download/video/${filename}`;
    downloadBtn.download = filename;
}

function resetForm() {
    generateBtn.disabled = false;
    generateBtn.textContent = '🚀 Generate Video';
    currentJobId = null;
}

newVideoBtn.addEventListener('click', () => {
    resultCard.style.display = 'none';
    progressCard.style.display = 'none';
    topicInput.value = '';
    progressFill.style.width = '0%';
    document.querySelectorAll('.step').forEach(el => {
        el.classList.remove('active', 'completed');
    });
});

// Load history
async function loadHistory() {
    try {
        const response = await fetch('/api/history');
        const history = await response.json();
        
        if (history.length === 0) {
            historyList.innerHTML = '<p class="loading">No videos generated yet</p>';
            statTotal.textContent = '0';
            statWeek.textContent = '0';
            return;
        }
        
        // Update stats
        statTotal.textContent = history.length;
        const weekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        statWeek.textContent = history.filter(h => h.timestamp > weekAgo).length;
        
        // Render history
        historyList.innerHTML = history.slice(0, 10).map(item => {
            const date = new Date(item.timestamp);
            const channelClass = `badge-${item.channel}`;
            
            return `
                <div class="history-item">
                    <h4>${item.title}</h4>
                    <div class="history-meta">
                        <span class="history-badge ${channelClass}">${item.channel}</span>
                        <span>📅 ${date.toLocaleDateString()}</span>
                        <span>🕐 ${date.toLocaleTimeString()}</span>
                    </div>
                    <div class="history-actions">
                        ${item.hasVideo ? `<a href="/api/download/video/${item.videoPath.split('/').pop()}" download class="action-link">🎬 Video</a>` : ''}
                        ${item.hasAudio ? `<a href="${item.audioPath}" target="_blank" class="action-link">🎵 Audio</a>` : ''}
                        <a href="${item.scriptPath}" target="_blank" class="action-link">📄 Script</a>
                    </div>
                </div>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Failed to load history:', error);
        historyList.innerHTML = '<p class="loading">Error loading history</p>';
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadChannels();
    loadHistory();
    
    // Refresh history every 30 seconds
    setInterval(loadHistory, 30000);
});
