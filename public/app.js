/* ═══════════════════════════════════════════════════════
   GrabIt — Frontend Application Logic
   ═══════════════════════════════════════════════════════ */

// ─── State ──────────────────────────────────────────────
let currentVideoInfo = null;
let selectedFormat = null;
let isDownloading = false;

// ─── DOM Elements ───────────────────────────────────────
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

const urlInput = $('#urlInput');
const grabBtn = $('#grabBtn');
const inputWrapper = $('#inputWrapper');
const inputIcon = $('#inputIcon');
const inputHint = $('#inputHint');
const platformsGrid = $('#platformsGrid');
const modalOverlay = $('#modalOverlay');
const modalLoading = $('#modalLoading');
const modalContent = $('#modalContent');
const modalClose = $('#modalClose');
const formatSelector = $('#formatSelector');
const watermarkCheckbox = $('#watermarkCheckbox');
const watermarkLabel = $('#watermarkLabel');
const watermarkHint = $('#watermarkHint');
const downloadBtn = $('#downloadBtn');
const downloadProgress = $('#downloadProgress');
const progressFill = $('#progressFill');
const progressText = $('#progressText');
const toastContainer = $('#toastContainer');
const navbar = $('#navbar');

// ─── Monetization ─────────────────────────────────────────
// Set your VPN affiliate link here to show the promo banner.
// Leave as '' to keep it hidden until you join a program.
const AFFILIATE_VPN_URL = '';

function initAffiliate() {
    if (!AFFILIATE_VPN_URL) return;
    const section = $('#vpn-promo');
    const link = $('#affiliateVpnLink');
    if (section && link) {
        link.href = AFFILIATE_VPN_URL;
        section.hidden = false;
    }
}

// ─── Init ───────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    initParticles();
    loadPlatforms();
    initInputListeners();
    initScrollEffects();
    initCountAnimations();
    initModalListeners();
    initWatermarkToggle();
    initNavToggle();
    initShareButtons();
    initAffiliate();
    checkServerHealth();
});

// ─── Dynamic platform counts (single source of truth: /api/platforms) ──
function updatePlatformCounts(n) {
    if (!n || n < 1) return;
    const hero = $('#heroPlatformCount');
    if (hero) hero.textContent = `Supports ${n} Platforms`;
    const uni = $('#universalPlatformCount');
    if (uni) uni.textContent = n;
    const stat = $('#statPlatforms');
    if (stat) {
        stat.dataset.count = n;
        stat.textContent = n;
    }
}

// ─── Particles Background ───────────────────────────────
function initParticles() {
    const container = $('#bgParticles');
    const count = 30;
    for (let i = 0; i < count; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = `${Math.random() * 100}%`;
        particle.style.animationDelay = `${Math.random() * 8}s`;
        particle.style.animationDuration = `${6 + Math.random() * 6}s`;
        particle.style.opacity = `${0.2 + Math.random() * 0.5}`;
        const colors = ['#4f7df9', '#e040fb', '#00e5ff', '#00e676'];
        particle.style.background = colors[Math.floor(Math.random() * colors.length)];
        container.appendChild(particle);
    }
}

// ─── Load Platforms ─────────────────────────────────────
async function loadPlatforms() {
    try {
        const res = await fetch('/api/platforms');
        const data = await res.json();
        if (data.success) {
            renderPlatforms(data.platforms);
            updatePlatformCounts(data.platforms.length);
        }
    } catch {
        renderFallbackPlatforms();
    }
}

function renderPlatforms(platforms) {
    platformsGrid.innerHTML = '';
    platforms.forEach((p, i) => {
        const card = document.createElement('div');
        card.className = 'platform-card';
        card.style.setProperty('--platform-color', p.color);
        card.style.animationDelay = `${i * 0.05}s`;
        const logoHtml = p.logo
            ? `<img class="platform-logo" src="${p.logo}" alt="${p.name}" onerror="this.style.display='none';this.nextElementSibling.style.display='block';"><span class="platform-icon" style="display:none">${p.icon}</span>`
            : `<span class="platform-icon">${p.icon}</span>`;
        card.innerHTML = `
      ${logoHtml}
      <span class="platform-name">${p.name}</span>
      ${p.hasWatermark ? '<span class="platform-badge">WM Remove</span>' : ''}
    `;
        platformsGrid.appendChild(card);
    });
}

