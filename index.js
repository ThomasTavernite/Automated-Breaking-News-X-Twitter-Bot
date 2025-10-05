const { TwitterApi } = require('twitter-api-v2');
const Parser = require('rss-parser');
const parser = new Parser({ timeout: 10000 });

const client = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY,
  appSecret: process.env.TWITTER_API_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_SECRET,
});

const NEWS_SOURCES = [
  // Major Networks
  'https://feeds.nbcnews.com/nbcnews/public/news',
  'https://www.cbsnews.com/latest/rss/main',
  'https://abcnews.go.com/abcnews/topstories',
  'https://rss.cnn.com/rss/cnn_topstories.rss',
  'https://moxie.foxnews.com/google-publisher/latest.xml',

  // News Agencies
  'https://www.reuters.com/rssFeed/topNews',
  'https://feeds.a.dj.com/rss/RSSWorldNews.xml',

  // Major Newspapers
  'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml',
  'https://www.washingtonpost.com/arcio/rss/politics/',
  'https://www.usatoday.com/rss/',

  // Business News
  'https://www.cnbc.com/id/100003114/device/rss/rss.html',
  'https://feeds.bloomberg.com/markets/news.rss',

  // Regional (NJ)
  'https://www.nj.com/arc/outboundfeeds/rss/?outputType=xml',
  'https://www.app.com/arc/outboundfeeds/rss/?outputType=xml',

  // Other Major Sources
  'https://www.npr.org/rss/rss.php?id=1001',
  'https://www.politico.com/rss/politics08.xml',
  'https://www.theguardian.com/us/rss',
  'https://www.latimes.com/world-nation/rss2.0.xml',
  'https://nypost.com/feed/',
  'https://www.chicagotribune.com/arcio/rss/category/news/'
];

let postedArticles = new Set();
let initialized = false;
let lastTweetTime = 0;

function isBreakingNews(title) {
  const lowercase = title.toLowerCase();

  const skipPatterns = [
    /\d+\/\d+:/,
    /morning news/i,
    /evening news/i,
    /live:/i,
    /watch:/i,
    /video:/i,
    /podcast/i,
    /newsletter/i,
    /opinion/i,
    /analysis/i,
    /recap/i,
    /review/i
  ];

  for (const pattern of skipPatterns) {
    if (pattern.test(title)) {
      return false;
    }
  }

  return true;
}

async function checkNews() {
  for (const feed of NEWS_SOURCES) {
    try {
      const data = await parser.parseURL(feed);

      for (const item of data.items.slice(0, 3)) {
        if (!initialized) {
          postedArticles.add(item.link);
        } else {
          if (!postedArticles.has(item.link) && isBreakingNews(item.title)) {
            await tweet(item.title, item.link);
            postedArticles.add(item.link);
          }
        }
      }
    } catch (err) {
      // Silently continue
    }
  }

  if (!initialized) {
    initialized = true;
    console.log('Bot ready. Monitoring for breaking news...');
  }
}

async function tweet(title, link) {
  const now = Date.now();
  const timeSince = now - lastTweetTime;
  if (timeSince < 30000) {
    await sleep(30000 - timeSince);
  }

  let text = `BREAKING: ${title} ${link}`;

  if (text.length > 280) {
    const maxTitle = 280 - 11 - link.length - 1;
    text = `BREAKING: ${title.substring(0, maxTitle)}... ${link}`;
  }

  try {
    await client.v2.tweet(text);
    lastTweetTime = Date.now();
    console.log('✓ Tweeted:', title);
  } catch (err) {
    if (err.code === 429) {
      console.log('Rate limited. Waiting 15 minutes...');
      await sleep(900000);
    }
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

setInterval(checkNews, 300000);
checkNews();

console.log('Breaking news bot started!');