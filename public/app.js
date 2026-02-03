// Initialize Socket.IO
const socket = io();

// DOM Elements
const generateForm = document.getElementById('generateForm');
const channelSelect = document.getElementById('channel');
const topicInput = document.getElementById('topic');
const generateTopicBtn = document.getElementById('generateTopicBtn');
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

// YouTube publish UI
const ytStatusText = document.getElementById('ytStatusText');
const ytConnectBtn = document.getElementById('ytConnectBtn');
const ytPublishBtn = document.getElementById('ytPublishBtn');
const ytTitle = document.getElementById('ytTitle');
const ytDescription = document.getElementById('ytDescription');
const ytTags = document.getElementById('ytTags');
const ytCategoryId = document.getElementById('ytCategoryId');
const ytPrivacy = document.getElementById('ytPrivacy');
const ytLog = document.getElementById('ytLog');
const ytProgressBar = document.getElementById('ytProgressBar');
const ytProgressFill = document.getElementById('ytProgressFill');
const ytChecks = document.getElementById('ytChecks');
const ytFixActions = document.getElementById('ytFixActions');

let currentJobId = null;
let currentVideoPath = null;
let currentScriptPath = null;
let currentPublishJobId = null;
let ytConnected = false;
let activeFixJobId = null;
let lastGenerationChannelId = null;
let lastGenerationTopic = null;

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
        const examples =Ex: Et si les humains pouvaient respirer sous l\'eau ?',
            'human-odyssey': 'Ex: L\'essor et la chute de l\'Empire romain',
            'classified-files': 'Ex: Le mystère du Triangle des Bermudes'
        };
        topicInput.placeholder = examples[selected.value] || 'Entrez le sujet de votre vidéo...';
    } else {
        channelDescription.style.display = 'none';
    }
});

