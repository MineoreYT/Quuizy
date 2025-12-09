# Cloud Functions Setup Guide

## 🎯 What This Fixes

**Problem:** Quiz answers are visible in the browser, allowing tech-savvy students to cheat.

**Solution:** Cloud Functions validate answers on the server. Students never see correct answers.

---

## 📋 Prerequisites

1. **Firebase Blaze Plan (Pay-as-you-go)**
   - Cloud Functions require the Blaze plan
   - Free tier includes: 2M invocations/month, 400K GB-seconds/month
   - For a small school, this should be FREE or cost < $1/month
   - [Upgrade here](https://console.firebase.google.com/)

2. **Node.js 18+** (already installed)

3. **Firebase CLI** (already installed)

---

## 🚀 Deployment Steps

### Step 1: Deploy Cloud Functions

```bash
# Navigate to your project root
cd C:\Users\FUJITSU\Desktop\quizzie

# Deploy functions to Firebase
firebase deploy --only functions
```

This will deploy two functions:
- `submitQuiz` - Validates quiz answers server-side
- `getQuizQuestions` - Returns quiz questions without answers

### Step 2: Update Client Code (OPTIONAL)

The current implementation still works, but if you want maximum security, you can update `TakeQuiz.jsx` to use the Cloud Functions.

**Current Flow (Less Secure):**
1. Student fetches quiz with correct answers
2. Student submits answers
3. Client calculates score
4. Client saves result to Firestore

**New Flow (More Secure):**
1. Student fetches quiz WITHOUT correct answers (via Cloud Function)
2. Student submits answers to Cloud Function
3. Server validates answers and calculates score
4. Server saves result to Firestore
5. Server returns only the score (not correct answers)

---

## 🧪 Testing Cloud Functions

### Test 1: Deploy Functions

```bash
firebase deploy --only functions
```

Expected output:
```
✔  functions: Finished running predeploy script.
i  functions: preparing functions directory for uploading...
✔  functions: functions folder uploaded successfully
i  functions: creating Node.js 18 function submitQuiz...
i  functions: creating Node.js 18 function getQuizQuestions...
✔  functions[submitQuiz]: Successful create operation.
✔  functions[getQuizQuestions]: Successful create operation.

✔  Deploy complete!
```

### Test 2: Check Functions in Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Click "Functions" in left sidebar
4. You should see:
   - `submitQuiz`
   - `getQuizQuestions`

### Test 3: Test submitQuiz Function

In your browser console (F12), run:

```javascript
import { getFunctions, httpsCallable } from 'firebase/functions';
const functions = getFunctions();
const submitQuiz = httpsCallable(functions, 'submitQuiz');

// Test with a real quiz ID
const result = await submitQuiz({
  quizId: 'YOUR_QUIZ_ID',
  classId: 'YOUR_CLASS_ID',
  answers: [0, 1, 2]  // Example answers
});

console.log(result.data);
// Should return: { success: true, score: 67, correctAnswers: 2, totalQuestions: 3 }
```

---

## 💰 Cost Estimate

### Free Tier (Blaze Plan)
- **Invocations:** 2,000,000/month FREE
- **Compute time:** 400,000 GB-seconds/month FREE
- **Outbound networking:** 5GB/month FREE

### Example Usage
- 100 students
- 10 quizzes per month per student
- = 1,000 quiz submissions/month
- **Cost: $0** (well within free tier)

### When You'd Pay
- 200,000+ quiz submissions/month
- Even then, cost would be ~$0.40 per 1M invocations

**Conclusion:** For a typical school, Cloud Functions are essentially FREE.

---

## 🔒 Security Benefits

### Before Cloud Functions:
```javascript
// Student can see this in browser:
const quiz = {
  questions: [
    {
      question: "What is 2+2?",
      options: ["3", "4", "5", "6"],
      correctAnswer: 1  // ← VISIBLE TO STUDENT!
    }
  ]
};
```

### After Cloud Functions:
```javascript
// Student only sees this:
const quiz = {
  questions: [
    {
      question: "What is 2+2?",
      options: ["3", "4", "5", "6"]
      // correctAnswer is NOT sent to client
    }
  ]
};

// When student submits:
const result = await submitQuiz({ quizId, classId, answers: [1] });
// Server validates and returns: { score: 100, correctAnswers: 1 }
// Student never sees which answer was correct!
```

---

## 🛠️ How It Works

### submitQuiz Function

1. **Authentication Check:** Verifies user is logged in
2. **Enrollment Check:** Verifies student is enrolled in the class
3. **Deadline Check:** Verifies quiz hasn't passed deadline
4. **Duplicate Check:** Prevents submitting same quiz twice
5. **Server-Side Grading:** Compares answers with correct answers (on server)
6. **Save Result:** Saves to Firestore with server timestamp
7. **Return Score:** Returns only the score, NOT the correct answers

### getQuizQuestions Function

1. **Authentication Check:** Verifies user is logged in
2. **Fetch Quiz:** Gets quiz from Firestore
3. **Remove Answers:** Strips out `correctAnswer` fields
4. **Return Questions:** Returns questions without answers

---

## 📝 Updating Client Code (Optional)

If you want to use the secure Cloud Functions, update `TakeQuiz.jsx`:

### Current Code (Line ~95):
```javascript
const handleSubmit = async () => {
  // ... validation ...
  
  // Client-side grading (less secure)
  let correctCount = 0;
  selectedQuiz.questions.forEach((question, index) => {
    if (answers[index] === question.correctAnswer) {
      correctCount++;
    }
  });
  
  const finalScore = Math.round((correctCount / selectedQuiz.questions.length) * 100);
  
  await addDoc(collection(db, 'quizResults'), {
    // ... save result ...
  });
};
```

### New Code (More Secure):
```javascript
import { submitQuizSecure } from '../../services/cloudFunctions';

const handleSubmit = async () => {
  // ... validation ...
  
  try {
    // Server-side grading (more secure)
    const result = await submitQuizSecure(
      selectedQuiz.id,
      classId,
      answers
    );
    
    setScore(result.score);
    setShowResults(true);
    
    // Add to completed quizzes
    setCompletedQuizzes(prev => new Set([...prev, selectedQuiz.id]));
    
    alert(`Quiz submitted! Your score: ${result.score}%`);
  } catch (error) {
    console.error('Error submitting quiz:', error);
    alert('Failed to submit quiz. Please try again.');
  }
};
```

---

## 🚨 Important Notes

1. **Blaze Plan Required:** You MUST upgrade to Blaze plan to use Cloud Functions
2. **Free Tier is Generous:** Most schools will stay within free tier
3. **Set Billing Alerts:** Set up alerts in Firebase Console to monitor usage
4. **Test Before Deploying:** Test functions locally with Firebase Emulator Suite
5. **Monitor Usage:** Check Firebase Console > Functions > Usage tab regularly

---

## 🔄 Rollback Plan

If you want to disable Cloud Functions:

1. Keep current client-side validation (already working)
2. Don't update `TakeQuiz.jsx` to use Cloud Functions
3. Delete functions: `firebase functions:delete submitQuiz getQuizQuestions`

The app will continue working with client-side validation (less secure but functional).

---

## 📊 Security Score

**Without Cloud Functions:** 8/10  
**With Cloud Functions:** 9.5/10  

The only remaining limitation would be rate limiting (requires App Check).

---

## 🆘 Troubleshooting

### Error: "Billing account not configured"
**Solution:** Upgrade to Blaze plan in Firebase Console

### Error: "Function not found"
**Solution:** Run `firebase deploy --only functions` again

### Error: "CORS error"
**Solution:** Cloud Functions automatically handle CORS, but ensure you're calling from the same Firebase project

### Error: "Permission denied"
**Solution:** Check Firebase Security Rules and ensure user is authenticated

---

## 📞 Need Help?

1. Check Firebase Console > Functions > Logs for errors
2. Check browser console (F12) for client-side errors
3. Test functions in Firebase Console > Functions > Testing tab
4. Review this guide and `functions/index.js` for implementation details

---

**Last Updated:** December 8, 2025  
**Status:** Ready to Deploy (requires Blaze plan)
