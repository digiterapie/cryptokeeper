"use strict";

const { PORTFOLIO, TARGET_NET_CZK, portfolioTotals, calculateSignals } = window.CryptoKeeper;
const PRICE_URL = `https://api.coingecko.com/api/v3/simple/price?ids=${PORTFOLIO.map((coin) => coin.id).join(",")}&vs_currencies=czk`;
const POLL_MS = 60_000;
const ALERT_COOLDOWN_MS = 6 * 60 * 60 * 1000;
const ALERT_REMINDER_MS = 24 * 60 * 60 * 1000;

const czk = (value, digits = 0) => new Intl.NumberFormat("cs-CZ", {
  style: "currency",
  currency: "CZK",
  maximumFractionDigits: digits
}).format(value);

const number = (value, digits = 2) => new Intl.NumberFormat("cs-CZ", {
  minimumFractionDigits: 0,
  maximumFractionDigits: digits
}).format(value);

function renderMission() {
  const totals = portfolioTotals();
  document.getElementById("totalInvested").textContent = czk(totals.invested);
  document.getElementById("totalWithdrawn").textContent = czk(totals.withdrawn);
  document.getElementById("remaining").textContent = czk(totals.remaining);
  document.getElementById("progressBar").style.width = `${totals.progress}%`;
  document.getElementById("progressText").textContent = `${number(totals.progress, 1)} % splněno`;
}

async function fetchPrices() {
  const response = await fetch(PRICE_URL, { cache: "no-store" });
  if (!response.ok) throw new Error(`CoinGecko odpovědělo ${response.status}`);
  const data = await response.json();
  return Object.fromEntries(PORTFOLIO.map((coin) => [coin.id, data[coin.id]?.czk]));
}

function getAlertState() {
  try {
    return JSON.parse(localStorage.getItem("cryptoKeeperAlerts") || "{}");
  } catch {
    return {};
  }
}

async function showSignalNotification(signal) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;

  const alerts = getAlertState();
  const previous = alerts[signal.coin.id] || {};
  const signature = `${signal.quantity.toFixed(signal.coin.decimals)}-${Math.round(signal.netProceeds / 10) * 10}`;
  const now = Date.now();
  const isNewSignal = !previous.active;
  const materiallyChanged = previous.signature !== signature && now - (previous.sentAt || 0) >= ALERT_COOLDOWN_MS;
  const reminderDue = now - (previous.sentAt || 0) >= ALERT_REMINDER_MS;

  alerts[signal.coin.id] = { active: true, signature, sentAt: previous.sentAt || 0 };
  if (isNewSignal || materiallyChanged || reminderDue) {
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification("Crypto Keeper", {
      body: `${signal.coin.name} – prodej ${signal.quantity.toFixed(signal.coin.decimals)} ${signal.coin.symbol}, odhad čistě ${Math.round(signal.netProceeds)} Kč.`,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: `sell-${signal.coin.id}`,
      renotify: true,
      data: { url: "/" }
    });
    alerts[signal.coin.id].sentAt = now;
  }
  localStorage.setItem("cryptoKeeperAlerts", JSON.stringify(alerts));
}

function clearInactiveAlerts(signals) {
  const alerts = getAlertState();
  for (const signal of signals) {
    if (!signal.shouldSell && alerts[signal.coin.id]) alerts[signal.coin.id].active = false;
  }
  localStorage.setItem("cryptoKeeperAlerts", JSON.stringify(alerts));
}

function renderCoin(signal) {
  const section = document.createElement("section");
  section.className = "card coin";
  section.innerHTML = `
    <h2>${signal.coin.name} <span class="badge">${signal.coin.symbol}</span></h2>
    <div class="row"><span>Aktuální cena</span><strong>${czk(signal.priceCzk, 2)}</strong></div>
    <div class="row"><span>Drženo</span><strong>${number(signal.coin.tokens)} ${signal.coin.symbol}</strong></div>
    <div class="row"><span>Aktuální hodnota</span><strong>${czk(signal.currentValue)}</strong></div>
    <div class="row"><span>Průměrná nákupní cena</span><strong>${czk(signal.averageBuyPrice, 2)}</strong></div>
    <div class="sellAction ${signal.shouldSell ? "go" : ""}">${signal.status}</div>`;
  return section;
}

async function refresh() {
  const alert = document.getElementById("mainAlert");
  try {
    const prices = await fetchPrices();
    const signals = calculateSignals(prices);
    const coins = document.getElementById("coins");
    coins.replaceChildren(...signals.map(renderCoin));
    const sellSignals = signals.filter((signal) => signal.shouldSell);

    clearInactiveAlerts(signals);
    if (sellSignals.length) {
      alert.className = "card alertBox sell";
      alert.textContent = `${sellSignals.length === 1 ? "Je tu nový signál" : `Jsou tu ${sellSignals.length} signály`} PRODAT.`;
      await Promise.all(sellSignals.map(showSignalNotification));
    } else {
      alert.className = "card alertBox";
      alert.textContent = "Teď nic neprodávat. Hlídám dál.";
    }
    document.getElementById("updatedAt").textContent = `Aktualizováno ${new Intl.DateTimeFormat("cs-CZ", { timeStyle: "medium" }).format(new Date())}`;
  } catch (error) {
    console.error(error);
    alert.className = "card alertBox error";
    alert.textContent = "Ceny se nepodařilo načíst. Zkus aplikaci obnovit.";
  }
}

document.getElementById("notifyBtn").addEventListener("click", async () => {
  if (!("Notification" in window)) {
    document.getElementById("notificationStatus").textContent = "Tento prohlížeč notifikace nepodporuje.";
    return;
  }
  const permission = await Notification.requestPermission();
  document.getElementById("notificationStatus").textContent = permission === "granted"
    ? "Notifikace jsou povolené."
    : "Notifikace nebyly povolené.";
});

if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js");
renderMission();
refresh();
setInterval(refresh, POLL_MS);
