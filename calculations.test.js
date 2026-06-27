const test = require("node:test");
const assert = require("node:assert/strict");
const { PORTFOLIO, portfolioTotals, calculateSignal } = require("./calculations");

test("součty portfolia odpovídají zadání", () => {
  assert.deepEqual(portfolioTotals(), { invested: 7600, withdrawn: 1601, remaining: 5999, progress: 1601 / 7600 * 100 });
});

test("IO s hrubou hodnotou 3 527 Kč neprodává, protože po rezervě nechrání celý vklad", () => {
  const io = PORTFOLIO[0];
  const result = calculateSignal(io, 3527 / io.tokens, 5999);
  assert.equal(result.shouldSell, false);
  assert.equal(result.status, "Neprodávat – čistá hodnota nepřevyšuje původní vklad");
});

test("výnos i množství používají dvouprocentní rezervu", () => {
  const io = PORTFOLIO[0];
  const result = calculateSignal(io, 10, 5999);
  assert.equal(result.quantity, 51.02);
  assert.ok(Math.abs(result.netProceeds - 51.02 * 10 * 0.98) < 0.000001);
  assert.equal(result.shouldSell, true);
});

test("přehled porovnává celý původní vklad jen s čistou hodnotou držených tokenů", () => {
  const io = PORTFOLIO[0];
  const result = calculateSignal(io, 4, 5999);
  assert.equal(result.currentNetValue, io.tokens * 4 * 0.98);
  assert.equal(result.excessAbovePrincipal, result.currentNetValue - io.invested);
});

test("dříve vybrané zisky nemění rozhodnutí o dalším prodeji", () => {
  const io = PORTFOLIO[0];
  const withoutWithdrawals = calculateSignal({ ...io, withdrawn: 0 }, 4, 5999);
  const withWithdrawals = calculateSignal({ ...io, withdrawn: 3000 }, 4, 5999);
  assert.equal(withoutWithdrawals.quantity, withWithdrawals.quantity);
  assert.equal(withoutWithdrawals.shouldSell, withWithdrawals.shouldSell);
});

test("prodá pouze přebytek a ponechá čistou hodnotu alespoň ve výši vkladu", () => {
  const io = PORTFOLIO[0];
  const priceFor150CzkExcess = (io.invested + 150) / (io.tokens * 0.98);
  const result = calculateSignal(io, priceFor150CzkExcess, 5999);
  assert.equal(result.shouldSell, true);
  assert.ok(result.netProceeds >= 100);
  assert.ok(result.netProceeds <= 150);
  assert.ok(result.currentNetValue - result.netProceeds >= io.invested);
});

test("AIOZ se zaokrouhluje dolů na celé kusy", () => {
  const aioz = PORTFOLIO[2];
  const result = calculateSignal(aioz, 5, 5999);
  assert.equal(result.quantity, 102);
  assert.equal(result.shouldSell, true);
});

test("po splnění mise neprodává", () => {
  const result = calculateSignal(PORTFOLIO[0], 10, 0);
  assert.equal(result.shouldSell, false);
});