function renderFallbackPlatforms() {
    const fallback = [
        { icon: '▶', logo: 'https://cdn.simpleicons.org/youtube/FF0000', name: 'YouTube', color: '#FF0000' },
        { icon: '♪', logo: 'https://cdn.simpleicons.org/tiktok/white', name: 'TikTok', color: '#00F2EA', hasWatermark: true },
        { icon: '📷', logo: 'https://cdn.simpleicons.org/instagram/E4405F', name: 'Instagram', color: '#E4405F' },
        { icon: 'f', logo: 'https://cdn.simpleicons.org/facebook/1877F2', name: 'Facebook', color: '#1877F2' },
        { icon: '⬆', logo: 'https://cdn.simpleicons.org/reddit/FF4500', name: 'Reddit', color: '#FF4500' },
        { icon: '📌', logo: 'https://cdn.simpleicons.org/pinterest/E60023', name: 'Pinterest', color: '#E60023' },
        { icon: '▷', logo: 'https://cdn.simpleicons.org/vimeo/1AB7EA', name: 'Vimeo', color: '#1AB7EA' },
        { icon: '🎮', logo: 'https://cdn.simpleicons.org/twitch/9146FF', name: 'Twitch', color: '#9146FF' },
        { icon: '✦', logo: 'https://cdn.simpleicons.org/openai/10A37F', name: 'Sora 2', color: '#10A37F', hasWatermark: true },
        { icon: '☁', logo: 'https://cdn.simpleicons.org/soundcloud/FF5500', name: 'SoundCloud', color: '#FF5500' },
        { icon: '📸', logo: 'https://cdn.simpleicons.org/imgur/1BB76E', name: 'Imgur', color: '#1BB76E' },
    ];
    renderPlatforms(fallback);
}

// ─── Input Listeners ────────────────────────────────────
function initInputListeners() {
    urlInput.addEventListener('input', onUrlChange);
    urlInput.addEventListener('paste', (e) => {
        setTimeout(onUrlChange, 50);
    });
    grabBtn.addEventListener('click', onGrab);
    urlInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !grabBtn.disabled) {
            onGrab();
        }
    });
}

function onUrlChange() {
    const url = urlInput.value.trim();
    const isValid = isValidUrl(url);
    grabBtn.disabled = !isValid;

    if (isValid) {
        const platform = detectPlatformFromUrl(url);
        if (platform) {
            if (platform.logo) {
                inputIcon.innerHTML = `<img src="${platform.logo}" alt="${platform.name}" style="width:20px;height:20px;">`;
            } else {
                inputIcon.innerHTML = `<span>${platform.icon}</span>`;
            }
            inputHint.textContent = `Detected: ${platform.name}`;
            inputHint.style.color = platform.color;
        } else {
            inputIcon.innerHTML = '<span>🌐</span>';
            inputHint.textContent = 'Platform detected — ready to grab!';
            inputHint.style.color = 'var(--accent-green)';
        }
    } else {
        inputIcon.innerHTML = '<span>🔗</span>';
        inputHint.textContent = 'YouTube · TikTok · Instagram · Facebook · Reddit · Pinterest · Vimeo · Twitch · Sora 2 · SoundCloud · Imgur';
        inputHint.style.color = '';
    }
}

function isValidUrl(str) {
    try {
        new URL(str);
        return true;
    } catch {
        return false;
    }
}

function detectPlatformFromUrl(url) {
    const platforms = [
        { patterns: [/youtube\.com/, /youtu\.be/], icon: '▶', logo: 'https://cdn.simpleicons.org/youtube/FF0000', name: 'YouTube', color: '#FF0000' },
        { patterns: [/tiktok\.com/], icon: '♪', logo: 'https://cdn.simpleicons.org/tiktok/white', name: 'TikTok', color: '#00F2EA' },
        { patterns: [/instagram\.com/], icon: '📷', logo: 'https://cdn.simpleicons.org/instagram/E4405F', name: 'Instagram', color: '#E4405F' },
        { patterns: [/facebook\.com/, /fb\.watch/], icon: 'f', logo: 'https://cdn.simpleicons.org/facebook/1877F2', name: 'Facebook', color: '#1877F2' },
        { patterns: [/reddit\.com/], icon: '⬆', logo: 'https://cdn.simpleicons.org/reddit/FF4500', name: 'Reddit', color: '#FF4500' },
        { patterns: [/pinterest\.com/, /pin\.it/], icon: '📌', logo: 'https://cdn.simpleicons.org/pinterest/E60023', name: 'Pinterest', color: '#E60023' },
        { patterns: [/vimeo\.com/], icon: '▷', logo: 'https://cdn.simpleicons.org/vimeo/1AB7EA', name: 'Vimeo', color: '#1AB7EA' },
        { patterns: [/twitch\.tv/], icon: '🎮', logo: 'https://cdn.simpleicons.org/twitch/9146FF', name: 'Twitch', color: '#9146FF' },
        { patterns: [/sora\.com/, /sora\.chatgpt\.com/, /openai\.com.*sora/, /cdn\.openai\.com/], icon: '✦', logo: 'https://cdn.simpleicons.org/openai/10A37F', name: 'Sora 2', color: '#10A37F' },
        { patterns: [/soundcloud\.com/], icon: '☁', logo: 'https://cdn.simpleicons.org/soundcloud/FF5500', name: 'SoundCloud', color: '#FF5500' },
        { patterns: [/imgur\.com/], icon: '📸', logo: 'https://cdn.simpleicons.org/imgur/1BB76E', name: 'Imgur', color: '#1BB76E' },
    ];

    for (const p of platforms) {
        for (const pattern of p.patterns) {
            if (pattern.test(url)) return p;
        }
    }
    return null;
}

