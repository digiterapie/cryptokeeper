const crypto = require("node:crypto");
const { PORTFOLIO, calculateSignals } = require("../calculations");

const COINGECKO_URL = `https://api.coingecko.com/api/v3/simple/price?ids=${PORTFOLIO.map((coin) => coin.id).join(",")}&vs_currencies=czk`;

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
}

function signalKey(signals) {
  const compact = signals.map((signal) => `${signal.coin.id}:${signal.quantity.toFixed(signal.coin.decimals)}:${Math.round(signal.netProceeds / 10) * 10}`).join("|");
  return crypto.createHash("sha256").update(compact).digest("hex").slice(0, 32);
}

async function redisCommand(command) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(command)
  });
  if (!response.ok) throw new Error(`KV odpovědělo ${response.status}`);
  return (await response.json()).result;
}

async function loadPrices() {
  const response = await fetch(COINGECKO_URL, { headers: { Accept: "application/json", "User-Agent": "crypto-keeper-pwa/1.0" } });
  if (!response.ok) throw new Error(`CoinGecko odpovědělo ${response.status}`);
  const data = await response.json();
  return Object.fromEntries(PORTFOLIO.map((coin) => [coin.id, data[coin.id]?.czk]));
}

async function sendEmail(signals) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.ALERT_EMAIL_TO;
  const from = process.env.ALERT_EMAIL_FROM;
  if (!apiKey || !to || !from) throw new Error("Chybí RESEND_API_KEY, ALERT_EMAIL_TO nebo ALERT_EMAIL_FROM");

  const rows = signals.map((signal) => `<li><strong>${escapeHtml(signal.coin.name)}</strong>: prodat ${signal.quantity.toFixed(signal.coin.decimals)} ${escapeHtml(signal.coin.symbol)}, odhad čistě ${Math.round(signal.netProceeds)} Kč (cena ${signal.priceCzk.toFixed(2)} Kč)</li>`).join("");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `crypto-keeper-${signalKey(signals)}`
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: `Crypto Keeper: ${signals.length === 1 ? "nový signál PRODAT" : `${signals.length} nové signály PRODAT`}`,
      html: `<h1>Crypto Keeper</h1><p>Podle nastavených pravidel nyní vychází:</p><ul>${rows}</ul><p>Jde pouze o orientační upozornění pro ruční rozhodnutí. Aplikace neobchoduje.</p>`
    })
  });
  const result = await response.json();
  if (!response.ok) throw new Error(`Resend: ${result.message || response.status}`);
  return result.id;
}

module.exports = async function handler(request, response) {
  if (request.method !== "GET") return response.status(405).json({ error: "Method not allowed" });
  if (!process.env.CRON_SECRET || request.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return response.status(401).json({ error: "Unauthorized" });
  }

  try {
    const prices = await loadPrices();
    const signals = calculateSignals(prices);
    const sellSignals = signals.filter((signal) => signal.shouldSell);
    if (!sellSignals.length) return response.status(200).json({ ok: true, sent: false, signals: 0 });
    const key = signalKey(sellSignals);
    const previousKey = await redisCommand(["GET", "crypto-keeper:last-email-signal"]);
    if (previousKey === key) return response.status(200).json({ ok: true, sent: false, signals: sellSignals.length, reason: "duplicate" });
    const emailId = await sendEmail(sellSignals);
    await redisCommand(["SET", "crypto-keeper:last-email-signal", key, "EX", 604800]);
    return response.status(200).json({ ok: true, sent: true, signals: sellSignals.length, emailId });
  } catch (error) {
    console.error(error);
    return response.status(500).json({ ok: false, error: error.message });
  }
};
