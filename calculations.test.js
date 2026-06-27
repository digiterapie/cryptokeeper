const test = require("node:test");
const assert = require("node:assert/strict");
const { PORTFOLIO, portfolioTotals, calculateSignal } = require("./calculations");

test("součty portfolia odpovídají zadání", () => {
  assert.deepEqual(portfolioTotals(), { invested: 7600, withdrawn: 1601, remaining: 5999, progress: 1601 / 7600 * 100 });
});

test("nikdy nedoporučí ztrátový prodej", () => {
  const io = PORTFOLIO[0];
  const average = (io.invested - io.withdrawn) / io.tokens;
  const result = calculateSignal(io, average / 0.98, 5999);
  assert.equal(result.shouldSell, false);
  assert.equal(result.status, "Neprodávat – bylo by ztrátové");
});

test("výnos i množství používají dvouprocentní rezervu", () => {
  const io = PORTFOLIO[0];
  const result = calculateSignal(io, 10, 5999);
  assert.equal(result.quantity, 51.02);
  assert.ok(Math.abs(result.netProceeds - 51.02 * 10 * 0.98) < 0.000001);
  assert.equal(result.shouldSell, true);
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
