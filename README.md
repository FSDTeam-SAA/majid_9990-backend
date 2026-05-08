# majid_9990-backend

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

