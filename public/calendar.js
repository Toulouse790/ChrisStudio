const socket = io();

let channels = [];
let videos = [];
let currentFilter = 'all';

// Load channels
async function loadChannels() {
  const response = await fetch('/api/channels');
  channels = await response.json();
  
  const select = document.getElementById('channelSelect');
  channels.forEach(channel => {
    const option = document.createElement('option');
    option.value = channel.id;
    option.textContent = `${channel.name} - ${channel.description}`;
    select.appendChild(option);
  });
}

// Load schedule
async function loadSchedule() {
  const response = await fetch('/api/schedule?days=90');
  videos = await response.json();
  renderCalendar();
}

// Render calendar
function renderCalendar() {
  const grid = document.getElementById('calendarGrid');
  
  const filteredVideos = currentFilter === 'all' 
    ? videos 
    : videos.filter(v => v.status === currentFilter);
  
  if (filteredVideos.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <h3>📭 Aucune vidéo ${currentFilter === 'all' ? '' : currentFilter}</h3>
        <p>Planifiez votre première vidéo ci-dessus</p>
      </div>
    `;
    return;
  }

  // Sort by date
  filteredVideos.sort((a, b) => new Date(a.scheduledDate) - new Date(b.scheduledDate));

  grid.innerHTML = filteredVideos.map(video => {
    const channel = channels.find(c => c.id === video.channelId);
    const date = new Date(video.scheduledDate);
    const dateStr = date.toLocaleString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    return `
      <div class="video-card" data-id="${video.id}">
        <div class="video-header">
          <div class="video-date">${dateStr}</div>
          <div class="video-status status-${video.status}">${getStatusLabel(video.status)}</div>
        </div>
        
        <div class="video-title">${video.topic}</div>
        <div class="video-channel">${channel?.name || video.channelId}</div>
        
        ${video.status === 'ready' && video.videoPath ? `
          ${video.metadata ? `
            <div style="margin: 1rem 0; padding: 0.75rem; background: rgba(99, 102, 241, 0.1); border-radius: 8px; font-size: 0.875rem;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span>📊 SEO Score: <strong>${video.metadata.seoScore}/100</strong></span>
                <span>${video.metadata.seoScore >= 80 ? '🎯' : video.metadata.seoScore >= 60 ? '👍' : '📈'}</span>
              </div>
              ${video.metadata.trendingKeywords?.length > 0 ? `
                <div style="margin-top: 0.5rem; color: var(--text-secondary);">
                  🔥 ${video.metadata.trendingKeywords.slice(0, 3).join(', ')}
                </div>
              ` : ''}
            </div>
          ` : ''}
          <div class="video-actions">
            <button class="action-btn btn-preview" onclick="previewVideo('${video.id}', '${video.videoPath}')">
              👁️ Prévisualiser
            </button>
            <button class="action-btn btn-publish" onclick="openPublish('${video.id}', '${video.topic}')">
              📤 Publier
            </button>
            <button class="action-btn btn-delete" onclick="deleteVideo('${video.id}')">
              🗑️
            </button>
          </div>
        ` : ''}
        
        ${video.status === 'generating' ? `
          <div class="progress-container">
            <div class="progress-bar">
              <div class="progress-fill" style="width: 50%"></div>
            </div>
          </div>
        ` : ''}
        
        ${video.status === 'published' && video.youtubeUrl ? `
          <div class="video-actions">
            <a href="${video.youtubeUrl}" target="_blank" class="action-btn btn-preview">
              🎬 Voir sur YouTube
            </a>
          </div>
        ` : ''}
        
        ${video.status === 'failed' && video.error ? `
          <div style="color: #ef4444; font-size: 0.875rem; margin-top: 0.5rem;">
            ❌ ${video.error}
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
}

function getStatusLabel(status) {
  const labels = {
    pending: 'En attente',
    generating: 'Génération',
    ready: 'Prête',
    published: 'Publiée',
    failed: 'Échec'
  };
  return labels[status] || status;
}

// Schedule new video
document.getElementById('scheduleForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const channelId = document.getElementById('channelSelect').value;
  const topic = document.getElementById('topicInput').value;
  const date = document.getElementById('scheduleDateInput').value;
  
  try {
    const response = await fetch('/api/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelId, topic, date })
    });
    
    if (response.ok) {
      document.getElementById('scheduleForm').reset();
      await loadSchedule();
      alert('✅ Vidéo planifiée avec succès !');
    } else {
      const error = await response.json();
      alert('❌ Erreur: ' + error.error);
    }
  } catch (error) {
    alert('❌ Erreur de connexion');
  }
});

// Filter buttons
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    renderCalendar();
  });
});

// Preview video
function previewVideo(videoId, videoPath) {
  const modal = document.getElementById('previewModal');
  const video = document.getElementById('previewVideo');
  video.src = '/' + videoPath;
  modal.classList.add('active');
}

function closePreview() {
  const modal = document.getElementById('previewModal');
  const video = document.getElementById('previewVideo');
  video.pause();
  video.src = '';
  modal.classList.remove('active');
}

// Publish to YouTube
async function openPublish(videoId, topic) {
  const modal = document.getElementById('publishModal');
  document.getElementById('publishVideoId').value = videoId;
  
  // Load optimized metadata
  try {
    const response = await fetch(`/api/schedule/${videoId}/metadata`);
    if (response.ok) {
      const metadata = await response.json();
      
      document.getElementById('youtubeTitle').value = metadata.title || topic;
      document.getElementById('youtubeDescription').value = metadata.description || `${topic}\n\nGenerated by YouTube Creator Studio`;
      document.getElementById('youtubeTags').value = metadata.tags?.join(', ') || '';
      
      // Show SEO score if available
      if (metadata.seoScore) {
        showSEOScore(metadata.seoScore, metadata.trendingKeywords || []);
      }
    } else {
      // Fallback to basic data
      document.getElementById('youtubeTitle').value = topic;
      document.getElementById('youtubeDescription').value = `${topic}\n\nGenerated by YouTube Creator Studio`;
      document.getElementById('youtubeTags').value = '';
    }
  } catch (error) {
    console.error('Failed to load metadata:', error);
    document.getElementById('youtubeTitle').value = topic;
    document.getElementById('youtubeDescription').value = `${topic}\n\nGenerated by YouTube Creator Studio`;
  }
  
  modal.classList.add('active');
}

function showSEOScore(score, trendingKeywords) {
  const existingScore = document.getElementById('seoScoreDisplay');
  if (existingScore) existingScore.remove();
  
  const scoreHtml = `
    <div id="seoScoreDisplay" style="margin-bottom: 1rem; padding: 1rem; background: rgba(99, 102, 241, 0.1); border-radius: 8px;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <strong>📊 SEO Score: ${score}/100</strong>
          <div style="margin-top: 0.5rem; font-size: 0.875rem; color: var(--text-secondary);">
            ${score >= 80 ? '✅ Excellent optimization!' : score >= 60 ? '👍 Good optimization' : '⚠️ Needs improvement'}
          </div>
        </div>
        <div style="font-size: 2rem;">${score >= 80 ? '🎯' : score >= 60 ? '👍' : '📈'}</div>
      </div>
      ${trendingKeywords.length > 0 ? `
        <div style="margin-top: 0.5rem; font-size: 0.875rem;">
          🔥 Trending: ${trendingKeywords.join(', ')}
        </div>
      ` : ''}
    </div>
  `;
  
  const form = document.getElementById('publishForm');
  form.insertAdjacentHTML('afterbegin', scoreHtml);
}

function closePublish() {
  document.getElementById('publishModal').classList.remove('active');
}

document.getElementById('publishForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const videoId = document.getElementById('publishVideoId').value;
  const config = {
    title: document.getElementById('youtubeTitle').value,
    description: document.getElementById('youtubeDescription').value,
    tags: document.getElementById('youtubeTags').value.split(',').map(t => t.trim()),
    category: document.getElementById('youtubeCategory').value,
    privacy: document.getElementById('youtubePrivacy').value
  };
  
  try {
    const response = await fetch('/api/youtube/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId, config })
    });
    
    if (response.ok) {
      const result = await response.json();
      closePublish();
      await loadSchedule();
      alert('✅ Vidéo publiée sur YouTube !\n\n' + result.youtubeUrl);
      window.open(result.youtubeUrl, '_blank');
    } else {
      const error = await response.json();
      alert('❌ Erreur: ' + error.error);
    }
  } catch (error) {
    alert('❌ Erreur de connexion');
  }
});

// Delete video
async function deleteVideo(videoId) {
  if (!confirm('Êtes-vous sûr de vouloir supprimer cette vidéo ?')) {
    return;
  }
  
  try {
    const response = await fetch(`/api/schedule/${videoId}`, {
      method: 'DELETE'
    });
    
    if (response.ok) {
      await loadSchedule();
    } else {
      alert('❌ Erreur lors de la suppression');
    }
  } catch (error) {
    alert('❌ Erreur de connexion');
  }
}

// WebSocket updates
socket.on('schedule-update', (data) => {
  console.log('📅 Schedule updated:', data);
  loadSchedule();
});

socket.on('video-ready', (data) => {
  console.log('✅ Video ready:', data);
  loadSchedule();
  
  // Show notification
  if (Notification.permission === 'granted') {
    new Notification('🎬 Vidéo prête !', {
      body: data.topic,
      icon: '/favicon.ico'
    });
  }
});

// Request notification permission
if (Notification.permission === 'default') {
  Notification.requestPermission();
}

// Initialize
loadChannels();
loadSchedule();

// Auto-refresh every 30 seconds
setInterval(loadSchedule, 30000);
