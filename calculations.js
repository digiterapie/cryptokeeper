(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CryptoKeeper = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const SAFETY_RATE = 0.02;
  const TARGET_NET_CZK = 500;
  const MIN_PROFIT_CZK = 100;

  const PORTFOLIO = Object.freeze([
    Object.freeze({ id: "io", name: "io.net", symbol: "IO", tokens: 925.52, invested: 3500, withdrawn: 1500, decimals: 2 }),
    Object.freeze({ id: "render-token", name: "Render", symbol: "RENDER", tokens: 79.13, invested: 3000, withdrawn: 101, decimals: 2 }),
    Object.freeze({ id: "aioz-network", name: "AIOZ Network", symbol: "AIOZ", tokens: 727.2, invested: 1100, withdrawn: 0, decimals: 0 })
  ]);

  function roundDown(value, decimals) {
    const factor = 10 ** decimals;
    return Math.floor((value + Number.EPSILON) * factor) / factor;
  }

  function portfolioTotals(portfolio = PORTFOLIO) {
    const invested = portfolio.reduce((sum, coin) => sum + coin.invested, 0);
    const withdrawn = portfolio.reduce((sum, coin) => sum + coin.withdrawn, 0);
    return {
      invested,
      withdrawn,
      remaining: Math.max(0, invested - withdrawn),
      progress: invested > 0 ? Math.min(100, (withdrawn / invested) * 100) : 0
    };
  }

  function calculateSignal(coin, priceCzk, goalRemainingCzk) {
    if (!Number.isFinite(priceCzk) || priceCzk <= 0) {
      throw new Error(`Neplatna cena pro ${coin.id}`);
    }

    const protectedUnitPrice = coin.invested / coin.tokens;
    const netUnitPrice = priceCzk * (1 - SAFETY_RATE);
    const currentValue = coin.tokens * priceCzk;
    const currentNetValue = currentValue * (1 - SAFETY_RATE);
    const excessAbovePrincipal = currentNetValue - coin.invested;
    const maxQuantity = roundDown(coin.tokens, coin.decimals);
    const desiredNetProceeds = Math.min(TARGET_NET_CZK, Math.max(0, excessAbovePrincipal));
    const targetQuantity = roundDown(desiredNetProceeds / netUnitPrice, coin.decimals);
    const quantity = Math.min(targetQuantity, maxQuantity);
    const netProceeds = quantity * netUnitPrice;
    const principalProtected = currentNetValue - netProceeds >= coin.invested;
    const minimumReached = netProceeds >= MIN_PROFIT_CZK;
    const goalOpen = goalRemainingCzk > 0;
    const shouldSell = goalOpen && principalProtected && quantity > 0 && minimumReached;

    let status;
    if (!goalOpen) status = "Neprodávat – cíl návratu vkladu je splněn";
    else if (excessAbovePrincipal <= 0) status = "Neprodávat – čistá hodnota nepřevyšuje původní vklad";
    else if (!minimumReached) status = `Neprodávat – čistý přebytek je menší než ${MIN_PROFIT_CZK} Kč`;
    else status = `PRODAT: ${quantity.toFixed(coin.decimals)} ${coin.symbol}, vybereš přibližně ${Math.round(netProceeds)} Kč zisku`;

    return {
      coin,
      priceCzk,
      currentValue,
      currentNetValue,
      excessAbovePrincipal,
      protectedUnitPrice,
      netUnitPrice,
      quantity,
      netProceeds,
      principalProtected,
      shouldSell,
      status
    };
  }

  function calculateSignals(prices, portfolio = PORTFOLIO) {
    const totals = portfolioTotals(portfolio);
    return portfolio.map((coin) => calculateSignal(coin, Number(prices[coin.id]), totals.remaining));
  }

  return {
    SAFETY_RATE,
    TARGET_NET_CZK,
    MIN_PROFIT_CZK,
    PORTFOLIO,
    portfolioTotals,
    calculateSignal,
    calculateSignals,
    roundDown
  };
});
