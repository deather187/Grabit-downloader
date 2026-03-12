const { getVideoInfo } = require('./utils/downloader');

async function testPlatforms() {
    const urls = {
        'Twitter/X': 'https://x.com/SpaceX/status/1768273059154694432',
        'Snapchat': 'https://story.snapchat.com/p/87c4f4ef-5e06-4074-9549-01584c30cda2/731336465498112',
        'Dailymotion': 'https://www.dailymotion.com/video/x8q09rz',
        'Rumble': 'https://rumble.com/v4g0p3r-watch-live-spacex-starship-flight-3.html',
        'Bilibili': 'https://www.bilibili.com/video/BV11c411B7yS',
        'LinkedIn': 'https://www.linkedin.com/posts/spacex_starship-flight-3-activity-7174026343543160832-7Gf9',
        'ok.ru': 'https://ok.ru/video/7339893951112',
        'douyin': 'https://www.douyin.com/video/7332205566088891685',
        'weibo': 'https://weibo.com/tv/show/1034:5012290466480164',
        '9gag': 'https://9gag.com/gag/aWG02eK',
        'Threads': 'https://www.threads.net/@zuck/post/CxX6jRTRP9F',
        'Vk': 'https://vk.com/video-22822305_456239018',
        'Likee': 'https://likee.video/@user/video/123456789',
        'Tumblr': 'https://href.li/?https://www.tumblr.com/video/example/123'
    };

    console.log('Testing video info extraction for problematic platforms...\n');

    for (const [platform, url] of Object.entries(urls)) {
        console.log(`[${platform}] ${url}`);
        try {
            const result = await getVideoInfo(url);
            if (result.success) {
                console.log(`✅ SUCCESS - Title: ${result.data.title}, Extractor: ${result.data.extractor}`);
            } else {
                console.log(`❌ ERROR - ${result.error}`);
            }
        } catch (e) {
            console.log(`💥 CRITICAL ERROR - ${e.message}`);
        }
        console.log('---');
    }
}

testPlatforms();
