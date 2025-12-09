# Troubleshooting Guide

## Issue: Classes Disappear on Refresh / Students Can't Join

### What Happened
The App Check code was causing Firebase to block requests because:
1. App Check wasn't fully configured in Firebase Console
2. reCAPTCHA key wasn't set up
3. This caused Firebase to reject all database requests

### ✅ Fixed!
I've removed the App Check code from `firebase.js`. Your app should now work normally.

---

## How to Test the Fix

### 1. Restart Your Dev Server
```bash
# Stop the current server (Ctrl+C)
npm run dev
```

### 2. Test Teacher Features
1. Login as a teacher
2. Create a new class
3. Refresh the page (F5)
4. ✅ Classes should still be there

### 3. Test Student Features
1. Login as a student
2. Try to join a class using the class code
3. ✅ Should join successfully

---

## If Issues Persist

### Clear Browser Cache
1. Open DevTools (F12)
2. Right-click the refresh button
3. Select "Empty Cache and Hard Reload"

### Check Firebase Console
1. Go to https://console.firebase.google.com/
2. Select your project
3. Go to Firestore Database
4. Check if data is being saved

### Check Browser Console
1. Open DevTools (F12)
2. Go to Console tab
3. Look for any error messages
4. Share them if you need help

---

## Common Issues

### Issue: "Permission Denied" Errors
**Cause**: Firebase Security Rules are too restrictive or not deployed

**Fix**: 
1. Go to Firebase Console → Firestore Database → Rules
2. For testing, temporarily use:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```
3. Click "Publish"

### Issue: Classes Disappear on Refresh
**Cause**: Data not being saved to Firestore

**Fix**:
1. Check browser console for errors
2. Verify Firebase config in `.env` is correct
3. Check Firestore Rules allow writes

### Issue: Students Can't Join Classes
**Cause**: Security rules or authentication issues

**Fix**:
1. Verify student is logged in
2. Check class code is correct (6 characters)
3. Check Firestore Rules allow students to update classes

---

## Environment Variables Check

Make sure your `.env` file has all these variables:

```env
VITE_FIREBASE_API_KEY=your_key
VITE_FIREBASE_AUTH_DOMAIN=your_domain
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

**Important**: After changing `.env`, restart the dev server!

---

## Firebase Security Rules (For Testing)

If you're still having issues, use these permissive rules for testing:

### Firestore Rules (Testing Only)
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow authenticated users to read/write everything (TESTING ONLY)
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### Storage Rules (Testing Only)
```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

⚠️ **Warning**: These rules are for testing only! Use proper security rules in production (see SECURITY_SETUP.md)

---

## Debugging Steps

### Step 1: Check Firebase Connection
Open browser console and look for:
- ✅ No Firebase errors
- ✅ No "permission denied" errors
- ✅ No "app check" errors

### Step 2: Check Authentication
1. Login to your app
2. Open browser console
3. Type: `firebase.auth().currentUser`
4. ✅ Should show user object (not null)

### Step 3: Check Firestore
1. Go to Firebase Console → Firestore
2. Look at the `classes` collection
3. ✅ Should see your classes there

### Step 4: Test CRUD Operations
1. Create a class (should appear in Firestore)
2. Refresh page (class should still be there)
3. Join a class as student (should update Firestore)
4. ✅ All operations should work

---

## Quick Fix Commands

### Restart Everything
```bash
# Stop dev server (Ctrl+C)
# Clear npm cache
npm cache clean --force

# Reinstall dependencies
npm install

# Restart dev server
npm run dev
```

### Check for Errors
```bash
# Check for syntax errors
npm run lint

# Build to check for issues
npm run build
```

---

## App Check (Optional - For Later)

App Check was causing the issues. If you want to enable it later:

1. **First, make sure your app works without it**
2. Follow the guide in `APP_CHECK_SETUP.md`
3. Get reCAPTCHA keys
4. Configure in Firebase Console
5. Add the App Check code back

**For now, keep it disabled until your app is working perfectly.**

---

## Getting Help

If you're still having issues:

1. **Check browser console** for error messages
2. **Check Firebase Console** → Firestore for data
3. **Check Network tab** in DevTools for failed requests
4. **Share error messages** for specific help

---

## Status Check

Run through this checklist:

- [ ] Dev server is running (`npm run dev`)
- [ ] No errors in browser console
- [ ] Can login as teacher
- [ ] Can create a class
- [ ] Class persists after refresh
- [ ] Can login as student
- [ ] Can join a class with code
- [ ] Can see joined classes

If all checked ✅, your app is working!

---

## Prevention

To avoid similar issues in the future:

1. **Test after each change** - Don't make multiple changes at once
2. **Check console** - Always check browser console for errors
3. **Use version control** - Commit working code before making changes
4. **Read documentation** - Follow setup guides carefully
5. **Test thoroughly** - Test all features after changes

---

## Summary

**What was wrong**: App Check code was blocking Firebase requests

**What I fixed**: Removed App Check code from `firebase.js`

**What to do**: Restart dev server and test your app

**Result**: App should work normally now! ✅