// ─── Honest loading messages (fetching can take 10–60s) ──────────────
let loadingMsgInterval = null;
const loadingMessages = [
    ['Fetching video info...', 'Talking to the platform — this usually takes 10–60 seconds.'],
    ['Still working...', 'Some platforms are slower to respond. Hang tight.'],
    ['Almost there...', 'Parsing the available qualities and formats.'],
];

function startLoadingMessages() {
    stopLoadingMessages();
    let i = 0;
    const main = $('#loadingMainText');
    const sub = $('#loadingSubText');
    loadingMsgInterval = setInterval(() => {
        i = (i + 1) % loadingMessages.length;
        if (main) main.textContent = loadingMessages[i][0];
        if (sub) sub.textContent = loadingMessages[i][1];
    }, 12000);
}

function stopLoadingMessages() {
    if (loadingMsgInterval) {
        clearInterval(loadingMsgInterval);
        loadingMsgInterval = null;
    }
    const main = $('#loadingMainText');
    const sub = $('#loadingSubText');
    if (main) main.textContent = loadingMessages[0][0];
    if (sub) sub.textContent = loadingMessages[0][1];
}

// ─── Grab Action ────────────────────────────────────────
async function onGrab() {
    const url = urlInput.value.trim();
    if (!url) return;

    showModal();
    showLoading(true);
    startLoadingMessages();

    try {
        const res = await fetch('/api/info', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url }),
        });

        const data = await res.json();
        stopLoadingMessages();

        if (data.success) {
            currentVideoInfo = data.data;
            renderVideoInfo(data.data);
            showLoading(false);
        } else {
            hideModal();
            showToast(data.error || 'Failed to fetch video info', 'error');
        }
    } catch (err) {
        stopLoadingMessages();
        hideModal();
        showToast('Network error. Make sure the server is running.', 'error');
    }
}

// ─── Modal ──────────────────────────────────────────────
function initModalListeners() {
    modalClose.addEventListener('click', hideModal);
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) hideModal();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') hideModal();
    });
    downloadBtn.addEventListener('click', onDownload);
}

