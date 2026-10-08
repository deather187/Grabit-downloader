const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { getVideoInfo, downloadVideo } = require('./utils/downloader');
const { detectPlatform, PLATFORMS } = require('./utils/platforms');
const { removeWatermark, checkFFmpeg } = require('./utils/watermark');

const app = express();
const PORT = process.env.PORT || 3000;
const TEMP_DIR = path.join(__dirname, 'temp');

// Behind Railway/Render's edge proxy — needed so rate limiting sees real client IPs
app.set('trust proxy', 1);

// Security headers + hide framework fingerprint
app.disable('x-powered-by');
app.use(helmet({
    contentSecurityPolicy: false, // frontend uses inline scripts; tune before enabling
    crossOriginEmbedderPolicy: false,
}));

// ─── Rate limiting (protects bandwidth bill) ──────────────────
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'Too many requests — please slow down a bit.' },
});
const downloadLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'Download limit reached. Try again in an hour.' },
});
app.use('/api/', apiLimiter);
app.use('/api/download', downloadLimiter);

// ─── In-memory cache for /api/info (10 min TTL) ───────────────
const infoCache = new Map();
const INFO_CACHE_TTL_MS = 10 * 60 * 1000;
const INFO_CACHE_MAX = 500;

function getCachedInfo(url) {
    const hit = infoCache.get(url);
    if (hit && hit.expires > Date.now()) return hit.data;
    infoCache.delete(url);
    return null;
}

function setCachedInfo(url, data) {
    if (infoCache.size >= INFO_CACHE_MAX) {
        infoCache.delete(infoCache.keys().next().value); // evict oldest
    }
    infoCache.set(url, { data, expires: Date.now() + INFO_CACHE_TTL_MS });
}

/** Race a promise against a timeout so slow platforms can't hang requests forever */
function withTimeout(promise, ms, message) {
    let timer;
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), ms);
    });
    return Promise.race([
        Promise.resolve(promise).finally(() => clearTimeout(timer)),
        timeout,
    ]);
}

// Ensure temp directory exists
if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── API Routes ─────────────────────────────────────────────

/**
 * GET /api/platforms — list all supported platforms
 */
app.get('/api/platforms', (req, res) => {
    const platforms = PLATFORMS.map((p) => ({
        id: p.id,
        name: p.name,
        icon: p.icon,
        logo: p.logo || null,
        color: p.color,
        gradient: p.gradient,
        features: p.features,
        hasWatermark: !!p.watermarkPosition,
    }));
    res.json({ success: true, platforms });
});

/**
 * POST /api/info — get video metadata
 * Body: { url: string }
 */
