const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');

/**
 * Watermark removal positions for known platforms
 */
const WATERMARK_CONFIGS = {
    tiktok: {
        // TikTok watermark is typically bottom-right and top-left username
        filters: [
            // Blur bottom-right corner (TikTok logo)
            { type: 'delogo', x: 'W-160', y: 'H-60', w: 150, h: 50 },
        ],
    },
    sora: {
        // Sora 2 watermark bottom-right
        filters: [
            { type: 'delogo', x: 'W-130', y: 'H-50', w: 120, h: 40 },
        ],
    },
    likee: {
        filters: [
            { type: 'delogo', x: 'W-110', y: 'H-50', w: 100, h: 40 },
        ],
    },
    kwai: {
        filters: [
            { type: 'delogo', x: 'W-110', y: '10', w: 100, h: 40 },
        ],
    },
    douyin: {
        filters: [
            { type: 'delogo', x: 'W-160', y: 'H-60', w: 150, h: 50 },
        ],
    },
    snapchat: {
        filters: [
            { type: 'delogo', x: 'W/2-100', y: '10', w: 200, h: 60 },
        ],
    },
};

/**
 * Remove watermark from video using FFmpeg
 * Uses delogo filter for known watermark positions,
 * or a generic approach for unknown platforms
 */
async function removeWatermark(inputPath, outputDir, platformId) {
    return new Promise((resolve, reject) => {
        const ext = path.extname(inputPath);
        const baseName = path.basename(inputPath, ext)
            .replace(/[<>:"/\\|?*#%&{}!@`~\[\]^;=+]/g, '_')
            .replace(/\s+/g, ' ')
            .trim();
        const outputPath = path.join(outputDir, `${baseName}_no_watermark${ext}`);

        const config = WATERMARK_CONFIGS[platformId];

        let command = ffmpeg(inputPath);

        if (config && config.filters.length > 0) {
            // Apply platform-specific delogo filters
            const filterStrings = config.filters.map((f) => {
                return `delogo=x=${f.x}:y=${f.y}:w=${f.w}:h=${f.h}:show=0`;
            });
            command = command.videoFilters(filterStrings);
        } else {
            // Generic approach: slight crop to remove common watermark positions
            // Crops 2% from each edge - removes most edge watermarks
            command = command.videoFilters([
                'crop=iw*0.96:ih*0.96:iw*0.02:ih*0.02',
            ]);
        }

        command
            .outputOptions([
                '-c:v', 'libx264',
                '-preset', 'fast',
                '-crf', '20',
                '-c:a', 'copy',
                '-movflags', '+faststart',
            ])
            .output(outputPath)
            .on('start', (cmdline) => {
                console.log('[FFmpeg] Started:', cmdline);
            })
            .on('progress', (progress) => {
                if (progress.percent) {
                    console.log(`[FFmpeg] Processing: ${Math.round(progress.percent)}%`);
                }
            })
            .on('end', () => {
                console.log('[FFmpeg] Watermark removal complete');
                resolve({
                    success: true,
                    filePath: outputPath,
                    fileName: path.basename(outputPath),
                });
            })
            .on('error', (err) => {
                console.error('[FFmpeg] Error:', err.message);
                // If FFmpeg fails, return original file
                resolve({
                    success: true,
                    filePath: inputPath,
                    fileName: path.basename(inputPath),
                    warning: 'Watermark removal failed, returning original file',
                });
            })
            .run();
    });
}

/**
 * Check if FFmpeg is available
 */
function checkFFmpeg() {
    return new Promise((resolve) => {
        ffmpeg.getAvailableFormats((err) => {
            resolve(!err);
        });
    });
}

module.exports = { removeWatermark, checkFFmpeg, WATERMARK_CONFIGS };
