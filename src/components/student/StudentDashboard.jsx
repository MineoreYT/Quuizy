import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db, auth } from '../../config/firebase';
import TakeQuiz from './TakeQuiz';
import StudentClassView from './StudentClassView';
import Toast from '../Toast';
import { useToast } from '../../hooks/useToast';
import { sanitizeClassCode } from '../../utils/sanitize';

export default function StudentDashboard() {
  const [classes, setClasses] = useState([]);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [classCode, setClassCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState('');
  const [userName, setUserName] = useState('Student');
  const [loading, setLoading] = useState(true);
  const [selectedClassForQuiz, setSelectedClassForQuiz] = useState(null);
  const [selectedClassForView, setSelectedClassForView] = useState(null);
  const { toasts, showToast, removeToast } = useToast();

  useEffect(() => {
    fetchUserData();
    fetchClasses();
  }, []);

  const fetchUserData = async () => {
    try {
      const user = auth.currentUser;
      if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          setUserName(userDoc.data().fullName || 'Student');
        }
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  const fetchClasses = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const classesSnapshot = await getDocs(collection(db, 'classes'));
      const enrolledClasses = [];

      classesSnapshot.forEach((docSnapshot) => {
        const classData = docSnapshot.data();
        if (classData.students && classData.students.includes(user.uid)) {
          enrolledClasses.push({
            id: docSnapshot.id,
            ...classData
          });
        }
      });

      setClasses(enrolledClasses);
    } catch (error) {
      console.error('Error fetching classes:', error);
      showToast('Failed to load classes. Please refresh the page.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinClass = async () => {
    if (!classCode.trim()) {
      setError('Please enter a class code');
      return;
    }

    if (classCode.length !== 6) {
      setError('Class code must be 6 characters');
      return;
    }

    setIsJoining(true);
    setError('');

    try {
      const user = auth.currentUser;
      
      // Sanitize class code before querying
      const sanitizedCode = sanitizeClassCode(classCode);
      
      const q = query(
        collection(db, 'classes'),
        where('code', '==', sanitizedCode)
      );
      
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setError('Class not found. Please check the code and try again.');
        setIsJoining(false);
        return;
      }

      const classDoc = querySnapshot.docs[0];
      const classData = classDoc.data();

      if (classData.students && classData.students.includes(user.uid)) {
        setError('You are already enrolled in this class');
        setIsJoining(false);
        return;
      }

      await updateDoc(doc(db, 'classes', classDoc.id), {
        students: arrayUnion(user.uid)
      });

      const newClass = {
        id: classDoc.id,
        ...classData,
        students: [...(classData.students || []), user.uid]
      };

      setClasses([...classes, newClass]);
      setShowJoinModal(false);
      setClassCode('');
      showToast(`Successfully joined ${classData.name}!`, 'success');
      
    } catch (error) {
      console.error('Error joining class:', error);
      setError('Failed to join class. Please try again.');
    } finally {
      setIsJoining(false);
    }
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
      window.location.hash = '#/login';
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Show TakeQuiz component if a class is selected for quiz
  if (selectedClassForQuiz) {
    return (
      <TakeQuiz 
        classId={selectedClassForQuiz} 
        onBack={() => setSelectedClassForQuiz(null)} 
      />
    );
  }

  // Show StudentClassView if a class is selected for viewing
  if (selectedClassForView) {
    return (
      <StudentClassView 
        classData={selectedClassForView}
        onBack={() => setSelectedClassForView(null)}
        onTakeQuiz={(classId) => {
          setSelectedClassForView(null);
          setSelectedClassForQuiz(classId);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center">
              <h1 className="text-xl sm:text-2xl font-bold text-indigo-600">BrainSpark</h1>
              <span className="ml-3 sm:ml-4 px-2 sm:px-3 py-1 bg-green-100 text-green-700 text-xs sm:text-sm font-medium rounded-full">
                Student
              </span>
            </div>
            <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto justify-between sm:justify-end">
              <span className="text-sm sm:text-base text-gray-700 truncate">Welcome, {userName}!</span>
              <button
                onClick={handleLogout}
                className="px-3 sm:px-4 py-1.5 sm:py-2 text-sm sm:text-base text-gray-700 hover:text-gray-900 font-medium whitespace-nowrap"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-800">My Classes</h2>
          <button
            onClick={() => setShowJoinModal(true)}
            className="w-full sm:w-auto px-4 sm:px-6 py-2 sm:py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium flex items-center justify-center gap-2 text-sm sm:text-base"
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Join Class
          </button>
        </div>

        {classes.length === 0 ? (
          <div className="text-center py-12">
            <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <h3 className="text-xl font-medium text-gray-700 mb-2">No classes yet</h3>
            <p className="text-gray-500 mb-6">Join your first class using a class code!</p>
            <button
              onClick={() => setShowJoinModal(true)}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium"
            >
              Join Class
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {classes.map((classItem) => (
              <div key={classItem.id} className="bg-white rounded-lg shadow hover:shadow-lg transition p-4 sm:p-6">
                <div className="mb-3 sm:mb-4">
                  <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-1 truncate">{classItem.name}</h3>
                  <p className="text-gray-600 text-xs sm:text-sm mb-2 line-clamp-2">{classItem.description}</p>
                  <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-600">
                    <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span className="truncate">{classItem.teacherName}</span>
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-3 sm:pt-4 mb-3 sm:mb-4">
                  <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-600">
                    <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    <span>{classItem.students ? classItem.students.length : 0} students enrolled</span>
                  </div>
                </div>

                <button 
                  onClick={() => setSelectedClassForView(classItem)}
                  className="w-full py-2 sm:py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium text-sm sm:text-base"
                >
                  View Class →
                </button>
              </div>
            ))}
          </div>
        )}
      </main>

      {showJoinModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-800">Join a Class</h3>
              <button
                onClick={() => {
                  setShowJoinModal(false);
                  setClassCode('');
                  setError('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Enter Class Code
                </label>
                <input
                  type="text"
                  value={classCode}
                  onChange={(e) => {
                    setClassCode(e.target.value.toUpperCase());
                    setError('');
                  }}
                  maxLength={6}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-center text-2xl font-bold tracking-wider uppercase"
                  placeholder="ABC123"
                />
                {error && (
                  <p className="text-red-500 text-sm mt-2">{error}</p>
                )}
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  <strong>Tip:</strong> Ask your teacher for the 6-character class code to join their class.
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowJoinModal(false);
                    setClassCode('');
                    setError('');
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleJoinClass}
                  disabled={isJoining || classCode.length !== 6}
                  className={`flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium ${
                    (isJoining || classCode.length !== 6) ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {isJoining ? 'Joining...' : 'Join Class'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      {toasts.map(toast => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={() => removeToast(toast.id)}
          duration={toast.duration}
        />
      ))}
    </div>
  );
}