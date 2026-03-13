const { execFile } = require('child_process');

/**
 * Scrape images/media from a URL using gallery-dl
 */
function getMediaInfo(url) {
    return new Promise((resolve) => {
        // -j outputs JSON array of items
        // -q suppresses extraneous output
        execFile('gallery-dl', ['-j', '-q', url], { maxBuffer: 1024 * 1024 * 20 }, (error, stdout, stderr) => {
            if (error && !stdout) {
                return resolve({
                    success: false,
                    error: stderr || error.message || 'Gallery-dl failed to fetch media'
                });
            }

            try {
                const lines = stdout.trim().split('\n');
                let items = [];
                for (let line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const parsed = JSON.parse(line);
                        // gallery-dl JSON format is typically [ status_code, {data} ]
                        if (Array.isArray(parsed)) {
                            if (Array.isArray(parsed[0])) {
                                parsed.forEach(p => {
                                    if (p.length >= 2 && p[1] && p[1].url) {
                                        items.push(p[1]);
                                    }
                                });
                            } else if (parsed.length >= 2 && parsed[1] && parsed[1].url) {
                                items.push(parsed[1]);
                            }
                        } else if (parsed.url) {
                            items.push(parsed);
                        }
                    } catch (e) {
                        // ignore unparseable lines
                    }
                }

                if (items.length === 0) {
                    return resolve({
                        success: false,
                        error: 'No media found in the provided link.'
                    });
                }

                // Format the output to match our app's expectations
                const firstItem = items[0];
                const urls = items.map(i => i.url).filter(Boolean);

                resolve({
                    success: true,
                    data: {
                        isGallery: true,
                        title: firstItem.title || firstItem.description || 'Media Gallery',
                        thumbnail: urls[0],
                        images: urls,
                        url: url,
                        extractor: firstItem.extractor || 'gallery-dl'
                    }
                });
            } catch (parseError) {
                resolve({
                    success: false,
                    error: 'Failed to parse gallery-dl output'
                });
            }
        });
    });
}

module.exports = { getMediaInfo };
