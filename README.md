# Crypto Keeper PWA

Jednoduchá PWA pro sledování IO, Render a AIOZ. Každých 60 sekund v otevřené aplikaci načte ceny v CZK z CoinGecko a upozorní pouze tehdy, když prodej po 2% bezpečnostní rezervě není ztrátový a přinese přibližně 500 Kč čistého. Aplikace nic neprodává a nemá přístup k Revolutu.

## 1. Lokální spuštění

Vyžaduje Node.js 20 nebo novější.

```bash
npm run dev
```

Otevřete adresu vypsanou v terminálu. Výpočty lze ověřit příkazem `npm test`. Serverová e-mailová route se plně spouští až ve Vercelu.

## 2. Nasazení na GitHub a Vercel

1. Nahrajte repozitář na GitHub.
2. Ve Vercelu zvolte **Add New → Project**, importujte repozitář a ponechte výchozí nastavení statického projektu.
3. Doplňte proměnné prostředí podle další sekce.
4. Spusťte produkční deployment. Další push do hlavní větve nasadí novou verzi automaticky.

Soubor `vercel.json` nastavuje kontrolu jednou denně v 07:00 UTC (v Praze 08:00 v zimě / 09:00 v létě). Vercel Hobby dovoluje cron nejvýše jednou denně. Častější serverová kontrola vyžaduje placený plán; v něm lze schedule změnit například na `*/15 * * * *`.

## 3. E-mailová upozornění

1. Vytvořte účet u Resend a API key. Pro vlastní odesílací adresu ověřte v Resendu svou doménu.
2. Ve Vercelu otevřete **Project → Settings → Environment Variables** a pro Production nastavte:

   - `ALERT_EMAIL_TO` – adresa, kam mají upozornění chodit.
   - `ALERT_EMAIL_FROM` – ověřený odesílatel, například `Crypto Keeper <alert@vasedomena.cz>`. Pro první test lze podle podmínek Resendu použít `onboarding@resend.dev`.
   - `RESEND_API_KEY` – tajný API klíč začínající `re_`.
   - `CRON_SECRET` – náhodný dlouhý řetězec; Vercel ho automaticky posílá cron route v autorizační hlavičce.
   - `KV_REST_API_URL` a `KV_REST_API_TOKEN` – doporučené pro trvalý anti-spam. Ve Vercel Marketplace přidejte Upstash Redis k projektu; hodnoty se obvykle doplní automaticky.

3. Po změně proměnných spusťte nový produkční deployment.

Route `/api/check-alerts` používá stejné výpočty jako aplikace. S připojeným KV uloží poslední signál na 7 dní: změněný signál odešle hned, nezměněný nejdříve po týdnu. Resend navíc dostává deterministický idempotency key a 24 hodin chrání před duplicitou při opakování požadavku. Pokud KV nenastavíte, aplikace funguje dál, ale má pouze tuto 24hodinovou ochranu Resendu.

## 4. PWA notifikace v mobilu

- **Android / Chrome:** otevřete produkční HTTPS adresu, v nabídce zvolte **Přidat na plochu / Nainstalovat aplikaci**, spusťte ji a klepněte na **Povolit notifikace**.
- **iPhone / Safari:** otevřete adresu, zvolte **Sdílet → Přidat na plochu**, potom spusťte nainstalovanou aplikaci a klepněte na **Povolit notifikace**. Je potřeba iOS/iPadOS 16.4 nebo novější.

Stejný signál se neopakuje každou minutu. Aplikace si stav ukládá v zařízení a znovu upozorní při novém signálu, po významné změně množství/odhadu nejdříve za 6 hodin, nebo jako připomínku po 24 hodinách.

## 5. Omezení

PWA kontroluje ceny po 60 sekundách, když je otevřená. Mobilní systém může aplikaci na pozadí uspat; service worker sám pravidelnou kontrolu cen negarantuje. E-mailová kontrola běží serverově i při zavřené aplikaci, ale na Vercel Hobby pouze jednou denně. Ceny a doporučení jsou orientační a skutečný kurz, spread i poplatek v Revolutu se mohou lišit.
