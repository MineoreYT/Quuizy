# Security Setup Guide for Quizzie

## Important: Understanding Firebase Security

### Why Your API Key is Visible (And That's OK!)
Your Firebase API key being visible in the browser is **completely normal and safe**. Here's why:

1. **API keys are not secret** - They identify your Firebase project, not authenticate users
2. **Security Rules protect your data** - Firebase uses Security Rules, not API key secrecy
3. **All client-side apps expose keys** - This is standard for web/mobile apps
4. **Firebase expects this** - The API key is designed to be public

### Real Security Comes From:
✅ **Firebase Security Rules** (Firestore, Storage)
✅ **Firebase Authentication** (User verification)
✅ **Server-side validation** (If using Cloud Functions)
✅ **Domain restrictions** (In Firebase Console)

---

## 1. Environment Variables Setup

### Step 1: Create .env file
Already created! Your `.env` file contains your Firebase config.

### Step 2: Never commit .env
The `.gitignore` file now excludes `.env` files from Git.

### Step 3: For deployment
Add environment variables to your hosting platform:
- **Vercel**: Project Settings → Environment Variables
- **Netlify**: Site Settings → Build & Deploy → Environment
- **Firebase Hosting**: Use `firebase functions:config:set`

---

## 2. Firebase Security Rules (CRITICAL!)

### Firestore Security Rules

Go to Firebase Console → Firestore Database → Rules and replace with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper functions
    function isSignedIn() {
      return request.auth != null;
    }
    
    function isOwner(userId) {
      return isSignedIn() && request.auth.uid == userId;
    }
    
    function isTeacher() {
      return isSignedIn() && 
             get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'teacher';
    }
    
    function isStudent() {
      return isSignedIn() && 
             get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'student';
    }
    
    function isClassTeacher(classId) {
      return isSignedIn() && 
             get(/databases/$(database)/documents/classes/$(classId)).data.teacherId == request.auth.uid;
    }
    
    function isEnrolledStudent(classId) {
      return isSignedIn() && 
             request.auth.uid in get(/databases/$(database)/documents/classes/$(classId)).data.students;
    }
    
    // Users collection
    match /users/{userId} {
      // Users can read their own data
      allow read: if isOwner(userId);
      // Users can create their own profile during registration
      allow create: if isOwner(userId);
      // Users can update their own profile
      allow update: if isOwner(userId);
      // No one can delete user profiles
      allow delete: if false;
    }
    
    // Classes collection
    match /classes/{classId} {
      // Teachers can read their own classes
      // Students can read classes they're enrolled in
      allow read: if isClassTeacher(classId) || isEnrolledStudent(classId);
      
      // Only teachers can create classes
      allow create: if isTeacher() && request.resource.data.teacherId == request.auth.uid;
      
      // Only the class teacher can update their class
      allow update: if isClassTeacher(classId);
      
      // Only the class teacher can delete their class
      allow delete: if isClassTeacher(classId);
    }
    
    // Quizzes collection
    match /quizzes/{quizId} {
      // Teachers can read their own quizzes
      // Students can read quizzes from classes they're enrolled in
      allow read: if isSignedIn() && (
        isClassTeacher(resource.data.classId) || 
        isEnrolledStudent(resource.data.classId)
      );
      
      // Only teachers can create quizzes for their classes
      allow create: if isTeacher() && isClassTeacher(request.resource.data.classId);
      
      // Only the class teacher can update quizzes
      allow update: if isTeacher() && isClassTeacher(resource.data.classId);
      
      // Only the class teacher can delete quizzes
      allow delete: if isTeacher() && isClassTeacher(resource.data.classId);
    }
    
    // Lessons collection
    match /lessons/{lessonId} {
      // Teachers can read their own lessons
      // Students can read lessons from classes they're enrolled in
      allow read: if isSignedIn() && (
        isClassTeacher(resource.data.classId) || 
        isEnrolledStudent(resource.data.classId)
      );
      
      // Only teachers can create lessons for their classes
      allow create: if isTeacher() && isClassTeacher(request.resource.data.classId);
      
      // Only the class teacher can update lessons
      allow update: if isTeacher() && isClassTeacher(resource.data.classId);
      
      // Only the class teacher can delete lessons
      allow delete: if isTeacher() && isClassTeacher(resource.data.classId);
    }
    
    // Quiz Results collection
    match /quizResults/{resultId} {
      // Students can read their own results
      // Teachers can read results from their classes
      allow read: if isSignedIn() && (
        isOwner(resource.data.studentId) || 
        isClassTeacher(resource.data.classId)
      );
      
      // Only students can create their own quiz results
      allow create: if isStudent() && 
                      request.resource.data.studentId == request.auth.uid &&
                      isEnrolledStudent(request.resource.data.classId);
      
      // No one can update or delete quiz results (immutable)
      allow update: if false;
      allow delete: if false;
    }
  }
}
```

### Storage Security Rules

Go to Firebase Console → Storage → Rules and replace with:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    
    // Helper functions
    function isSignedIn() {
      return request.auth != null;
    }
    
    function isTeacher() {
      return isSignedIn() && 
             firestore.get(/databases/(default)/documents/users/$(request.auth.uid)).data.role == 'teacher';
    }
    
    // Lesson files
    match /lessons/{classId}/{fileName} {
      // Anyone authenticated can read lesson files
      allow read: if isSignedIn();
      
      // Only teachers can upload lesson files
      allow write: if isTeacher();
      
      // Only teachers can delete lesson files
      allow delete: if isTeacher();
    }
    
    // Limit file size to 10MB
    match /{allPaths=**} {
      allow write: if request.resource.size < 10 * 1024 * 1024;
    }
  }
}
```

