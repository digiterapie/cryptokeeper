const DEFAULT_STATE = {
  settings: { targetNet: 500, feeRate: 1.49, pollSeconds: 60 },
  portfolio: [
    { id: "io-net", name: "io.net", symbol: "IO", tokens: 925.52, invested: 3500, withdrawn: 1514 },
    { id: "render", name: "Render", symbol: "RENDER", tokens: 79.13, invested: 3000, withdrawn: 101 },
    { id: "aioz-network", name: "AIOZ Network", symbol: "AIOZ", tokens: 727.20, invested: 1100, withdrawn: 0 }
  ],
  lastAlertKey: ""
};

let state = loadState();

function loadState() {
  const saved = localStorage.getItem("cryptoKeeperState");
  return saved ? JSON.parse(saved) : DEFAULT_STATE;
}
function saveState() { localStorage.setItem("cryptoKeeperState", JSON.stringify(state)); }
function czk(n) { return new Intl.NumberFormat("cs-CZ", { style: "currency", currency: "CZK", maximumFractionDigits: 0 }).format(n); }
function num(n, d=2) { return new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: d }).format(n); }

async function fetchPrices() {
  const ids = state.portfolio.map(c => c.id).join(",");
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=czk`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Ceny se nepodařilo načíst");
  return res.json();
}

function totals() {
  const invested = state.portfolio.reduce((s,c) => s + c.invested, 0);
  const withdrawn = state.portfolio.reduce((s,c) => s + c.withdrawn, 0);
  return { invested, withdrawn, remaining: Math.max(0, invested - withdrawn) };
}

function renderMission() {
  const t = totals();
  const pct = t.invested ? Math.min(100, (t.withdrawn / t.invested) * 100) : 0;
  document.getElementById("totalInvested").textContent = czk(t.invested);
  document.getElementById("totalWithdrawn").textContent = czk(t.withdrawn);
  document.getElementById("remaining").textContent = czk(t.remaining);
  document.getElementById("progressBar").style.width = pct + "%";
  document.getElementById("progressText").textContent = `${num(pct, 0)} % splněno`;
}

function salePlan(coin, price) {
  const fee = state.settings.feeRate / 100;
  const targetGross = state.settings.targetNet / (1 - fee);
  const tokensToSell = Math.min(coin.tokens, targetGross / price);
  const gross = tokensToSell * price;
  const net = gross * (1 - fee);
  const value = coin.tokens * price;
  return { tokensToSell, gross, net, value };
}

function shouldSell(plan) {
  return plan.net >= state.settings.targetNet * 0.98;
}

function notify(title, body, key) {
  if (state.lastAlertKey === key) return;
  state.lastAlertKey = key;
  saveState();
  if (Notification.permission === "granted") new Notification(title, { body, icon: "icon-192.png" });
  if (navigator.vibrate) navigator.vibrate([250,100,250]);
}

async function refresh() {
  renderMission();
  document.getElementById("targetNet").value = state.settings.targetNet;
  document.getElementById("feeRate").value = state.settings.feeRate;

  try {
    const prices = await fetchPrices();
    const coinsEl = document.getElementById("coins");
    coinsEl.innerHTML = "";
    let best = null;

    for (const coin of state.portfolio) {
      const price = prices[coin.id]?.czk;
      const plan = salePlan(coin, price);
      const go = shouldSell(plan);
      if (go && (!best || plan.net > best.plan.net)) best = { coin, plan, price };

      const el = document.createElement("section");
      el.className = "card coin";
      el.innerHTML = `
        <h2>${coin.name} <span class="badge">${coin.symbol}</span></h2>
        <div class="row"><span>Cena</span><strong>${czk(price)}</strong></div>
        <div class="row"><span>Držíš</span><strong>${num(coin.tokens)} ${coin.symbol}</strong></div>
        <div class="row"><span>Aktuální hodnota</span><strong>${czk(plan.value)}</strong></div>
        <div class="row"><span>Vloženo</span><strong>${czk(coin.invested)}</strong></div>
        <div class="row"><span>Už vybráno</span><strong>${czk(coin.withdrawn)}</strong></div>
        <div class="sellAction ${go ? "go" : ""}">
          ${go ? "🔔 PRODÁVAT" : "Teď neprodávat"}<br>
          Pro čistých cca ${czk(state.settings.targetNet)} prodej ${num(plan.tokensToSell)} ${coin.symbol}.<br>
          Hrubě ${czk(plan.gross)}, po odhadu poplatku ${czk(plan.net)}.
        </div>`;
      coinsEl.appendChild(el);
    }

    const alert = document.getElementById("mainAlert");
    if (best) {
      alert.className = "card alertBox sell";
      alert.innerHTML = `🔔 <strong>${best.coin.name}: prodávej</strong><br>Prodej cca <strong>${num(best.plan.tokensToSell)} ${best.coin.symbol}</strong>. Čistě odhad ${czk(best.plan.net)}.`;
      notify("Crypto Keeper: prodávej", `${best.coin.name}: prodej cca ${num(best.plan.tokensToSell)} ${best.coin.symbol}. Čistě odhad ${czk(best.plan.net)}.`, `${best.coin.id}-${Math.round(best.price*100)}`);
    } else {
      alert.className = "card alertBox";
      alert.textContent = "Teď nic neprodávat. Hlídám dál.";
    }
  } catch (e) {
    document.getElementById("mainAlert").textContent = "Ceny se nepodařilo načíst. Zkus obnovit aplikaci.";
  }
}

document.getElementById("saveSettings").onclick = () => {
  state.settings.targetNet = Number(document.getElementById("targetNet").value || 500);
  state.settings.feeRate = Number(document.getElementById("feeRate").value || 1.49);
  saveState(); refresh();
};
document.getElementById("notifyBtn").onclick = async () => { await Notification.requestPermission(); };
document.getElementById("testBtn").onclick = () => notify("Crypto Keeper test", "Takhle přijde upozornění na prodej.", "test-" + Date.now());

if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js");
refresh();
setInterval(refresh, state.settings.pollSeconds * 1000);