// Generate topic automatically using AI
generateTopicBtn.addEventListener('click', async () => {
    const channelId = channelSelect.value;
    
    if (!channelId) {
        alert('Veuillez d\'abord sélectionner une chaîne');
        return;
    }
    
    // Disable button and show loading
    generateTopicBtn.disabled = true;
    generateTopicBtn.innerHTML = '⏳ Génération...';
    topicInput.disabled = true;
    
    try {
        const response = await fetch(`/api/topics/${channelId}?count=1`);
        if (!response.ok) throw new Error('Failed to generate topic');
        
        const data = await response.json();
        if (data.suggestions && data.suggestions.length > 0) {
            topicInput.value = data.suggestions[0].topic;
            
            // Show a nice notification
            const notification = document.createElement('div');
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 1rem 1.5rem;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                z-index: 9999;
                animation: slideIn 0.3s ease-out;
            `;
            notification.innerHTML = `
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <span style="font-size: 1.5rem;">✨</span>
                    <div>
                        <div style="font-weight: 600;">Sujet généré !</div>
                        <div style="font-size: 0.875rem; opacity: 0.9;">Score viral: ${data.suggestions[0].viralScore}/10</div>
                    </div>
                </div>
            `;
            document.body.appendChild(notification);
            setTimeout(() => notification.remove(), 3000);
        }
    } catch (error) {
        console.error('Error generating topic:', error);
        alert('Erreur lors de la génération du sujet. Veuillez réessayer.');
    } finally {
        generateTopicBtn.disabled = false;
        generateTopicBtn.innerHTML = '✨ Générer';
        topicInput.disabled = false
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
        lastGenerationChannelId = channelId;
        lastGenerationTopic = topic;
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

    // If we're running a fix job from the pre-publish panel, mirror logs there too.
    if (activeFixJobId) {
        ytAddLog(data.message);
    }
    
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
    if (activeFixJobId) {
        ytAddLog(`❌ Fix failed: ${data.error}`, 'error');
        activeFixJobId = null;
        runPrepublishChecks();
    }
    resetForm();
});

// YouTube socket handlers (only received when subscribed to yt-{publishJobId})
socket.on('yt:status', (data) => {
    if (!currentPublishJobId) return;
    const status = data.status || 'uploading';
    const progress = Number.isFinite(data.progress) ? data.progress : 0;
    ytProgressBar.style.display = 'block';
    ytProgressFill.style.width = `${Math.max(0, Math.min(100, progress))}%`;
    ytAddLog(`📤 ${status} — ${progress}%`);
});

socket.on('yt:done', (data) => {
    if (!currentPublishJobId) return;
    ytProgressBar.style.display = 'block';
    ytProgressFill.style.width = '100%';
    ytAddLog(`✅ Published! Video ID: ${data.videoId}`, 'success');
    if (data.videoUrl) {
        ytAddLog(`🔗 ${data.videoUrl}`, 'success');
    }
    if (data.warning) {
        ytAddLog(`⚠️  ${data.warning}`, 'error');
    }
    if (data.appliedPrivacyStatus) {
        ytAddLog(`ℹ️  Applied privacy: ${data.appliedPrivacyStatus}`);
    }
    currentPublishJobId = null;
    ytPublishBtn.disabled = false;
    refreshYouTubeStatus();
});

socket.on('yt:error', (data) => {
    if (!currentPublishJobId) return;
    const msg = data.error || 'Upload failed';
    if (msg === 'AUTH_REQUIRED') {
        ytAddLog('🔐 YouTube auth required. Click “Connect YouTube” first.', 'error');
        ytConnected = false;
        refreshYouTubeStatus();
    } else {
        ytAddLog(`❌ ${msg}`, 'error');
    }
    ytPublishBtn.disabled = false;
    currentPublishJobId = null;
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

    currentVideoPath = data.videoPath;
    currentScriptPath = data.scriptPath || null;

    // Reset YouTube UI state
    ytLog.innerHTML = '';
    ytProgressBar.style.display = 'none';
    ytProgressFill.style.width = '0%';
    ytPublishBtn.disabled = true;
    currentPublishJobId = null;
    activeFixJobId = null;

    // Reset checks UI
    if (ytChecks) {
        ytChecks.innerHTML = '<p class="loading">Chargement des checks…</p>';
    }
    if (ytFixActions) {
        ytFixActions.innerHTML = '';
    }

    // Prefill metadata from script if available
    prefillYouTubeMetadata(data).finally(async () => {
        await refreshYouTubeStatus();
        await runPrepublishChecks();
    });
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

async function refreshYouTubeStatus() {
    try {
        const resp = await fetch('/api/youtube/status');
        const status = await resp.json();

        // status: { hasCredentials, connected, tokensPath }
        if (!status.hasCredentials) {
            ytConnected = false;
            ytStatusText.textContent = 'YouTube not configured. Add OAuth client JSON at ./secrets/youtube_oauth_client.json';
            ytConnectBtn.disabled = true;
            ytPublishBtn.disabled = true;
            return;
        }

        ytConnected = !!status.connected;
        if (ytConnected) {
            ytStatusText.textContent = '✅ YouTube connected. Ready to publish.';
            ytConnectBtn.disabled = false;
            ytConnectBtn.textContent = '🔄 Reconnect YouTube';
            // Publish button is gated by prepublish checks too.
            // runPrepublishChecks() will set the final enabled/disabled state.
            ytPublishBtn.disabled = !currentVideoPath;
        } else {
            ytStatusText.textContent = '🔐 Not connected to YouTube yet.';
            ytConnectBtn.disabled = false;
            ytConnectBtn.textContent = '🔐 Connect YouTube';
            ytPublishBtn.disabled = true;
        }
    } catch (e) {
        ytConnected = false;
        ytStatusText.textContent = '⚠️ Failed to check YouTube status.';
        ytConnectBtn.disabled = false;
        ytPublishBtn.disabled = true;
    }
}

function getCurrentMetadataForChecks() {
    const title = (ytTitle.value || '').trim();
    const description = (ytDescription.value || '').trim();
    const tags = (ytTags.value || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
        .slice(0, 50);
    return { title, description, tags };
}

function renderPrepublishChecks(report) {
    if (!ytChecks) return;

    const items = (report?.checks || []).map(c => {
        const ok = !!c.ok;
        const details = c.details ? `<div class="check-details">${escapeHtml(c.details)}</div>` : '';
        return `
            <div class="check-item ${ok ? 'ok' : 'bad'}">
                <div class="check-left">
                    <div class="check-title">${escapeHtml(c.label)}</div>
                    ${details}
                </div>
                <div class="check-badge ${ok ? 'ok' : 'bad'}">${ok ? 'OK' : 'KO'}</div>
            </div>
        `;
    }).join('');

    ytChecks.innerHTML = items || '<p class="loading">Aucun check</p>';

    // Actions: show only for failing checks (dedup by kind)
    if (ytFixActions) {
        const actions = [];
        (report?.checks || []).forEach(c => {
            if (!c.ok && Array.isArray(c.actions)) {
                c.actions.forEach(a => actions.push(a));
            }
        });

        const dedup = new Map();
        actions.forEach(a => {
            const key = `${a.kind}:${JSON.stringify(a.payload || {})}`;
            if (!dedup.has(key)) dedup.set(key, a);
        });

        ytFixActions.innerHTML = '';
        Array.from(dedup.values()).forEach(a => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'btn-secondary';
            btn.textContent = a.label;
            btn.addEventListener('click', () => handleFixAction(a));
            ytFixActions.appendChild(btn);
        });
    }

    // Gate Publish button
    const allOk = !!report?.ok;
    if (ytPublishBtn) {
        ytPublishBtn.disabled = !(ytConnected && currentVideoPath && allOk) || !!activeFixJobId;
    }
}

async function runPrepublishChecks() {
    if (!currentVideoPath || !ytChecks) return;

    try {
        const metadata = getCurrentMetadataForChecks();
        const resp = await fetch('/api/prepublish/validate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ videoPath: currentVideoPath, metadata })
        });
        const data = await resp.json();
        if (!resp.ok) {
            throw new Error(data.error || 'Validation failed');
        }
        renderPrepublishChecks(data);
    } catch (e) {
        ytChecks.innerHTML = `<p style="color: var(--error);">❌ Checks failed: ${escapeHtml(e.message || e)}</p>`;
        if (ytPublishBtn) ytPublishBtn.disabled = true;
    }
}

async function handleFixAction(action) {
    if (!currentVideoPath) return;

    if (action.kind === 'regen_full') {
        if (!lastGenerationChannelId || !lastGenerationTopic) {
            ytAddLog('❌ Impossible de relancer: channel/topic inconnus.', 'error');
            return;
        }
        ytAddLog('🔁 Relance génération complète (plus long) — nouveau projet.', 'info');
        // Trigger full generation again using the main form logic
        channelSelect.value = lastGenerationChannelId;
        topicInput.value = lastGenerationTopic;
        generateForm.dispatchEvent(new Event('submit', { cancelable: true }));
        return;
    }

    const payload = action.payload || {};
    const forceImagesOnly = action.kind === 'regen_assets_images_only';
    const minClips = action.kind === 'regen_assets_more_clips' ? (payload.minClips || 10) : undefined;

    try {
        ytAddLog('🔧 Démarrage correction: regeneration assets…');
        ytPublishBtn.disabled = true;
        activeFixJobId = '__starting__';

        const resp = await fetch('/api/prepublish/regenerate-assets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                videoPath: currentVideoPath,
                forceImagesOnly,
                minClips
            })
        });
        const data = await resp.json();
        if (!resp.ok) {
            throw new Error(data.error || 'Regeneration failed');
        }

        activeFixJobId = data.jobId;
        socket.emit('subscribe', activeFixJobId);
        ytAddLog(`📡 Fix job started: ${activeFixJobId}`);
    } catch (e) {
        activeFixJobId = null;
        ytAddLog(`❌ ${e.message || e}`, 'error');
        await runPrepublishChecks();
    }
}

let checksDebounce = null;
function scheduleChecks() {
    if (!currentVideoPath) return;
    if (checksDebounce) clearTimeout(checksDebounce);
    checksDebounce = setTimeout(() => runPrepublishChecks(), 350);
}

// Re-run checks when metadata changes
[ytTitle, ytDescription, ytTags, ytCategoryId, ytPrivacy].forEach(el => {
    if (!el) return;
    el.addEventListener('input', scheduleChecks);
    el.addEventListener('change', scheduleChecks);
});

function escapeHtml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

ytConnectBtn.addEventListener('click', async () => {
    try {
        ytAddLog('🔐 Starting YouTube OAuth…');
        const resp = await fetch('/api/youtube/connect');
        const data = await resp.json();
        if (!data.url) {
            ytAddLog('❌ Failed to get OAuth URL.', 'error');
            return;
        }

        ytAddLog('➡️ Opening Google consent screen…');
        window.open(data.url, '_blank');
        ytAddLog('After approving, come back here and click Publish.');

        // Poll status for a bit (user may complete auth quickly)
        for (let i = 0; i < 10; i++) {
            await new Promise(r => setTimeout(r, 1200));
            await refreshYouTubeStatus();
            if (ytConnected) break;
        }
    } catch (e) {
        ytAddLog(`❌ OAuth start failed: ${e.message || e}`, 'error');
    }
});

ytPublishBtn.addEventListener('click', async () => {
    if (!currentVideoPath) {
        ytAddLog('❌ No MP4 available to publish.', 'error');
        return;
    }
    if (!ytConnected) {
        ytAddLog('🔐 Please connect YouTube first.', 'error');
        return;
    }

    const title = (ytTitle.value || '').trim();
    const description = (ytDescription.value || '').trim();
    const tags = (ytTags.value || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
        .slice(0, 50);

    const categoryId = (ytCategoryId.value || '22').trim();
    const privacyStatus = ytPrivacy.value;

    if (!title) {
        ytAddLog('❌ Title is required.', 'error');
        return;
    }

    ytPublishBtn.disabled = true;
    ytProgressBar.style.display = 'block';
    ytProgressFill.style.width = '0%';
    ytAddLog('🚀 Starting upload…');

    try {
        const resp = await fetch('/api/youtube/publish', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                videoPath: currentVideoPath,
                metadata: { title, description, tags, categoryId, privacyStatus }
            })
        });
        const data = await resp.json();
        if (!resp.ok) {
            // If server refused due to prepublish checks, render them.
            if (data && data.report && data.report.checks) {
                renderPrepublishChecks(data.report);
                ytAddLog('⛔ Publication bloquée: checks pré-upload en échec.', 'error');
            }
            throw new Error(data.error || 'Publish failed');
        }

        currentPublishJobId = data.publishJobId;
        socket.emit('subscribe-youtube', currentPublishJobId);
        ytAddLog(`📡 Upload job started: ${currentPublishJobId}`);
    } catch (e) {
        ytAddLog(`❌ ${e.message || e}`, 'error');
        ytPublishBtn.disabled = false;
        currentPublishJobId = null;
    }
});

function ytAddLog(message, type = 'info') {
    const p = document.createElement('p');
    p.textContent = message;
    if (type === 'error') p.style.color = 'var(--error)';
    if (type === 'success') p.style.color = 'var(--success)';
    ytLog.appendChild(p);
    ytLog.scrollTop = ytLog.scrollHeight;
}

async function prefillYouTubeMetadata(data) {
    try {
        // Prefer provided scriptPath from server; else derive from video path.
        const scriptUrl = data.scriptPath || (data.videoPath
            .replace('/output/videos/', '/output/scripts/')
            .replace(/\.mp4$/i, '.json'));

        const resp = await fetch(scriptUrl);
        if (!resp.ok) throw new Error('No script JSON');
        const script = await resp.json();

        if (script?.title) ytTitle.value = script.title;

        // Default description: keep it simple and editable.
        const descParts = [];
        if (script?.hook) descParts.push(script.hook);
        if (script?.conclusion) descParts.push('\n\n' + script.conclusion);
        ytDescription.value = descParts.join('').trim();

        const tagText = `${script?.title || ''} ${script?.hook || ''} ${script?.sections?.map(s => s.searchQuery).join(' ') || ''}`;
        const tags = deriveTags(tagText).slice(0, 25);
        ytTags.value = tags.join(', ');
    } catch {
        // Fallback defaults
        if (!ytTitle.value) ytTitle.value = 'New Video';
        if (!ytDescription.value) ytDescription.value = '';
        if (!ytTags.value) ytTags.value = '';
    }
}

function deriveTags(text) {
    const stop = new Set(['the','and','for','with','this','that','from','into','over','under','about','your','you','are','was','were','has','have','had','will','its','our','their','they','them','his','her','she','him','who','what','when','where','why','how','not','yes','more','most','less','many','much','new','old']);
    return Array.from(new Set(
        (text || '')
            .toLowerCase()
            .replace(/[^a-z0-9\s]+/g, ' ')
            .split(/\s+/g)
            .map(s => s.trim())
            .filter(Boolean)
            .filter(s => s.length > 2)
            .filter(s => !stop.has(s))
    ));
}

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
    refreshYouTubeStatus();
    
    // Refresh history every 30 seconds
    setInterval(loadHistory, 30000);
});
