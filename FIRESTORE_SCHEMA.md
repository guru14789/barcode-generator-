# Firestore Data Schema

## Collection Structure

```
firestore-root
├── users/
│   ├── {uid}/                           (User document)
│   │   ├── uid: string
│   │   ├── email: string
│   │   ├── displayName: string
│   │   ├── photoURL: string
│   │   ├── lastLogin: number (timestamp)
│   │   └── barcodes/                    (Subcollection)
│   │       ├── {barcodeId}/             (Barcode document)
│   │       │   ├── id: string           (9-digit barcode code, e.g., "123456789")
│   │       │   ├── createdAt: number    (timestamp)
│   │       │   ├── label?: string       (optional label for barcode)
│   │       │   ├── format: string       ("CODE128")
│   │       │   └── userId: string       (uid of the owner)
│   │       │
│   │       └── {barcodeId2}/
│   │           └── ...
│   │
│   └── {uid2}/
│       └── ...
```

## Document Types

### User Document
**Location:** `/users/{uid}`

```json
{
  "uid": "user-firebase-uid-string",
  "email": "info.sreemeditec@gmail.com",
  "displayName": "User Display Name",
  "photoURL": "https://...",
  "lastLogin": 1743120335761
}
```

### Barcode Entry Document
**Location:** `/users/{uid}/barcodes/{barcodeId}`

```json
{
  "id": "123456789",
  "createdAt": 1743120335761,
  "label": "Product Label",
  "format": "CODE128",
  "userId": "user-firebase-uid-string"
}
```

## Example Query

### Get all barcodes for a user:

```typescript
// In storageService.ts
const q = query(
  collection(db, 'users', uid, 'barcodes'),
  orderBy('createdAt', 'desc')
);
const snapshot = await getDocs(q);
const barcodes = snapshot.docs.map(doc => doc.data());
```

## Security Rules

All operations require authentication:
- ✅ Users can read/write to `/users/{their-uid}/`
- ✅ Users can read/write to `/users/{their-uid}/barcodes/{any}`
- ❌ Users cannot access other users' data
- ❌ Unauthenticated users cannot read/write

## Data Migration (if needed)

If you have old data stored under email IDs, you would need to migrate it under UID structure:

```typescript
// Old structure (deprecated):
// /users/{email}/barcodes/{id} → /users/{uid}/barcodes/{id}

// Migration logic:
async function migrateUserData(user) {
  const oldPath = `users/${user.email}/barcodes`;
  const newPath = `users/${user.uid}/barcodes`;
  
  // Copy all documents from old to new
  // Then delete old documents
}
```

## Current App Usage

The app uses these operations:

1. **Sync User on Login**
   ```
   POST /users/{uid}
   ```

2. **Get Barcode History**
   ```
   GET /users/{uid}/barcodes?orderBy=createdAt&direction=desc
   ```

3. **Save New Barcode**
   ```
   POST /users/{uid}/barcodes/{barcodeId}
   ```

4. **Update Barcode Label**
   ```
   PATCH /users/{uid}/barcodes/{barcodeId}
   ```

5. **Delete Barcode**
   ```
   DELETE /users/{uid}/barcodes/{barcodeId}
   ```
