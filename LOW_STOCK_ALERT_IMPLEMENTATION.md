# Low Stock Alert Email System - Implementation Guide

## Overview

A background email notification system that monitors inventory stock levels and sends immediate email alerts to shopkeepers when items fall below their configured minimum stock threshold. Uses Node.js `worker_threads` for non-blocking email sending.

## Architecture

```
┌─────────────────────┐
│  Inventory Update   │
│  (createInventory/  │
│  updateInventory)   │
└──────────┬──────────┘
           │
           ▼
┌──────────────────────────────┐
│   sendLowStockAlert()        │
│  (in inventory.service.ts)   │
└──────────┬───────────────────┘
           │
           ├─► Socket Notification (sync)
           │
           └─► enqueueLowStockEmail() (async)
                      │
                      ▼
           ┌──────────────────────┐
           │  Worker Thread Pool  │
           │  (worker_threads)    │
           └──────────┬───────────┘
                      │
                      ▼
           ┌──────────────────────┐
           │   Send Email via     │
           │   Gmail SMTP         │
           └──────────────────────┘
```

## File Structure

```
src/
├── workers/
│   ├── lowStockEmailWorker.ts           # Worker pool management (Main)
│   └── lowStockEmailWorkerThread.ts     # Worker thread entry point
├── utils/
│   └── lowStockEmailTemplate.ts         # HTML email template
├── modules/
│   ├── inventory/
│   │   └── inventory.service.ts         # Modified sendLowStockAlert()
│   └── lowStockAlert/
│       ├── lowStockAlert.model.ts       # Existing
│       └── lowStockAlert.service.ts     # Existing
└── config/
    └── config.ts                         # New: lowStockAlert config
```

## Environment Variables

Add these to your `.env` file:

```env
# Low Stock Alert Configuration
LOW_STOCK_ENABLE_EMAIL=true                    # Enable/disable email notifications (default: true)
LOW_STOCK_EMAIL_WORKERS=4                      # Number of worker threads (default: 4)
LOW_STOCK_EMAIL_BATCH_SIZE=5                   # Batch size for processing (default: 5)

# Existing (make sure these are set)
EMAIL_ADDRESS=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
```

## How It Works

### 1. **Inventory Update Trigger**

When inventory `quantity` is updated via `updateInventory()` or `createInventory()`:

- `sendLowStockAlert()` is automatically called
- Function checks if quantity ≤ minStockLevel (inventory field) or user's `minimumStock` (LowStockAlert)

### 2. **Dual Notifications**

If threshold is met:

- **Socket Notification**: Created immediately for real-time UI updates
- **Email Notification**: Enqueued to worker thread pool (async, non-blocking)

### 3. **Worker Thread Processing**

- Email task added to worker pool queue
- Waits for available worker (max: `LOW_STOCK_EMAIL_WORKERS`)
- Worker processes email in separate thread:
     - Fetches user details (email, name)
     - Generates HTML from template
     - Sends via Gmail SMTP
     - Returns success/error

### 4. **Email Content**

- Professional HTML template with:
     - Item name, current quantity, minimum stock
     - Status badge (Low Stock / Out of Stock)
     - Table format for easy reading
     - Call-to-action and tips

## API Usage

### 1. Create Low Stock Alert

```bash
POST /api/low-stock-alert/create
Authorization: Bearer {token}
Content-Type: application/json

{
  "minimumStock": 10
}
```

### 2. Update Low Stock Alert

```bash
PUT /api/low-stock-alert/update/{alert_id}
Authorization: Bearer {token}
Content-Type: application/json

{
  "minimumStock": 20
}
```

### 3. Update Inventory (Triggers Alert)

```bash
PUT /api/inventory/{inventory_id}
Authorization: Bearer {token}
Content-Type: application/json

{
  "quantity": 5,
  "minStockLevel": 10
}
```

This will automatically send an email if:

- `quantity` (5) ≤ `minStockLevel` (10) OR user's `minimumStock` (LowStockAlert)

## Testing

### 1. **Manual API Testing with Postman**

Use the included `lowStockAlert_collection.json`:

```bash
# 1. Create a low stock alert for your user
POST /api/low-stock-alert/create
Body: { "minimumStock": 10 }

# 2. Create an inventory item
POST /api/inventory/create
Body: {
  "itemName": "iPhone 14",
  "quantity": 15,
  "minStockLevel": 10,
  "imeiNumber": "123456789012345"
}

# 3. Update quantity below threshold
PUT /api/inventory/{inventory_id}
Body: { "quantity": 5 }

# Check your email for the alert!
```

### 2. **Monitor Worker Logs**

Check console output for:

```
[LowStockEmailWorker] Email sent to user@example.com
[LowStockEmailWorker] Failed to send email to user@example.com: <error>
```