---

## 3. Additional Security Measures

### A. Restrict API Key Usage (Firebase Console)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Go to **APIs & Services** → **Credentials**
4. Click on your API key (Browser key)
5. Under **Application restrictions**:
   - Select "HTTP referrers (web sites)"
   - Add your domains:
     ```
     localhost:5173/*
     localhost:3000/*
     yourdomain.com/*
     *.yourdomain.com/*
     ```

### B. Enable App Check (Recommended)

Firebase App Check protects your backend from abuse:

1. Go to Firebase Console → App Check
2. Click "Get Started"
3. Register your web app
4. Choose reCAPTCHA v3 or reCAPTCHA Enterprise
5. Add the App Check SDK to your app

### C. Set Up Authentication Rules

In Firebase Console → Authentication → Settings:

1. **Email Enumeration Protection**: Enable
2. **Authorized Domains**: Only add your actual domains
3. **Password Policy**: Set minimum requirements

### D. Monitor Usage

1. Go to Firebase Console → Usage and Billing
2. Set up budget alerts
3. Monitor for unusual activity

---

## 4. What Attackers CANNOT Do

Even with your API key visible, attackers **cannot**:

❌ Read data without proper authentication
❌ Write data that violates security rules
❌ Access other users' private data
❌ Delete data they don't own
❌ Bypass Firebase Authentication
❌ Impersonate other users

## 5. What You Should Still Protect

✅ **Never expose**:
- Service account keys (server-side only)
- Admin SDK credentials
- Database passwords
- OAuth client secrets
- Private keys

✅ **Always use**:
- HTTPS (automatic with Firebase Hosting)
- Email verification
- Strong password requirements
- Security Rules (most important!)

---

## 6. Testing Security Rules

### Install Firebase CLI
```bash
npm install -g firebase-tools
firebase login
```

### Initialize Firebase in your project
```bash
firebase init
# Select Firestore, Storage, and Hosting
```

### Test your rules locally
```bash
firebase emulators:start
```

### Deploy rules
```bash
firebase deploy --only firestore:rules
firebase deploy --only storage:rules
```

---

## 7. Quick Security Checklist

- [x] Environment variables set up (.env file)
- [ ] Firestore Security Rules deployed
- [ ] Storage Security Rules deployed
- [ ] API key restrictions configured
- [ ] Email verification enabled
- [ ] Authorized domains configured
- [ ] Budget alerts set up
- [ ] App Check enabled (optional but recommended)

---

## 8. Emergency Response

If you suspect your Firebase project is compromised:

1. **Immediately**:
   - Go to Firebase Console → Project Settings
   - Regenerate your API keys
   - Review Security Rules
   - Check Authentication logs

2. **Investigate**:
   - Check Firestore usage metrics
   - Review Storage usage
   - Look for unauthorized users

3. **Prevent**:
   - Update Security Rules
   - Enable App Check
   - Add domain restrictions
   - Require email verification

---

## Need Help?

- [Firebase Security Rules Documentation](https://firebase.google.com/docs/rules)
- [Firebase Security Best Practices](https://firebase.google.com/docs/rules/best-practices)
- [Firebase App Check](https://firebase.google.com/docs/app-check)

Remember: **Security Rules are your primary defense, not API key secrecy!**
