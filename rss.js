export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  const feeds = [
    { url: "https://feeds.bbci.co.uk/news/business/rss.xml", name: "BBC Business" },
    { url: "https://www.marketwatch.com/rss/topstories", name: "MarketWatch" },
    { url: "https://feeds.a.dj.com/rss/RSSMarketsMain.xml", name: "WSJ Markets" },
    { url: "https://www.cnbc.com/id/100003114/device/rss/rss.html", name: "CNBC" },
    { url: "https://www.financialjuice.com/feed.ashx?c=en", name: "FinancialJuice" },
  ];

  const results = [];

  await Promise.allSettled(
    feeds.map(async (feed) => {
      try {
        const r = await fetch(feed.url, {
          headers: { "User-Agent": "Mozilla/5.0" },
          signal: AbortSignal.timeout(6000),
        });
        if (!r.ok) return;
        const xml = await r.text();
        const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
        items.slice(0, 8).forEach((match) => {
          const block = match[1];
          const title = block.match(/<title[^>]*><!\[CDATA\[(.*?)\]\]><\/title>|<title[^>]*>(.*?)<\/title>/)?.[1] || block.match(/<title[^>]*>(.*?)<\/title>/)?.[1] || "";
          const pubDate = block.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || "";
          const link = block.match(/<link>(.*?)<\/link>/)?.[1] || block.match(/<link[^>]*href="([^"]+)"/)?.[1] || "";
          if (title.trim()) {
            results.push({
              headline: title.replace(/<!\[CDATA\[|\]\]>/g, "").trim(),
              source: feed.name,
              time: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
              link: link.trim(),
            });
          }
        });
      } catch (e) {
        console.warn("RSS fout:", feed.name, e.message);
      }
    })
  );

  results.sort((a, b) => new Date(b.time) - new Date(a.time));
  return res.status(200).json({ items: results.slice(0, 40) });
}
