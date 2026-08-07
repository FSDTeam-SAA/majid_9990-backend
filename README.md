# majid_9990-backend

## API documentation

Swagger UI is available at `/api-docs` after the server starts.
The OpenAPI JSON is served at `/api-docs.json` and is regenerated automatically from the route files on startup.

## Device analysis endpoints

The device-check module exposes three public POST routes under the existing API mount points:

- `POST /api/v1/imei/check`
- `POST /api/v1/imei/risk-analysis`
- `POST /api/v1/imei/device-analysis`

The same `device-analysis` route is also available under `/api/v1/device/device-analysis`.

### Combined response

`POST /api/v1/imei/device-analysis` returns a merged payload with both check and risk sections:

```json
{
      "success": true,
      "message": "Device analysis generated",
      "data": {
            "imei": "123456789012345",
            "check": {
                  "serviceId": 6,
                  "provider": "dhru",
                  "structured": {},
                  "providerData": {}
            },
            "risk": {
                  "score": 0,
                  "level": "LOW",
                  "issues": [],
                  "signals": {},
                  "raw": {}
            }
      }
}
```

### Validation

- `imei` is required and must be exactly 15 digits.
- `serviceId` is optional and defaults to the current `DHRU_SERVICE_ID` behavior.
- Existing `/check` and `/risk-analysis` response shapes remain unchanged.

## Main features based on project goals

1. Device checks
2. smart invoice
3. Inventory
4. Subscription and popup Payments
5. Barcode
6. Ai features
7. Repairing feature

### Bulk Upload inventory from CSV

post /create-from-barcode/bulk

- Details: It accepts a CSV, XLS, or XLSX upload on the file field, reads the first worksheet, maps each row into the same payload shape used by createInventoryFromBarcode, and processes rows one by one. It supports header-based sheets with fields like code or barcode, userId, imeiNumber, purchasePrice, and currentState, and it also falls back to positional columns if there is no header row. The response returns a summary plus per-row success or failure details.

### How the payment system is working and deduct form users

When a Stripe payment is confirmed, the amount is added to the user balance in payment.service.ts. Every credit and debit is also written to a new transaction ledger in balanceTransaction.model.ts, with the supporting logic in balanceTransaction.service.ts. The user schema now stores balance directly in user.model.ts.

For IMEI/device-check requests, the API is now protected and checks the service price from the catalog before calling the upstream provider. If the service is not free, the price is deducted from the user balance first. If the balance is not enough, the request is rejected and the service response is not returned. This is wired through dhru.routes.ts, dhru.controller.ts, and riskAnalysis.controller.ts.

A new history API was added so the user can see balance changes, including credits from payment and deductions from service usage. The route is in user.router.ts, with the controller and service in user.controller.ts and user.service.ts.

##### How it works in practice:

- User pays money through Stripe.
- Webhook marks payment as paid and credits the user balance.
- User calls an IMEI or analysis endpoint.
- Server finds the service price in the IMEI catalog.
- If balance is enough, the amount is deducted and the request continues.
- If balance is not enough, the request fails.
- User can view all balance activity through the history endpoint.

## Device checks (with details)

### get '/services'

Now returns prices converted into the client’s local currency, with a currency field like BDT and the price field rewritten to the converted amount. I wired it through client IP detection, geo lookup, and a USD-to-local-rate fetch in src/modules/location/location.service.ts and src/modules/deviceCheck/dhru.controller.ts. ExchangeRate API implemented.

### Check devices for bundeling

Implementation Summary:

1. New processMultipleServiceCheck function - Handles bundled services (like your iPhone/Mac/Samsung packages):

Runs IMEI checks in parallel against all serviceIds in the array
Checks cache for each individual service
Charges only the custom service price once (not per service)
Refunds if all checks fail
Merges all results into one response 2. Modified processSingleImeiCheck function - Now detects and routes bundled services:

Checks if service.serviceIds array has multiple items
Routes to processMultipleServiceCheck if it's a bundle
Otherwise follows the original single-service path

{
"ok": true,
"message": "Bundled IMEI check completed (5/5 services)",
"data": {
"bundledServiceId": 1000,
"bundledServiceName": "iPhone all in one /best before buy",
"bundledServiceCategory": "favourite",
"totalChecks": 5,
"successfulChecks": 5,
"failedChecks": 0,
"oldGenerated": false,
"serviceResults": [
{
"serviceId": 2001,
"cached": false,
"provider": "dhru",
"data": {...}
}
// ...results from all 5 services
],
"mergedInfo": {
"deviceStatus": [
{"serviceId": 2001, "value": "Good"},
{"serviceId": 2002, "value": "Good"}
// ...aggregated data from all services
]
}
}
}


## Multi account 
Here's how the multi-shop feature works from your side:
Your shops — Every shopkeeper automatically gets one default shop. It's created from your profile details, so you don't need to do anything on day one.
Switching shops — The little store dropdown in the top header shows all your shops. Click one to switch, and everything you see (dashboard, scan history, inventory, invoices, customers, repair requests) updates to that shop's data. Staff members are always locked to your default shop.
Adding a new shop — Go to My Shops in the sidebar, fill in the shop name and address, and hit "Create & Pay for Shop." You'll be taken to Stripe to pay for it. As soon as the payment clears, the shop is activated and appears in your switcher.
Unlocking the option — Adding a second shop requires the Multi Shop plan (€9.99, one-time). Until you've paid for it, the "add shop" button directs you to the pricing page. After that, you can add unlimited additional shops, each paid separately.
Pricing/payments — The old top-up flow was fixed, so choosing a plan now correctly charges the plan price and sends you to checkout.
Everything is backward-compatible — your existing data stays visible under your default shop.