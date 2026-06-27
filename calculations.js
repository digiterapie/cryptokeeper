(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CryptoKeeper = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const SAFETY_RATE = 0.02;
  const TARGET_NET_CZK = 500;
  const MIN_TARGET_RATIO = 0.98;

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

    const averageBuyPrice = Math.max(0, coin.invested - coin.withdrawn) / coin.tokens;
    const netUnitPrice = priceCzk * (1 - SAFETY_RATE);
    const currentValue = coin.tokens * priceCzk;
    const currentNetValue = currentValue * (1 - SAFETY_RATE);
    const totalRecoveredValue = coin.withdrawn + currentNetValue;
    const differenceVsInvested = totalRecoveredValue - coin.invested;
    const maxQuantity = roundDown(coin.tokens, coin.decimals);
    const targetQuantity = roundDown(TARGET_NET_CZK / netUnitPrice, coin.decimals);
    const quantity = Math.min(targetQuantity, maxQuantity);
    const netProceeds = quantity * netUnitPrice;
    const profitable = netUnitPrice > averageBuyPrice;
    const targetReached = netProceeds >= TARGET_NET_CZK * MIN_TARGET_RATIO;
    const goalOpen = goalRemainingCzk > 0;
    const shouldSell = goalOpen && profitable && quantity > 0 && targetReached;

    let status;
    if (!goalOpen) status = "Neprodávat – cíl návratu vkladu je splněn";
    else if (!profitable) status = "Neprodávat – bylo by ztrátové";
    else if (!targetReached) status = "Neprodávat – ještě není dostatečný čistý výnos";
    else status = `PRODAT: ${quantity.toFixed(coin.decimals)} ${coin.symbol}, odhad čistě ${Math.round(netProceeds)} Kč`;

    return {
      coin,
      priceCzk,
      currentValue,
      currentNetValue,
      totalRecoveredValue,
      differenceVsInvested,
      averageBuyPrice,
      netUnitPrice,
      quantity,
      netProceeds,
      profitable,
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
    PORTFOLIO,
    portfolioTotals,
    calculateSignal,
    calculateSignals,
    roundDown
  };
});