function showModal() {
    modalOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function hideModal() {
    modalOverlay.classList.remove('active');
    document.body.style.overflow = '';
    stopLoadingMessages();
    const nudge = $('#shareNudge');
    if (nudge) nudge.style.display = 'none';
    setTimeout(() => {
        showLoading(true);
        downloadProgress.style.display = 'none';
    }, 300);
}

function showLoading(show) {
    modalLoading.style.display = show ? 'block' : 'none';
    modalContent.style.display = show ? 'none' : 'block';
}

// ─── Render Video Info ──────────────────────────────────
function renderVideoInfo(info) {
    // Platform badge
    const platform = info.platform || {};
    $('#modalPlatformIcon').textContent = platform.icon || '🌐';
    $('#modalPlatformName').textContent = platform.name || 'Unknown';

    // Thumbnail
    const thumb = $('#modalThumbnail');
    if (info.thumbnail) {
        thumb.src = info.thumbnail;
        thumb.style.display = 'block';
    } else {
        thumb.style.display = 'none';
    }

    // Duration
    const duration = $('#modalDuration');
    if (info.duration) {
        duration.textContent = formatDuration(info.duration);
        duration.style.display = 'block';
    } else {
        duration.style.display = 'none';
    }

    // Title & uploader
    $('#modalTitle').textContent = info.title || 'Untitled Video';
    $('#modalUploader').textContent = info.uploader ? `by ${info.uploader}` : '';

    // --- Video Mode ---
    $('#videoQualityGroup').style.display = 'block';
    $('#videoWatermarkGroup').style.display = 'block';
    $('.dl-text').textContent = 'Download Now';

    // Format buttons
    renderFormats(info.formats || []);

    // Watermark toggle
    const hasWM = platform.hasWatermark;
    watermarkCheckbox.checked = hasWM;
    watermarkLabel.textContent = hasWM ? 'On' : 'Off';
    if (hasWM) {
        watermarkHint.textContent = `${platform.name} watermark will be automatically removed`;
        watermarkHint.style.color = 'var(--accent-green)';
    } else {
        watermarkHint.textContent = 'Remove platform watermarks from the video';
        watermarkHint.style.color = '';
    }

    // Reset download state
    downloadBtn.disabled = false;
    downloadProgress.style.display = 'none';
}

function renderFormats(formats) {
    formatSelector.innerHTML = '';
    selectedFormat = null;

    formats.forEach((f, i) => {
        const btn = document.createElement('button');
        btn.className = 'format-btn' + (i === 0 ? ' active' : '');
        btn.textContent = f.label;
        btn.dataset.formatId = f.formatId;

        if (i === 0) selectedFormat = f.formatId;

        btn.addEventListener('click', () => {
            $$('.format-btn').forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');
            selectedFormat = f.formatId;
        });

        formatSelector.appendChild(btn);
    });
}

// ─── Watermark Toggle ───────────────────────────────────
function initWatermarkToggle() {
    watermarkCheckbox.addEventListener('change', () => {
        watermarkLabel.textContent = watermarkCheckbox.checked ? 'On' : 'Off';
    });
}

// ─── Download (real byte-level progress, no fake bar) ────────────────
async function onDownload() {
    if (!currentVideoInfo || isDownloading) return;

    isDownloading = true;
    downloadBtn.disabled = true;
    downloadProgress.style.display = 'block';
    progressFill.style.width = '0%';
    progressFill.classList.remove('indeterminate');
    progressText.textContent = 'Starting download...';

    try {
        const response = await fetch('/api/download', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: currentVideoInfo.url,
                formatId: selectedFormat || 'best',
                removeWatermark: watermarkCheckbox.checked,
            }),
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || 'Download failed');
        }

        // Stream the body so the progress bar reflects real bytes received
        const total = parseInt(response.headers.get('Content-Length') || '0', 10);
        const reader = response.body.getReader();
        const chunks = [];
        let received = 0;

        if (!(total > 0)) progressFill.classList.add('indeterminate');

        for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            received += value.length;
            if (total > 0) {
                const pct = Math.min(100, Math.round((received / total) * 100));
                progressFill.style.width = pct + '%';
                progressText.textContent = `Downloading... ${pct}% (${formatBytes(received)} of ${formatBytes(total)})`;
            } else {
                progressText.textContent = `Downloading... ${formatBytes(received)} received`;
            }
        }

        progressFill.classList.remove('indeterminate');
        progressFill.style.width = '100%';
        progressText.textContent = 'Download complete! Saving file...';

        // Trigger file save
        const blob = new Blob(chunks);
        const contentDisposition = response.headers.get('Content-Disposition');
        let fileName = currentVideoInfo.title
            ? `${currentVideoInfo.title}.mp4`
            : 'video.mp4';

        if (contentDisposition) {
            const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
            if (match) {
                fileName = match[1].replace(/['"]/g, '');
            }
        }

        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);

        showToast('Video downloaded successfully!', 'success');
        // Viral loop: invite a share right after a successful download
        const nudge = $('#shareNudge');
        if (nudge) nudge.style.display = 'block';
    } catch (err) {
        progressFill.classList.remove('indeterminate');
        progressFill.style.width = '0%';
        progressText.textContent = 'Download failed';
        showToast(err.message || 'Download failed', 'error');
    } finally {
        isDownloading = false;
        downloadBtn.disabled = false;
    }
}

function formatBytes(b) {
    if (!b || b < 1024) return `${b || 0} B`;
    const units = ['KB', 'MB', 'GB'];
    let i = -1;
    do {
        b /= 1024;
        i++;
    } while (b >= 1024 && i < units.length - 1);
    return `${b.toFixed(1)} ${units[i]}`;
}

// ─── Mobile nav toggle ──────────────────────────────────────────
function initNavToggle() {
    const toggle = $('#navToggle');
    const links = $('#navLinks');
    if (!toggle || !links) return;
    const close = () => {
        links.classList.remove('open');
        toggle.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-label', 'Open menu');
    };
    toggle.addEventListener('click', () => {
        const open = links.classList.toggle('open');
        toggle.classList.toggle('open', open);
        toggle.setAttribute('aria-expanded', String(open));
        toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    });
    links.querySelectorAll('a').forEach((a) => a.addEventListener('click', close));
}