app.post('/api/info', async (req, res) => {
    const { url } = req.body;
    if (!url) {
        return res.status(400).json({ success: false, error: 'URL is required' });
    }

    // Serve repeat lookups from cache — extraction is the slow part (~10-60s)
    const cached = getCachedInfo(url);
    if (cached) {
        return res.json(cached);
    }

    const platform = detectPlatform(url);

    try {
        let resultInfo = null;
        let isSuccess = false;

        const info = await withTimeout(
            getVideoInfo(url),
            90000,
            'The platform took too long to respond. Please try again.'
        );

        if (info.success && info.data.formats && info.data.formats.length > 0) {
            resultInfo = info;
            isSuccess = true;
        } else {
            resultInfo = info; // Keep original video extraction error
        }

        if (isSuccess) {
            resultInfo.data.platform = platform
                ? { id: platform.id, name: platform.name, icon: platform.icon, color: platform.color, hasWatermark: !!platform.watermarkPosition }
                : { id: 'unknown', name: 'Unknown', icon: '🌐', color: '#888888', hasWatermark: false };
            setCachedInfo(url, resultInfo);
            res.json(resultInfo);
        } else {
            res.status(422).json(resultInfo);
        }
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * POST /api/download — download video
 * Body: { url: string, formatId?: string, removeWatermark?: boolean }
 */
app.post('/api/download', async (req, res) => {
    const { url, formatId, removeWatermark: shouldRemoveWM } = req.body;
    if (!url) {
        return res.status(400).json({ success: false, error: 'URL is required' });
    }

    const sessionId = uuidv4();
    const sessionDir = path.join(TEMP_DIR, sessionId);
    fs.mkdirSync(sessionDir, { recursive: true });

    try {
        // Reuse cached info when available — avoids a second slow extraction
        const cachedInfo = getCachedInfo(url);
        const videoInfo = cachedInfo
            ? { success: true, data: cachedInfo.data }
            : await withTimeout(
                getVideoInfo(url),
                90000,
                'The platform took too long to respond. Please try again.'
            );
        const infoData = videoInfo.success ? videoInfo.data : null;

        // Download the video
        const downloadResult = await downloadVideo(url, formatId || 'best', sessionDir, infoData);
        if (!downloadResult.success) {
            cleanupDir(sessionDir);
            return res.status(422).json(downloadResult);
        }

        let finalFile = downloadResult.filePath;
        let finalName = downloadResult.fileName;

        // Remove watermark if requested
        if (shouldRemoveWM) {
            const platform = detectPlatform(url);
            const platformId = platform ? platform.id : null;
            const ffmpegAvailable = await checkFFmpeg();

            if (ffmpegAvailable) {
                const wmResult = await removeWatermark(finalFile, sessionDir, platformId);
                if (wmResult.success && wmResult.filePath !== finalFile) {
                    // Remove original, use processed file
                    try { fs.unlinkSync(finalFile); } catch { }
                    finalFile = wmResult.filePath;
                    finalName = wmResult.fileName;
                }
            }
        }

        // Send the file
        res.download(finalFile, finalName, (err) => {
            // Cleanup after download
            setTimeout(() => cleanupDir(sessionDir), 5000);
            if (err && !res.headersSent) {
                res.status(500).json({ success: false, error: 'Failed to send file' });
            }
        });
    } catch (err) {
        cleanupDir(sessionDir);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * GET /api/health — health check
 */
app.get('/api/health', async (req, res) => {
    const ffmpegOk = await checkFFmpeg();
    res.json({
        status: 'ok',
        ffmpeg: ffmpegOk,
        platforms: PLATFORMS.length,
        timestamp: new Date().toISOString(),
    });
});

// NOTE: /api/proxy was removed — it was an unused open proxy (arbitrary
// server-side URL fetching) and a bandwidth-abuse vector. Re-add with an
// allowlist if image proxying is ever actually needed.

// ─── Utilities ──────────────────────────────────────────────

function cleanupDir(dirPath) {
    try {
        if (fs.existsSync(dirPath)) {
            fs.rmSync(dirPath, { recursive: true, force: true });
        }
    } catch (err) {
        console.error('Cleanup error:', err.message);
    }
}

// Cleanup old temp files on startup
function cleanupOldTemps() {
    try {
        if (!fs.existsSync(TEMP_DIR)) return;
        const dirs = fs.readdirSync(TEMP_DIR);
        for (const dir of dirs) {
            const dirPath = path.join(TEMP_DIR, dir);
            const stats = fs.statSync(dirPath);
            const ageMs = Date.now() - stats.mtimeMs;
            // Remove if older than 1 hour
            if (ageMs > 60 * 60 * 1000) {
                cleanupDir(dirPath);
            }
        }
    } catch { }
}
cleanupOldTemps();

// ─── Start Server ───────────────────────────────────────────

app.listen(PORT, () => {
    console.log(`
  ╔══════════════════════════════════════════════════════╗
  ║                                                      ║
  ║   🎬  Universal Video Downloader                     ║
  ║   🌐  http://localhost:${PORT}                         ║
  ║   📦  ${PLATFORMS.length} Platforms Supported                     ║
  ║                                                      ║
  ╚══════════════════════════════════════════════════════╝
  `);
});
