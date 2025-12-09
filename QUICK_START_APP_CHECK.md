# Quick Start: Firebase App Check Setup

## 🚀 5-Minute Setup

### Step 1: Get reCAPTCHA Site Key (2 minutes)

1. **Go to**: https://www.google.com/recaptcha/admin/create

2. **Fill the form**:
   - Label: `Quizzie`
   - Type: Select **reCAPTCHA v3** ⚠️ (Important!)
   - Domains: 
     ```
     localhost
     ```
     (Add your production domain later)
   - Accept terms ✓

3. **Click Submit**

4. **Copy the Site Key** (starts with `6L...`)
   - You'll see two keys - copy the **Site Key** (not Secret Key)

### Step 2: Add to Firebase Console (1 minute)

1. **Go to**: https://console.firebase.google.com/
2. **Select**: Your project (quizzie-fdf4b)
3. **Click**: App Check (in left sidebar)
4. **Click**: Get Started
5. **Select**: Your web app
6. **Choose**: reCAPTCHA v3
7. **Paste**: Your Site Key from Step 1
8. **Click**: Save

### Step 3: Add to Your Code (1 minute)

1. **Open**: `.env` file in your project
2. **Find**: `VITE_RECAPTCHA_SITE_KEY=your_recaptcha_site_key_here`
3. **Replace** `your_recaptcha_site_key_here` with your actual Site Key
4. **Save** the file

Example:
```env
VITE_RECAPTCHA_SITE_KEY=6LcXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

### Step 4: Test It (1 minute)

1. **Restart your dev server**:
   ```bash
   # Stop the current server (Ctrl+C)
   npm run dev
   ```

2. **Open browser console** (F12)

3. **Look for**: `✅ Firebase App Check initialized`

4. **If you see it**: Success! App Check is working! 🎉

5. **If you see warning**: Check your Site Key is correct

### Step 5: Enable Enforcement (Optional)

1. **Go to**: Firebase Console → App Check → APIs
2. **Toggle on**: Firestore and Storage
3. **Start with**: Metrics mode (logs but doesn't block)
4. **After testing**: Switch to Enforced mode

---

## ✅ You're Done!

Your app is now protected by Firebase App Check!

### What This Does:
- ✅ Blocks bots and unauthorized access
- ✅ Protects your Firestore database
- ✅ Protects your Storage files
- ✅ Works invisibly (no user interaction)
- ✅ Automatically refreshes tokens

### What to Do Next:
1. Test your app - everything should work normally
2. Check Firebase Console → App Check → Metrics
3. When deploying to production, add your domain to reCAPTCHA console

---

## 🆘 Troubleshooting

### "App Check not initialized" warning
**Fix**: Make sure you added the Site Key to `.env` and restarted the dev server

### "reCAPTCHA validation failed"
**Fix**: 
1. Check you selected **reCAPTCHA v3** (not v2)
2. Verify `localhost` is in your domains list
3. Wait 2-3 minutes for changes to propagate

### Still not working?
See detailed guide: `APP_CHECK_SETUP.md`

---

## 📝 Important Notes

- ✅ Site Key is public (safe to commit)
- ❌ Secret Key is private (never commit!)
- ✅ App Check is optional but highly recommended
- ✅ Free for most use cases
- ✅ Works with your existing Security Rules

---

## 🎯 Quick Links

- **reCAPTCHA Console**: https://www.google.com/recaptcha/admin
- **Firebase Console**: https://console.firebase.google.com/
- **Full Guide**: See `APP_CHECK_SETUP.md`