// ─── Share buttons (viral loop) ─────────────────────────────────
const SITE_URL = 'https://grabit-downloader-production-93f2.up.railway.app/';
const SHARE_TEXT = 'GrabIt — download videos from any platform. Free, no sign-up.';

function getShareLinks() {
    const url = encodeURIComponent(SITE_URL);
    const text = encodeURIComponent(SHARE_TEXT);
    return {
        whatsapp: `https://wa.me/?text=${text}%20${url}`,
        x: `https://twitter.com/intent/tweet?text=${text}&url=${url}`,
        telegram: `https://t.me/share/url?url=${url}&text=${text}`,
        facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
    };
}

function initShareButtons() {
    const links = getShareLinks();
    const anchorMap = {
        shareWhatsApp: links.whatsapp,
        shareX: links.x,
        shareTelegram: links.telegram,
        shareFacebook: links.facebook,
    };
    Object.entries(anchorMap).forEach(([id, href]) => {
        const el = document.getElementById(id);
        if (el) el.href = href;
    });

    const copyLink = async () => {
        try {
            await navigator.clipboard.writeText(SITE_URL);
            showToast('Link copied! Share it anywhere.', 'success');
        } catch {
            showToast('Copy failed — please copy the URL manually.', 'error');
        }
    };
    const copyBtn = $('#shareCopy');
    if (copyBtn) copyBtn.addEventListener('click', copyLink);
    const nudgeCopy = $('#nudgeCopy');
    if (nudgeCopy) nudgeCopy.addEventListener('click', copyLink);

    const openShare = (id, href) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('click', () => window.open(href, '_blank', 'noopener'));
    };
    openShare('nudgeWhatsApp', links.whatsapp);
    openShare('nudgeX', links.x);
}

// ─── Scroll Effects ─────────────────────────────────────
function initScrollEffects() {
    window.addEventListener('scroll', () => {
        const scrollY = window.scrollY;
        navbar.classList.toggle('scrolled', scrollY > 50);
    });

    // Intersection observer for section animations
    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                }
            });
        },
        { threshold: 0.1 }
    );

    $$('.feature-card, .step-card, .platform-card, .faq-item').forEach((el) => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = 'opacity 0.6s var(--ease-out), transform 0.6s var(--ease-out)';
        observer.observe(el);
    });
}

// ─── Count Animations ───────────────────────────────────
function initCountAnimations() {
    const counters = $$('.stat-value[data-count]');
    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    const target = parseInt(entry.target.dataset.count);
                    animateCount(entry.target, 0, target, 1500);
                    observer.unobserve(entry.target);
                }
            });
        },
        { threshold: 0.5 }
    );

    counters.forEach((c) => observer.observe(c));
}

function animateCount(el, start, end, duration) {
    const range = end - start;
    const startTime = performance.now();

    function step(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 4);
        const current = Math.round(start + range * eased);
        el.textContent = current.toLocaleString();
        if (progress < 1) requestAnimationFrame(step);
        else el.textContent = end >= 1000 ? `${(end / 1000).toFixed(0)}K+` : end;
    }

    requestAnimationFrame(step);
}

// ─── Toast Notifications ────────────────────────────────
function showToast(message, type = 'info') {
    const icons = { success: '✅', error: '❌', info: 'ℹ️' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
    <span class="toast-icon">${icons[type]}</span>
    <span>${message}</span>
  `;
    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('leaving');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ─── Health Check ───────────────────────────────────────
async function checkServerHealth() {
    try {
        const res = await fetch('/api/health');
        const data = await res.json();
        if (data.status === 'ok') {
            const statusText = $('.status-text');
            statusText.textContent = `Online · ${data.platforms} platforms`;
            updatePlatformCounts(data.platforms);
            if (!data.ffmpeg) {
                showToast('FFmpeg not detected. Watermark removal may be limited.', 'info');
            }
        }
    } catch {
        const statusDot = $('.status-dot');
        const statusText = $('.status-text');
        if (statusDot) statusDot.style.background = '#ff5050';
        if (statusText) {
            statusText.textContent = 'Server offline';
            statusText.style.color = '#ff5050';
        }
    }
}

// ─── Utilities ──────────────────────────────────────────
function formatDuration(seconds) {
    if (!seconds || isNaN(seconds)) return '';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
}
