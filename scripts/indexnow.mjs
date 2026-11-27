// Pings IndexNow (Bing, Yandex, Seznam, Naver; shared with other engines) with every URL in the live sitemap.
// Run after a deploy that adds or changes pages:  node scripts/indexnow.mjs
const KEY = "3d68993a3d2d55aa1c340ca974ea1f01"; // also served at /3d68993a3d2d55aa1c340ca974ea1f01.txt
const SITE = process.env.SITE_URL || "https://www.prometeo.land";
const xml = await (await fetch(`${SITE}/sitemap.xml`)).text();
const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>|hreflang="en" href="([^"]+)"/g)].map((m) => m[1] || m[2]);
const res = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "content-type": "application/json; charset=utf-8" },
  body: JSON.stringify({ host: new URL(SITE).host, key: KEY, keyLocation: `${SITE}/${KEY}.txt`, urlList: [...new Set(urls)] }),
});
console.log(res.status, res.statusText, `${new Set(urls).size} URLs`);
