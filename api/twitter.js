export default async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-bearer-token");

  if (req.method === "OPTIONS") return res.status(200).end();

  const bearerToken = req.headers["x-bearer-token"];
  if (!bearerToken) return res.status(401).json({ error: "Geen Bearer Token" });

  const usernames = [
    "DeItaone",       // Walter Bloomberg
    "ForexFactory",
    "ecb",
    "federalreserve",
    "Bloomberg",
    "financialjuice",
    "Reuters",
    "investing_com",
  ];

  try {
    // Stap 1: haal user IDs op via usernames
    const lookupUrl = `https://api.twitter.com/2/users/by?usernames=${usernames.join(",")}&user.fields=id,name,username`;
    const lookupRes = await fetch(lookupUrl, {
      headers: { Authorization: `Bearer ${bearerToken}` },
    });
    if (!lookupRes.ok) {
      const err = await lookupRes.json();
      return res.status(lookupRes.status).json(err);
    }
    const lookupData = await lookupRes.json();
    const users = lookupData.data || [];
    const userMap = {};
    users.forEach((u) => { userMap[u.id] = u.name || u.username; });
    const ids = users.map((u) => u.id);

    if (ids.length === 0) return res.status(200).json({ tweets: [] });

    // Stap 2: haal recente tweets op
    const query = ids.map((id) => `from:${id}`).join(" OR ") + " -is:retweet lang:en";
    const searchUrl = `https://api.twitter.com/2/tweets/search/recent?query=${encodeURIComponent(query)}&max_results=20&tweet.fields=created_at,author_id&expansions=author_id&user.fields=name,username`;
    const searchRes = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${bearerToken}` },
    });
    if (!searchRes.ok) {
      const err = await searchRes.json();
      return res.status(searchRes.status).json(err);
    }
    const searchData = await searchRes.json();
    const includes = searchData.includes?.users || [];
    includes.forEach((u) => { userMap[u.id] = u.name || u.username; });

    const tweets = (searchData.data || []).map((t) => ({
      id: t.id,
      text: t.text,
      time: t.created_at,
      author: userMap[t.author_id] || t.author_id,
    }));

    return res.status(200).json({ tweets });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