### 3. **Database Verification**

```javascript
// Check LowStockAlert was created
db.lowstockalerts.findOne({ shopkeeperId: ObjectId('...') });

// Check inventory item
db.inventories.findOne({ itemName: 'iPhone 14' });

// Check notifications were created
db.notifications.find({ type: 'LOW_STOCK' });
```

## Performance Considerations

### Worker Thread Pool

- **Default Workers**: 4 (configurable via `LOW_STOCK_EMAIL_WORKERS`)
- **Queue Handling**: Requests wait for available worker (100ms poll interval)
- **Memory**: Each worker thread ~15MB, suitable for most deployments
- **Non-blocking**: Main thread continues processing while emails send

### Best Practices

1. **Batch Emails**: One email per shopkeeper per run (not per item)
2. **Error Handling**: Email failures don't crash inventory updates
3. **Rate Limiting**: Configure workers based on expected email volume
4. **Monitoring**: Check logs for failed sends and adjust config

## Configuration Examples

### High-Traffic Setup (100+ items/hour)

```env
LOW_STOCK_EMAIL_WORKERS=8
LOW_STOCK_EMAIL_BATCH_SIZE=10
```

### Low-Traffic Setup (< 10 items/hour)

```env
LOW_STOCK_EMAIL_WORKERS=2
LOW_STOCK_EMAIL_BATCH_SIZE=5
```

### Development/Testing

```env
LOW_STOCK_ENABLE_EMAIL=true  # Enable for testing
LOW_STOCK_EMAIL_WORKERS=1
```

## Troubleshooting

### Issue: Emails not sending

**Solutions**:

1. Check `LOW_STOCK_ENABLE_EMAIL=true` in `.env`
2. Verify `EMAIL_ADDRESS` and `EMAIL_PASSWORD` (Gmail app password)
3. Check user has email in User model
4. Check LowStockAlert exists for shopkeeper
5. Verify `minimumStock` is configured

### Issue: Worker crashes

**Solutions**:

1. Check console logs for errors
2. Verify Node.js version supports `worker_threads` (v10.5.0+)
3. Increase `LOW_STOCK_EMAIL_WORKERS` if too many concurrent requests
4. Check available system memory

### Issue: Emails delayed

**Solutions**:

1. Increase `LOW_STOCK_EMAIL_WORKERS`
2. Check Gmail SMTP rate limits (usually 300/min)
3. Monitor worker pool queue in logs

## Future Enhancements

1. **Scheduled Summary Emails**
      - Daily/hourly digest of all low-stock items
      - Configurable via cron expression

2. **Retry Logic**
      - Exponential backoff for failed sends
      - Dead-letter queue for persistent failures

3. **Email Preferences**
      - Per-user notification frequency
      - Email template customization
      - Multiple recipient support

4. **Analytics**
      - Track email delivery rates
      - Monitor alert frequency per shopkeeper
      - Report on most frequently low-stock items

## Database Queries

### Find all low stock items for a user

```javascript
db.inventories.find({
      userId: ObjectId('user_id'),
      $where: 'this.quantity <= this.minStockLevel',
});
```

### Find users with low stock alerts

```javascript
db.lowstockalerts.aggregate([
      {
            $lookup: {
                  from: 'users',
                  localField: 'shopkeeperId',
                  foreignField: '_id',
                  as: 'user',
            },
      },
]);
```

## Related Files

- Email Utility: [src/utils/sendEmail.ts](../src/utils/sendEmail.ts)
- Email Template: [src/utils/lowStockEmailTemplate.ts](../src/utils/lowStockEmailTemplate.ts)
- Worker Pool: [src/workers/lowStockEmailWorker.ts](../src/workers/lowStockEmailWorker.ts)
- Worker Thread: [src/workers/lowStockEmailWorkerThread.ts](../src/workers/lowStockEmailWorkerThread.ts)
- Config: [src/config/config.ts](../src/config/config.ts)
- Inventory Service: [src/modules/inventory/inventory.service.ts](../src/modules/inventory/inventory.service.ts)
- LowStockAlert Model: [src/modules/lowStockAlert/lowStockAlert.model.ts](../src/modules/lowStockAlert/lowStockAlert.model.ts)
- Postman Collection: [lowStockAlert_collection.json](../lowStockAlert_collection.json)

## Support & Debugging

Enable verbose logging:

```typescript
// In lowStockEmailWorker.ts, uncomment for debugging
console.log('[LowStockEmailWorker] Job:', job);
console.log('[LowStockEmailWorker] Sending to:', email);
```

Check email sending configuration:

```typescript
// In sendEmail.ts
// Verify SMTP credentials are correct
console.log('Email from:', config.email.emailAddress);
```
