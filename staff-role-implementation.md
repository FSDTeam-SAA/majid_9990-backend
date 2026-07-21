# Staff Role Implementation Summary

## What was done

### 1. User Model Changes

**`src/modules/user/user.interface.ts`**
- Added `shopkeeperId?: Types.ObjectId | string` to `IUser` interface

**`src/modules/user/user.model.ts`**
- Added `'staff'` to the role enum → `['user', 'admin', 'shopkeeper', 'staff']`
- Added `shopkeeperId` field (`Schema.Types.ObjectId`, ref: `'User'`)

### 2. Authentication Flow

**Registration (`user.service.ts`)**
- Staff users are **auto-verified** (`isVerified: true`), no OTP email sent
- `shopkeeperId` is required for staff registration; validated to exist and be a verified shopkeeper
- Notification sent to shopkeeper (not admin) when staff is created
- JWT includes `shopkeeperId` in payload for staff users
- Login response includes `shopkeeperId` for staff users

### 3. New Middleware Functions

**`src/middlewares/auth.middleware.ts`**
- `isShopkeeper` — only shopkeeper role allowed
- `isStaff` — only staff role allowed
- `isShopkeeperOrStaff` — both shopkeeper and staff allowed
- `isAdminOrShopkeeper` — admin or shopkeeper allowed (for creating staff)

### 4. New Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/user/create-staff` | protect + admin/shopkeeper | Create staff member under a shopkeeper |
| `GET` | `/user/staff/:shopkeeperId` | protect | List all staff for a shopkeeper |
| `GET` | `/user/my-shopkeeper-data` | protect (staff only) | Get the shopkeeper profile for logged-in staff |

### 5. Staff Data Access Pattern

**Core architecture**: Staff acts on behalf of their associated shopkeeper.

**When staff creates data:**
- **Invoice**: `shopkeeperId` auto-set to staff's `shopkeeperId`
- **Customer**: `shopkeeperId` auto-set to staff's `shopkeeperId`
- **AddToCart**: `shopkeeperId` auto-set to staff's `shopkeeperId`
- **CashManagement**: `shopkeeperId` auto-set to staff's `shopkeeperId`
- **Inventory**: `userId` auto-set to staff's `shopkeeperId`

**When staff reads data:**
- The frontend receives `shopkeeperId` in login response and uses it for all query parameters
- `/my-inventory` returns the shopkeeper's inventory (not staff's)
- All `/shopkeeper/:shopkeeperId` routes work with staff's `shopkeeperId`

**All changes made by staff are visible to the shopkeeper** because data is stored under the shopkeeper's ID.

### 6. Files Modified

| # | File | Changes |
|---|------|---------|
| 1 | `src/modules/user/user.interface.ts` | Added `shopkeeperId` field |
| 2 | `src/modules/user/user.model.ts` | Added `'staff'` to role enum, added `shopkeeperId` field |
| 3 | `src/modules/user/user.service.ts` | Updated `registerUser` for staff auto-verify; added `createStaff`, `getAllStaffByShopkeeper`, `getMyShopkeeperData` |
| 4 | `src/modules/user/user.controller.ts` | Added `createStaff`, `getAllStaffByShopkeeper`, `getMyShopkeeperData` controllers |
| 5 | `src/modules/user/user.router.ts` | Added 3 new staff routes |
| 6 | `src/middlewares/auth.middleware.ts` | Added `isShopkeeper`, `isStaff`, `isShopkeeperOrStaff`, `isAdminOrShopkeeper` |
| 7 | `src/modules/auth/auth.service.ts` | Added `shopkeeperId` to login response + JWT payload |
| 8 | `src/modules/invoice/invoice.controller.ts` | Staff scoping for create |
| 9 | `src/modules/customer/customer.controller.ts` | Staff scoping for create |
| 10 | `src/modules/addToCart/addToCart.controller.ts` | Staff scoping for create |
| 11 | `src/modules/cashManagement/cashManagement.controller.ts` | Staff scoping for create |
| 12 | `src/modules/inventory/inventory.controller.ts` | Staff scoping for create + getMyInventory |

## Testing Flow

1. **Register a shopkeeper** → `POST /user/register` with `role: "shopkeeper"`
2. **Verify shopkeeper's email** → `POST /user/verify-email` with OTP
3. **Create a staff member** → `POST /user/create-staff` with shopkeeper's token + `shopkeeperId`
4. **Login as staff** → `POST /auth/login` → response includes `shopkeeperId`
5. **Staff can now** create invoices, customers, inventory, etc. — all attributed to their shopkeeper
6. **Shopkeeper sees all staff actions** when they query their own data
