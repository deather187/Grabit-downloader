const PLATFORMS = [
  {
    id: 'youtube',
    name: 'YouTube',
    icon: '▶',
    logo: 'https://cdn.simpleicons.org/youtube/FF0000',
    color: '#FF0000',
    gradient: 'linear-gradient(135deg, #FF0000, #CC0000)',
    patterns: [/youtube\.com/, /youtu\.be/, /youtube\.com\/shorts/],
    features: ['video', 'shorts', 'playlist', 'audio'],
    watermarkPosition: null
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    icon: '♪',
    logo: 'https://cdn.simpleicons.org/tiktok/white',
    color: '#00F2EA',
    gradient: 'linear-gradient(135deg, #00F2EA, #FF0050)',
    patterns: [/tiktok\.com/, /vm\.tiktok\.com/],
    features: ['video', 'watermark-removal'],
    watermarkPosition: { x: 'right', y: 'bottom', w: 150, h: 50 }
  },
  {
    id: 'instagram',
    name: 'Instagram',
    icon: '📷',
    logo: 'https://cdn.simpleicons.org/instagram/E4405F',
    color: '#E4405F',
    gradient: 'linear-gradient(135deg, #833AB4, #E4405F, #FCAF45)',
    patterns: [/instagram\.com/, /instagr\.am/],
    features: ['reels', 'stories', 'posts', 'video'],
    watermarkPosition: null
  },
  {
    id: 'facebook',
    name: 'Facebook',
    icon: 'f',
    logo: 'https://cdn.simpleicons.org/facebook/1877F2',
    color: '#1877F2',
    gradient: 'linear-gradient(135deg, #1877F2, #0D5BBF)',
    patterns: [/facebook\.com/, /fb\.watch/, /fb\.com/],
    features: ['video', 'reels', 'stories'],
    watermarkPosition: null
  },
  {
    id: 'reddit',
    name: 'Reddit',
    icon: '⬆',
    logo: 'https://cdn.simpleicons.org/reddit/FF4500',
    color: '#FF4500',
    gradient: 'linear-gradient(135deg, #FF4500, #FF5722)',
    patterns: [/reddit\.com/, /redd\.it/],
    features: ['video', 'gif'],
    watermarkPosition: null
  },
  {
    id: 'pinterest',
    name: 'Pinterest',
    icon: '📌',
    logo: 'https://cdn.simpleicons.org/pinterest/E60023',
    color: '#E60023',
    gradient: 'linear-gradient(135deg, #E60023, #BD081C)',
    patterns: [/pinterest\.com/, /pin\.it/],
    features: ['video', 'pins', 'stories'],
    watermarkPosition: null
  },
  {
    id: 'vimeo',
    name: 'Vimeo',
    icon: '▷',
    logo: 'https://cdn.simpleicons.org/vimeo/1AB7EA',
    color: '#1AB7EA',
    gradient: 'linear-gradient(135deg, #1AB7EA, #162221)',
    patterns: [/vimeo\.com/],
    features: ['video'],
    watermarkPosition: null
  },
  {
    id: 'twitch',
    name: 'Twitch',
    icon: '🎮',
    logo: 'https://cdn.simpleicons.org/twitch/9146FF',
    color: '#9146FF',
    gradient: 'linear-gradient(135deg, #9146FF, #6441A4)',
    patterns: [/twitch\.tv/, /clips\.twitch\.tv/],
    features: ['clips', 'vod'],
    watermarkPosition: null
  },
  {
    id: 'sora',
    name: 'Sora 2',
    icon: '✦',
    logo: 'https://cdn.simpleicons.org/openai/10A37F',
    color: '#10A37F',
    gradient: 'linear-gradient(135deg, #10A37F, #1A7F64)',
    patterns: [/sora\.com/, /sora\.chatgpt\.com/, /openai\.com\/sora/, /openai\.com.*sora/, /cdn\.openai\.com/],
    features: ['video', 'ai-generated'],
    watermarkPosition: { x: 'right', y: 'bottom', w: 120, h: 40 }
  },
  {
    id: 'soundcloud',
    name: 'SoundCloud',
    icon: '☁',
    logo: 'https://cdn.simpleicons.org/soundcloud/FF5500',
    color: '#FF5500',
    gradient: 'linear-gradient(135deg, #FF5500, #FF7700)',
    patterns: [/soundcloud\.com/],
    features: ['audio'],
    watermarkPosition: null
  },
  {
    id: 'imgur',
    name: 'Imgur',
    icon: '📸',
    logo: 'https://cdn.simpleicons.org/imgur/1BB76E',
    color: '#1BB76E',
    gradient: 'linear-gradient(135deg, #1BB76E, #0E7042)',
    patterns: [/imgur\.com/],
    features: ['video', 'gif'],
    watermarkPosition: null
  }
];

function detectPlatform(url) {
  for (const platform of PLATFORMS) {
    for (const pattern of platform.patterns) {
      if (pattern.test(url)) {
        return platform;
      }
    }
  }
  return null;
}

function getPlatformFlags(platformId) {
  const flags = {};
  switch (platformId) {
    case 'tiktok':
      flags['--no-watermark'] = true;
      break;
    case 'instagram':
      flags['--cookies-from-browser'] = 'chrome';
      break;
    case 'twitter':
      break;
  }
  return flags;
}

module.exports = { PLATFORMS, detectPlatform, getPlatformFlags };
