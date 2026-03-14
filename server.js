const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { getVideoInfo, downloadVideo } = require('./utils/downloader');
const { detectPlatform, PLATFORMS } = require('./utils/platforms');
const { removeWatermark, checkFFmpeg } = require('./utils/watermark');

const app = express();
const PORT = process.env.PORT || 3000;
const TEMP_DIR = path.join(__dirname, 'temp');

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

    const platform = detectPlatform(url);

    try {
        let resultInfo = null;
        let isSuccess = false;

        const info = await getVideoInfo(url);

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
        // First get video info to check for direct URLs (Sora 2, scraped)
        const videoInfo = await getVideoInfo(url);
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

/**
 * GET /api/proxy — proxy image downloads to bypass CORS
 */
app.get('/api/proxy', async (req, res) => {
    const targetUrl = req.query.url;
    const name = req.query.name || 'image';
    if (!targetUrl) return res.status(400).send('No URL provided');

    const https = require('https');
    const http = require('http');
    const client = targetUrl.startsWith('https') ? https : http;

    const options = {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            // Gallery-dl urls sometimes require the exact referer
            'Referer': targetUrl
        }
    };

    client.get(targetUrl, options, (proxyRes) => {
        if (proxyRes.statusCode >= 300 && proxyRes.statusCode < 400 && proxyRes.headers.location) {
            // Handle redirect
            return res.redirect(proxyRes.headers.location);
        }
        res.setHeader('Content-Type', proxyRes.headers['content-type'] || 'image/jpeg');
        res.setHeader('Content-Disposition', `attachment; filename="${name}.jpg"`);
        proxyRes.pipe(res);
    }).on('error', (err) => {
        res.status(500).send('Error proxying image');
    });
});

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
