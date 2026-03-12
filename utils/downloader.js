const { execFile, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');

/**
 * Get video info/metadata from a URL
 */
async function getVideoInfo(url) {
    const ytdlp = require('yt-dlp-exec');

    // Check if this is a Sora / OpenAI URL — try custom scraper first
    if (isSoraUrl(url)) {
        const soraResult = await getSoraVideoInfo(url);
        if (soraResult.success) return soraResult;
        // Fall through to yt-dlp if custom scraper fails
    }

    // Try yt-dlp with normal extractor
    try {
        const output = await ytdlp(url, {
            dumpSingleJson: true,
            noCheckCertificates: true,
            noWarnings: true,
            preferFreeFormats: true,
            addHeader: ['referer:https://www.google.com'],
        });
        return {
            success: true,
            data: {
                title: output.title || 'Untitled Video',
                thumbnail: output.thumbnail || output.thumbnails?.[0]?.url || null,
                duration: output.duration || 0,
                uploader: output.uploader || output.channel || 'Unknown',
                description: output.description?.substring(0, 200) || '',
                formats: extractFormats(output.formats || []),
                url: url,
                extractor: output.extractor || 'unknown',
                filesize: output.filesize_approx || output.filesize || null,
            },
        };
    } catch (err1) {
        // Retry with generic extractor as fallback
        try {
            const output = await ytdlp(url, {
                dumpSingleJson: true,
                noCheckCertificates: true,
                noWarnings: true,
                forceGenericExtractor: true,
                addHeader: [
                    'referer:https://www.google.com',
                    'User-Agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
                ],
            });
            return {
                success: true,
                data: {
                    title: output.title || 'Untitled Video',
                    thumbnail: output.thumbnail || output.thumbnails?.[0]?.url || null,
                    duration: output.duration || 0,
                    uploader: output.uploader || output.channel || 'Unknown',
                    description: output.description?.substring(0, 200) || '',
                    formats: extractFormats(output.formats || []),
                    url: url,
                    extractor: 'generic',
                    filesize: output.filesize_approx || output.filesize || null,
                },
            };
        } catch (err2) {
            return {
                success: false,
                error: err1.message || 'Failed to fetch video info',
            };
        }
    }
}

/**
 * Check if URL belongs to Sora / OpenAI
 */
function isSoraUrl(url) {
    return /sora\.com|sora\.chatgpt\.com|openai\.com.*sora|cdn\.openai\.com/i.test(url);
}

/**
 * Custom Sora 2 video info scraper
 * Fetches the page HTML and extracts video URLs from meta tags, video tags, or JSON-LD
 */
async function getSoraVideoInfo(url) {
    try {
        const html = await fetchPage(url);

        // Try to find video URL from various sources in the HTML
        let videoUrl = null;
        let title = 'Sora 2 Video';
        let thumbnail = null;

        // 1. Check og:video meta tag
        const ogVideoMatch = html.match(/<meta[^>]*property=["']og:video(?::url)?["'][^>]*content=["']([^"']+)["']/i);
        if (ogVideoMatch) videoUrl = ogVideoMatch[1];

        // 2. Check twitter:player:stream
        if (!videoUrl) {
            const twitterMatch = html.match(/<meta[^>]*name=["']twitter:player:stream["'][^>]*content=["']([^"']+)["']/i);
            if (twitterMatch) videoUrl = twitterMatch[1];
        }

        // 3. Check <video> or <source> tags
        if (!videoUrl) {
            const sourceMatch = html.match(/<source[^>]*src=["']([^"']+\.mp4[^"']*)["']/i);
            if (sourceMatch) videoUrl = sourceMatch[1];
        }
        if (!videoUrl) {
            const videoSrcMatch = html.match(/<video[^>]*src=["']([^"']+\.mp4[^"']*)["']/i);
            if (videoSrcMatch) videoUrl = videoSrcMatch[1];
        }

        // 4. Check for .mp4 URLs in JSON data or inline scripts
        if (!videoUrl) {
            const mp4Matches = html.match(/https?:\/\/[^\s"'<>]+\.mp4[^\s"'<>]*/gi);
            if (mp4Matches && mp4Matches.length > 0) {
                // Pick the longest URL (usually the highest quality)
                videoUrl = mp4Matches.sort((a, b) => b.length - a.length)[0];
            }
        }

        // 5. Check for video URLs in JSON-LD
        if (!videoUrl) {
            const jsonLdMatch = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
            if (jsonLdMatch) {
                try {
                    const jsonLd = JSON.parse(jsonLdMatch[1]);
                    videoUrl = jsonLd.contentUrl || jsonLd.embedUrl || jsonLd.url;
                } catch { }
            }
        }

        // Extract title
        const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
        if (ogTitleMatch) title = ogTitleMatch[1];
        else {
            const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
            if (titleMatch) title = titleMatch[1].trim();
        }

        // Extract thumbnail
        const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
        if (ogImageMatch) thumbnail = ogImageMatch[1];

        if (videoUrl) {
            return {
                success: true,
                data: {
                    title: title,
                    thumbnail: thumbnail,
                    duration: 0,
                    uploader: 'Sora 2 / OpenAI',
                    description: 'AI-generated video from Sora 2',
                    formats: [
                        { formatId: 'direct', label: 'Best Quality', height: 1080, ext: 'mp4', filesize: null, vcodec: 'auto', acodec: 'auto' }
                    ],
                    url: url,
                    directVideoUrl: videoUrl,
                    extractor: 'sora-custom',
                    filesize: null,
                },
            };
        }

        return { success: false, error: 'Could not find video URL on Sora page' };
    } catch (err) {
        return { success: false, error: 'Failed to scrape Sora page: ' + err.message };
    }
}



/**
 * Fetch a page's HTML content
 */
function fetchPage(url) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        const req = client.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
            },
        }, (res) => {
            // Follow redirects
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return fetchPage(res.headers.location).then(resolve).catch(reject);
            }
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve(data));
            res.on('error', reject);
        });
        req.on('error', reject);
        req.setTimeout(15000, () => { req.destroy(); reject(new Error('Timeout')); });
    });
}

/**
 * Extract and simplify available formats
 */
function extractFormats(formats) {
    const seen = new Set();
    const result = [];

    // Filter for formats with video
    const videoFormats = formats
        .filter((f) => f.vcodec && f.vcodec !== 'none' && f.height)
        .sort((a, b) => (b.height || 0) - (a.height || 0));

    for (const f of videoFormats) {
        const label = `${f.height}p`;
        if (!seen.has(label)) {
            seen.add(label);
            result.push({
                formatId: f.format_id,
                label: label,
                height: f.height,
                ext: f.ext || 'mp4',
                filesize: f.filesize || f.filesize_approx || null,
                vcodec: f.vcodec,
                acodec: f.acodec,
            });
        }
    }

    // Add audio-only option
    const audioFormats = formats.filter(
        (f) => f.acodec && f.acodec !== 'none' && (!f.vcodec || f.vcodec === 'none')
    );
    if (audioFormats.length > 0) {
        result.push({
            formatId: 'bestaudio',
            label: 'Audio Only',
            height: 0,
            ext: 'mp3',
            filesize: null,
            vcodec: 'none',
            acodec: audioFormats[0]?.acodec || 'unknown',
        });
    }

    // If no formats found, add a best quality option
    if (result.length === 0) {
        result.push({
            formatId: 'best',
            label: 'Best Quality',
            height: 1080,
            ext: 'mp4',
            filesize: null,
            vcodec: 'auto',
            acodec: 'auto',
        });
    }

    return result;
}

/**
 * Download video to a temp directory
 */
async function downloadVideo(url, formatId, outputDir, videoInfo) {
    // If we have a direct video URL (from custom scraper), download directly
    if (videoInfo && videoInfo.directVideoUrl) {
        return await downloadDirect(videoInfo.directVideoUrl, videoInfo.title || 'video', outputDir);
    }

    const ytdlp = require('yt-dlp-exec');
    const outputTemplate = path.join(outputDir, '%(title)s.%(ext)s');

    const opts = {
        output: outputTemplate,
        noCheckCertificates: true,
        noWarnings: true,
        addHeader: [
            'referer:https://www.google.com',
            'User-Agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
        ],
    };

    if (formatId === 'bestaudio') {
        opts.extractAudio = true;
        opts.audioFormat = 'mp3';
    } else if (formatId && formatId !== 'best' && formatId !== 'direct') {
        opts.format = `${formatId}+bestaudio/best`;
        opts.mergeOutputFormat = 'mp4';
    } else {
        opts.format = 'best[ext=mp4]/best';
    }

    try {
        await ytdlp(url, opts);

        // Find the downloaded file
        const files = fs.readdirSync(outputDir);
        if (files.length === 0) {
            throw new Error('Download completed but no file found');
        }
        const downloadedFile = files[0];
        return {
            success: true,
            filePath: path.join(outputDir, downloadedFile),
            fileName: downloadedFile,
        };
    } catch (err1) {
        // Retry with generic extractor
        try {
            opts.forceGenericExtractor = true;
            await ytdlp(url, opts);
            const files = fs.readdirSync(outputDir);
            if (files.length === 0) throw new Error('No file found');
            return {
                success: true,
                filePath: path.join(outputDir, files[0]),
                fileName: files[0],
            };
        } catch (err2) {
            return {
                success: false,
                error: err1.message || 'Download failed',
            };
        }
    }
}

/**
 * Direct download a video file from a URL (for Sora and scraped videos)
 */
function downloadDirect(videoUrl, title, outputDir) {
    return new Promise((resolve, reject) => {
        const safeName = title.replace(/[<>:"/\\|?*]/g, '_').substring(0, 100);
        const outputPath = path.join(outputDir, `${safeName}.mp4`);
        const file = fs.createWriteStream(outputPath);
        const client = videoUrl.startsWith('https') ? https : http;

        console.log(`[Direct Download] ${videoUrl}`);

        const req = client.get(videoUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                'Referer': 'https://sora.com/',
            },
        }, (res) => {
            // Follow redirects
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                file.close();
                fs.unlinkSync(outputPath);
                return downloadDirect(res.headers.location, title, outputDir).then(resolve).catch(reject);
            }

            if (res.statusCode !== 200) {
                file.close();
                return resolve({ success: false, error: `HTTP ${res.statusCode}` });
            }

            res.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve({
                    success: true,
                    filePath: outputPath,
                    fileName: `${safeName}.mp4`,
                });
            });
        });

        req.on('error', (err) => {
            file.close();
            resolve({ success: false, error: err.message });
        });

        req.setTimeout(120000, () => {
            req.destroy();
            resolve({ success: false, error: 'Download timeout' });
        });
    });
}

module.exports = { getVideoInfo, downloadVideo, extractFormats };
