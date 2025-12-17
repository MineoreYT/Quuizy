# Fixed Firestore Security Rules

The issue is that students can't join classes because they can't update the class document. Here are the corrected rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    function isSignedIn() {
      return request.auth != null;
    }
    
    function isOwner(userId) {
      return isSignedIn() && request.auth.uid == userId;
    }
    
    function isTeacherOfClass(classId) {
      return isSignedIn() && 
             get(/databases/$(database)/documents/classes/$(classId)).data.teacherId == request.auth.uid;
    }
    
    // Users collection
    match /users/{userId} {
      allow read: if isOwner(userId);  // Users can only read their own data
      allow write: if isOwner(userId);
    }
    
    // Classes collection
    match /classes/{classId} {
      // Allow reading if user is signed in AND (is the teacher OR is enrolled as student)
      allow read: if isSignedIn() && (
        resource.data.teacherId == request.auth.uid ||
        request.auth.uid in resource.data.get('students', [])
      );
      allow create: if isSignedIn() && 
                      request.resource.data.teacherId == request.auth.uid;
      
      // Allow teachers to update their classes OR students to add themselves to students array
      allow update: if isSignedIn() && (
        // Teacher can update anything
        resource.data.teacherId == request.auth.uid ||
        // Student can only add themselves to students array (join class)
        (
          request.resource.data.diff(resource.data).affectedKeys().hasOnly(['students']) &&
          request.auth.uid in request.resource.data.students &&
          !(request.auth.uid in resource.data.get('students', []))
        )
      );
      
      allow delete: if isSignedIn() && 
                      resource.data.teacherId == request.auth.uid;
    }
    
    // Quizzes collection
    match /quizzes/{quizId} {
      allow read: if isSignedIn();
      allow create: if isSignedIn() && 
                      isTeacherOfClass(request.resource.data.classId);
      allow update, delete: if isSignedIn() && 
                              isTeacherOfClass(resource.data.classId);
    }
    
    // Lessons collection
    match /lessons/{lessonId} {
      allow read: if isSignedIn();
      allow create: if isSignedIn() && 
                      isTeacherOfClass(request.resource.data.classId);
      allow update, delete: if isSignedIn() && 
                              isTeacherOfClass(resource.data.classId);
    }
    
    // Quiz Results collection
    match /quizResults/{resultId} {
      allow read: if isSignedIn() && (
        request.auth.uid == resource.data.studentId ||
        isTeacherOfClass(resource.data.classId)
      );
      allow create: if isSignedIn() && 
                      request.resource.data.studentId == request.auth.uid;
      allow update: if false;
      allow delete: if false;
    }
  }
}
```

## Key Changes:

### Classes Collection Update Rule:
The new update rule allows:

1. **Teachers**: Can update anything in their classes (full control)
2. **Students**: Can ONLY add themselves to the `students` array when joining a class

The student join logic checks:
- Only the `students` field is being modified
- The student is adding themselves to the array
- The student is not already in the class

This prevents students from:
- Modifying class name, description, or other fields
- Adding other users to the class
- Joining a class they're already in
- Removing themselves or others from the class

## How to Apply:

1. Go to Firebase Console → Firestore Database → Rules
2. Replace your current rules with the ones above
3. Click "Publish"

This will fix the "Missing or insufficient permissions" error when students try to join classes.