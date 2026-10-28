# marinacasino

JavaScript-only account-menu enhancement for MarinaCasino.

## What it does

- Adds `Withdrawal History` under the existing `Finances` section, next to Payment History.
- Detects Turkish account navigation (`Bakiye yönetimi`) and adds `Para Çekme Geçmişi` with Turkish labels.
- Keeps the operation type fixed to `Withdrawal`.
- Calls the existing authenticated endpoint with `transactionTypes=withdrawal`.
- Renders the same five fields shown by Payment History: date/time, operation type, status, amount, and action.
- Supports date range changes, page size, and pagination.
- Redirects Bonus Talep to `https://marinaotobonus.com/bonustalep`.
- Preserves a selected state for the Canli Destek bottom-navigation item.
- Reorders the homepage widgets to banner, beniara, VIP Club, then Son Kazananlar.
- Opens verification-banner links in a new tab.

## API analysis

The supplied request uses:

```text
GET /api/payment-operations/api/v1.0/userTransactions
  ?creationDateFrom=MM.DD.YYYY HH:mm:ss
  &creationDateTo=MM.DD.YYYY HH:mm:ss
  &transactionTypes=withdrawal
  &page=1
  &countPerPage=20
```

An unauthenticated request to the supplied URL returned HTTP 200 with an empty JSON array (`[]`). The browser script therefore sends `credentials: include` and expects the site session to provide the user context. It accepts both a raw array response and common paginated envelopes such as `{ items, totalCount }` or `{ data, total }`.

## Use

Open the MarinaCasino account modal while logged in, paste the contents of `marinacasino-withdrawal-history.js` into the browser console, and click `Finances → Withdrawal History` or `Bakiye yönetimi → Para Çekme Geçmişi`.

The script is idempotent. To remove it from the page, run:

```js
window.__marinaCasinoWithdrawalHistory?.destroy();
```
