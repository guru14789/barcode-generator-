# Firestore Data Verification & Troubleshooting Guide

## Quick Start: View Your Data

### Option 1: Use Firebase Console (Easiest)
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select project: `sreemeditec-barcode-gen`
3. Click **Firestore Database** in left menu
4. Navigate: `users` → `{uid}` → `barcodes`
5. View all barcode documents there

### Option 2: Use Query Script
```bash
# Query barcodes for a specific user
node query-firestore.mjs "info.sreemeditec@gmail.com"

# Output example:
# ✅ Found user:
#    UID: Abc123xyz...
#    Email: info.sreemeditec@gmail.com
#    Display Name: Sree Editec
#    Last Login: 3/26/2026, 1:05 PM
#
# 📊 Barcodes (5 total):
# 1. Barcode Code: 123456789
#    Label: Product A
#    Created: 3/26/2026, 1:00 PM
```

## Expected Data Structure

### When user logs in:
```
users/
├── {uid}/
    ├── uid: "abc123xyz..."
    ├── email: "info.sreemeditec@gmail.com"
    ├── displayName: "Sree Editec" (from Google account)
    ├── photoURL: "https://lh3.googleusercontent.com/..."
    ├── lastLogin: 1743120335761
    └── barcodes/
        ├── 123456789/
        │   ├── id: "123456789"
        │   ├── createdAt: 1743120335761
        │   ├── label: "Product Label"
        │   ├── format: "CODE128"
        │   └── userId: "abc123xyz..."
        └── 987654321/
            └── ...
```

## Debugging: Checking Permissions

### Test 1: Check if user data is syncing
```javascript
// In browser console after login:
onAuthStateChanged(auth, (user) => {
  console.log('Current user:', {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName
  });
});
```

### Test 2: Check if barcodes are being saved
```javascript
// Generate a barcode, then check:
const barcodesRef = collection(db, 'users', auth.currentUser.uid, 'barcodes');
const snapshot = await getDocs(barcodesRef);
console.log('Barcodes in Firestore:', snapshot.docs.map(d => d.data()));
```

### Test 3: Verify security rules are working
```javascript
// This should work:
await getDocs(collection(db, 'users', auth.currentUser.uid, 'barcodes'));
// ✅ Should succeed (your data)

// This should fail:
await getDocs(collection(db, 'users', 'some-other-uid', 'barcodes'));
// ❌ Should show: "Missing or insufficient permissions"
```

## Common Issues & Solutions

### Issue 1: No barcodes visible after login
**Cause:** Old data stored under email instead of uid
**Solution:** Generate new barcodes (they'll be saved under correct uid)

### Issue 2: "Missing or insufficient permissions" error
**Cause:** Security rules mismatch or not authenticated
**Solution:** 
1. Clear browser cache: `Ctrl+Shift+Delete`
2. Refresh page
3. Login again
4. Check: Security rules are deployed (rules version should show in console)

### Issue 3: Barcodes syncing to wrong collection
**Cause:** userId field has different value than uid
**Solution:** Already fixed in latest version. Make sure to pull latest code from GitHub.

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                   User Logs In                              │
│         (Google OAuth with email: info.sreemeditec@...)     │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│           Firebase Auth Services                            │
│  Provides: uid, email, displayName, photoURL               │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│        App calls storageService.syncUser(user)             │
│        Saves to: /users/{uid}/{user data}                  │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│    User generates barcode                                  │
│    Saves to: /users/{uid}/barcodes/{barcodeId}            │
│    with userId field = uid (for consistency)               │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  Security Rules Check                                       │
│  request.auth.uid == {uid} → ✅ ALLOW READ/WRITE          │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  Data Successfully Stored in Firestore                     │
│  Visible in: Console > Firestore > users > {uid} > barcodes │
└─────────────────────────────────────────────────────────────┘
```

## Security Rules Explanation

```firestore
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 1. User can access their own user document
    match /users/{userId} {
      // ✅ Authenticated user can read/write their own profile
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // 2. User can access their own barcodes subcollection
    match /users/{userId}/barcodes/{barcodeId} {
      // ✅ Authenticated user can read/write their own barcodes
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // 3. Deny everything else
    match /{document=**} {
      allow read, write: if false;  // ❌ Everything else is forbidden
    }
  }
}
```

## Verification Checklist

- [ ] User can login with Google
- [ ] User profile appears in Firestore: `/users/{uid}`
- [ ] "Failed to sync user to Firestore" error is GONE
- [ ] Can generate new barcodes
- [ ] Barcode appears in: `/users/{uid}/barcodes/{id}`
- [ ] "Failed to load history" error is GONE
- [ ] Barcodes display in app's history list
- [ ] Can edit barcode labels
- [ ] Can delete barcodes
- [ ] No permission errors in browser console

## Support

If issues persist:
1. Check Firebase Console for data
2. Run query script: `node query-firestore.mjs "your-email@gmail.com"`
3. Verify rules were deployed: Check "Last published" in Firestore Rules tab
4. Clear cache and refresh app
