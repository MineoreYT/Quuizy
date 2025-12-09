# Firebase App Check Setup Guide

## What is Firebase App Check?

Firebase App Check protects your backend resources (Firestore, Storage, etc.) from abuse by ensuring requests come from your authentic app, not bots or unauthorized clients.

---

## Step 1: Get reCAPTCHA v3 Keys

### 1.1 Go to reCAPTCHA Admin Console
Visit: https://www.google.com/recaptcha/admin/create

### 1.2 Register a New Site
Fill in the form:

**Label**: `Quizzie App Check`

**reCAPTCHA type**: Select **reCAPTCHA v3**

**Domains**: Add your domains (one per line)
```
localhost
yourdomain.com
www.yourdomain.com
```

**Accept Terms**: Check the box

Click **Submit**

### 1.3 Copy Your Keys
You'll get two keys:
- **Site Key** (Public) - Goes in your frontend code
- **Secret Key** (Private) - Stays in Firebase Console

**Save both keys!** You'll need them in the next steps.

---

## Step 2: Enable App Check in Firebase Console

### 2.1 Open Firebase Console
1. Go to https://console.firebase.google.com/
2. Select your project: **quizzie-fdf4b**

### 2.2 Navigate to App Check
1. Click **App Check** in the left sidebar
2. Click **Get Started**

### 2.3 Register Your Web App
1. Click **Add app** or select your existing web app
2. Choose **reCAPTCHA v3** as the provider
3. Paste your **reCAPTCHA Site Key** (from Step 1.3)
4. Click **Save**

### 2.4 Enable Enforcement (Optional but Recommended)
1. In App Check dashboard, go to **APIs** tab
2. Enable enforcement for:
   - ✅ **Firestore**
   - ✅ **Storage**
3. Start with **Metrics mode** (logs violations but doesn't block)
4. After testing, switch to **Enforced mode**

---

## Step 3: Add App Check to Your Code

### 3.1 Install App Check Package
```bash
npm install firebase
```
(Already installed - App Check is included in Firebase SDK v9+)

### 3.2 Update .env File
Add your reCAPTCHA Site Key:

```env
# Add this to your .env file
VITE_RECAPTCHA_SITE_KEY=your_recaptcha_site_key_here
```

### 3.3 Update .env.example
```env
# Add this to .env.example
VITE_RECAPTCHA_SITE_KEY=your_recaptcha_site_key_here
```

### 3.4 Update Firebase Config

Your `src/config/firebase.js` will be updated to include App Check initialization.

---

## Step 4: Testing App Check

### 4.1 Development Testing
1. Run your app: `npm run dev`
2. Open browser console
3. Look for App Check messages:
   - ✅ "App Check token refreshed"
   - ✅ "App Check initialized"

### 4.2 Check Firebase Console
1. Go to Firebase Console → App Check
2. Click on **Metrics** tab
3. You should see:
   - Valid requests count
   - Invalid requests (if any)

### 4.3 Test Enforcement
1. In Firebase Console → App Check → APIs
2. Switch Firestore to **Enforced** mode
3. Test your app - should still work
4. Try accessing Firestore from a different domain - should be blocked

---

## Step 5: Production Deployment

### 5.1 Add Production Domains
1. Go back to reCAPTCHA Admin Console
2. Add your production domain
3. Save changes

### 5.2 Update Environment Variables
Add `VITE_RECAPTCHA_SITE_KEY` to your hosting platform:

**Vercel:**
- Project Settings → Environment Variables
- Add: `VITE_RECAPTCHA_SITE_KEY` = your_site_key

**Netlify:**
- Site Settings → Build & Deploy → Environment
- Add: `VITE_RECAPTCHA_SITE_KEY` = your_site_key

**Firebase Hosting:**
```bash
firebase functions:config:set recaptcha.site_key="your_site_key"
```

### 5.3 Deploy
```bash
npm run build
# Deploy to your hosting platform
```

---

## Troubleshooting

### Issue: "App Check token not found"
**Solution**: Make sure reCAPTCHA site key is correct in `.env`

### Issue: "reCAPTCHA validation failed"
**Solution**: 
1. Check domain is added in reCAPTCHA console
2. Verify you're using reCAPTCHA v3 (not v2)

### Issue: "Requests blocked in production"
**Solution**:
1. Add production domain to reCAPTCHA console
2. Wait 5-10 minutes for changes to propagate
3. Clear browser cache

### Issue: "App Check not initializing"
**Solution**:
1. Check Firebase SDK version (should be 9.0.0+)
2. Verify App Check is enabled in Firebase Console
3. Check browser console for errors

---

## Security Best Practices

### ✅ Do:
- Use reCAPTCHA v3 (invisible, better UX)
- Start with Metrics mode, then enforce
- Monitor App Check metrics regularly
- Add all legitimate domains to reCAPTCHA

### ❌ Don't:
- Don't commit reCAPTCHA secret key to Git
- Don't use reCAPTCHA v2 (requires user interaction)
- Don't skip testing before enforcing
- Don't forget to add production domains

---

## Monitoring

### Daily Checks
- Review App Check metrics in Firebase Console
- Check for unusual patterns in valid/invalid requests

### Weekly Checks
- Review reCAPTCHA admin console for abuse reports
- Update domains if needed

---

## Cost

**reCAPTCHA v3**: FREE for most use cases
- 1 million assessments/month free
- Additional assessments: $1 per 1,000

**Firebase App Check**: FREE
- No additional cost from Firebase

---

## Summary

After setup, App Check will:
- ✅ Verify requests come from your app
- ✅ Block bots and unauthorized access
- ✅ Protect against abuse
- ✅ Work invisibly (no user interaction needed)
- ✅ Provide metrics and monitoring

---

## Quick Reference

**reCAPTCHA Console**: https://www.google.com/recaptcha/admin
**Firebase Console**: https://console.firebase.google.com/
**App Check Docs**: https://firebase.google.com/docs/app-check

---

## Need Help?

If you encounter issues:
1. Check browser console for errors
2. Review Firebase Console → App Check → Metrics
3. Verify all domains are added to reCAPTCHA
4. Check environment variables are set correctly
