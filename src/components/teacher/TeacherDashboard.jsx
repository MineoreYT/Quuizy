import { useState, useEffect } from 'react';
import { collection, addDoc, query, where, getDocs, doc, getDoc, deleteDoc, updateDoc, arrayRemove } from 'firebase/firestore';
import { db, auth } from '../../config/firebase';
import ClassDetails from './ClassDetails';
import Toast from '../Toast';
import ConfirmModal from '../ConfirmModal';
import { useToast } from '../../hooks/useToast';
import { sanitizeText, sanitizeUrl } from '../../utils/sanitize';
import { DEFAULT_GRADING_SCALES, calculateTotalPoints } from '../../utils/grading';

export default function TeacherDashboard() {
  const [classes, setClasses] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [showLessonModal, setShowLessonModal] = useState(false);
  const [selectedClass, setSelectedClass] = useState(null);
  const [selectedClassForDetails, setSelectedClassForDetails] = useState(null);
  const [newClassName, setNewClassName] = useState('');
  const [newClassDescription, setNewClassDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [userName, setUserName] = useState('Teacher');
  const [loading, setLoading] = useState(true);

  // Lesson form state
  const [lessonTitle, setLessonTitle] = useState('');
  const [lessonContent, setLessonContent] = useState('');
  const [lessonLinks, setLessonLinks] = useState(['']);
  const [isUploadingLesson, setIsUploadingLesson] = useState(false);

  // Quiz form state
  const [quizTitle, setQuizTitle] = useState('');
  const [quizDeadline, setQuizDeadline] = useState('');
  const [questions, setQuestions] = useState([
    { type: 'multiple-choice', question: '', options: ['', '', '', ''], correctAnswer: 0, points: 1 }
  ]);
  
  // Grading system state
  const [gradingScale, setGradingScale] = useState('traditional');
  const [customGradingScale, setCustomGradingScale] = useState(null);
  const [passingGrade, setPassingGrade] = useState(70);
  const [totalPoints, setTotalPoints] = useState(1);

  // Toast and confirmation modal
  const { toasts, showToast, removeToast } = useToast();
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null });

  useEffect(() => {
    fetchUserData();
    fetchClasses();
  }, []);

  // Update total points when questions change
  useEffect(() => {
    if (questions && questions.length > 0) {
      const total = calculateTotalPoints(questions);
      setTotalPoints(total);
    }
  }, [questions]);

  const fetchUserData = async () => {
    try {
      const user = auth.currentUser;
      if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          setUserName(userDoc.data().fullName || 'Teacher');
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

      const q = query(
        collection(db, 'classes'),
        where('teacherId', '==', user.uid)
      );
      
      const querySnapshot = await getDocs(q);
      const classesData = [];
      
      for (const docSnapshot of querySnapshot.docs) {
        const classData = docSnapshot.data();
        const studentsCount = classData.students ? classData.students.length : 0;
        
        classesData.push({
          id: docSnapshot.id,
          ...classData,
          studentsCount
        });
      }
      
      setClasses(classesData);
    } catch (error) {
      console.error('Error fetching classes:', error);
      alert('Failed to load classes. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  };

  const generateClassCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const handleCreateClass = async () => {
    if (!newClassName.trim()) {
      showToast('Please enter a class name', 'warning');
      return;
    }

    setIsCreating(true);

    try {
      const user = auth.currentUser;
      const classCode = generateClassCode();
      
      // Sanitize inputs
      const sanitizedName = sanitizeText(newClassName, 200);
      const sanitizedDescription = sanitizeText(newClassDescription, 1000);
      
      const newClass = {
        name: sanitizedName,
        description: sanitizedDescription,
        code: classCode,
        teacherId: user.uid,
        teacherName: userName,
        students: [],
        quizzes: [],
        createdAt: new Date().toISOString()
      };

      const docRef = await addDoc(collection(db, 'classes'), newClass);
      
      setClasses([...classes, { id: docRef.id, ...newClass, studentsCount: 0 }]);
      setShowCreateModal(false);
      setNewClassName('');
      setNewClassDescription('');
      
      showToast(`Class created successfully! Class code: ${classCode}`, 'success', 5000);
      
    } catch (error) {
      console.error('Error creating class:', error);
      showToast('Failed to create class. Please try again.', 'error');
    } finally {
      setIsCreating(false);
    }
  };

  const handleAddQuestion = (type = 'multiple-choice') => {
    if (type === 'enumeration') {
      setQuestions([...questions, { type: 'enumeration', question: '', correctAnswer: '', points: 1 }]);
    } else {
      setQuestions([...questions, { type: 'multiple-choice', question: '', options: ['', '', '', ''], correctAnswer: 0, points: 1 }]);
    }
    updateTotalPoints();
  };

  const handleQuestionTypeChange = (index, type) => {
    const newQuestions = [...questions];
    const currentPoints = newQuestions[index].points || 1;
    if (type === 'enumeration') {
      newQuestions[index] = { type: 'enumeration', question: newQuestions[index].question, correctAnswer: '', points: currentPoints };
    } else {
      newQuestions[index] = { type: 'multiple-choice', question: newQuestions[index].question, options: ['', '', '', ''], correctAnswer: 0, points: currentPoints };
    }
    setQuestions(newQuestions);
  };

  const handleRemoveQuestion = (index) => {
    if (questions.length > 1) {
      setQuestions(questions.filter((_, i) => i !== index));
      updateTotalPoints();
    }
  };

  const handleQuestionChange = (index, value) => {
    const newQuestions = [...questions];
    newQuestions[index].question = value;
    setQuestions(newQuestions);
  };

  const handleOptionChange = (qIndex, oIndex, value) => {
    const newQuestions = [...questions];
    newQuestions[qIndex].options[oIndex] = value;
    setQuestions(newQuestions);
  };

  const handleCorrectAnswerChange = (qIndex, value) => {
    const newQuestions = [...questions];
    newQuestions[qIndex].correctAnswer = value;
    setQuestions(newQuestions);
  };

  const handlePointsChange = (qIndex, points) => {
    const newQuestions = [...questions];
    newQuestions[qIndex].points = Math.max(1, parseInt(points) || 1);
    setQuestions(newQuestions);
    updateTotalPoints();
  };

  const updateTotalPoints = () => {
    setTimeout(() => {
      if (questions && questions.length > 0) {
        const total = calculateTotalPoints(questions);
        setTotalPoints(total);
      }
    }, 0);
  };

  const handleAddLink = () => {
    setLessonLinks([...lessonLinks, '']);
  };

  const handleLinkChange = (index, value) => {
    const newLinks = [...lessonLinks];
    newLinks[index] = value;
    setLessonLinks(newLinks);
  };

  const handleRemoveLink = (index) => {
    setLessonLinks(lessonLinks.filter((_, i) => i !== index));
  };

  const handleCreateLesson = async () => {
    if (!lessonTitle.trim()) {
      showToast('Please enter a lesson title', 'warning');
      return;
    }

    setIsUploadingLesson(true);

    try {
      // Sanitize inputs
      const sanitizedTitle = sanitizeText(lessonTitle, 200);
      const sanitizedContent = sanitizeText(lessonContent, 10000);
      
      // Filter and sanitize links
      const validLinks = lessonLinks
        .map(link => sanitizeUrl(link))
        .filter(link => link.length > 0);

      const lessonData = {
        title: sanitizedTitle,
        content: sanitizedContent,
        links: validLinks,
        classId: selectedClass.id,
        createdAt: new Date().toISOString(),
        createdBy: auth.currentUser.uid
      };

      await addDoc(collection(db, 'lessons'), lessonData);
      
      showToast('Lesson posted successfully!', 'success');
      setShowLessonModal(false);
      setLessonTitle('');
      setLessonContent('');
      setLessonLinks(['']);
      setSelectedClass(null);
      
    } catch (error) {
      console.error('Error creating lesson:', error);
      showToast('Failed to create lesson. Please try again.', 'error');
    } finally {
      setIsUploadingLesson(false);
    }
  };

  const handleCreateQuiz = async () => {
    if (!quizTitle.trim()) {
      showToast('Please enter a quiz title', 'warning');
      return;
    }

    const isValid = questions.every(q => {
      if (!q.question.trim()) return false;
      if (q.type === 'multiple-choice') {
        return q.options.every(o => o.trim());
      } else {
        return q.correctAnswer.trim();
      }
    });

    if (!isValid) {
      showToast('Please fill in all questions and their answers', 'warning');
      return;
    }

    try {
      // Basic sanitization only (remove HTML tags) with strict undefined checking
      const sanitizedTitle = sanitizeText(quizTitle, 200);
      const sanitizedQuestions = questions.map(q => {
        const baseQuestion = {
          type: q.type || 'multiple-choice',
          question: sanitizeText(q.question || '', 500),
          points: q.points || 1
        };

        if (q.type === 'enumeration') {
          return {
            ...baseQuestion,
            correctAnswer: sanitizeText(q.correctAnswer || '', 200)
          };
        } else {
          return {
            ...baseQuestion,
            options: q.options ? q.options.map(opt => sanitizeText(opt || '', 200)) : ['', '', '', ''],
            correctAnswer: q.correctAnswer || 0
          };
        }
      });
      
      // Ensure we have a valid grading scale
      console.log('Grading scale debug:', { 
        customGradingScale, 
        gradingScale, 
        available: Object.keys(DEFAULT_GRADING_SCALES),
        selected: DEFAULT_GRADING_SCALES[gradingScale]
      });
      const selectedGradingScale = customGradingScale || DEFAULT_GRADING_SCALES[gradingScale] || DEFAULT_GRADING_SCALES.traditional;
      
      // Create quiz data with no undefined values
      const quizData = {
        title: sanitizedTitle,
        questions: sanitizedQuestions,
        classId: selectedClass?.id || '',
        deadline: (quizDeadline && quizDeadline.trim() !== '') ? quizDeadline : null,
        gradingScale: selectedGradingScale,
        passingGrade: passingGrade || 70,
        totalPoints: calculateTotalPoints(sanitizedQuestions),
        createdAt: new Date().toISOString(),
        createdBy: auth.currentUser?.uid || ''
      };

      // Function to remove undefined values recursively
      const removeUndefined = (obj) => {
        if (obj === null || obj === undefined) return null;
        if (typeof obj !== 'object') return obj;
        if (Array.isArray(obj)) return obj.map(removeUndefined);
        
        const cleaned = {};
        for (const [key, value] of Object.entries(obj)) {
          if (value !== undefined) {
            cleaned[key] = removeUndefined(value);
          }
        }
        return cleaned;
      };

      const cleanedQuizData = removeUndefined(quizData);
      
      // Debug: Log the quiz data to check for undefined values
      console.log('Original questions:', questions);
      console.log('Sanitized questions:', sanitizedQuestions);
      console.log('Quiz data before cleaning:', quizData);
      console.log('Quiz data after cleaning:', cleanedQuizData);

      await addDoc(collection(db, 'quizzes'), cleanedQuizData);
      
      showToast('Quiz created successfully!', 'success');
      setShowQuizModal(false);
      setQuizTitle('');
      setQuizDeadline('');
      setQuestions([{ type: 'multiple-choice', question: '', options: ['', '', '', ''], correctAnswer: 0, points: 1 }]);
      setGradingScale('traditional');
      setCustomGradingScale(null);
      setPassingGrade(70);
      setTotalPoints(1);
      setSelectedClass(null);
      
    } catch (error) {
      console.error('Error creating quiz:', error);
      showToast('Failed to create quiz. Please try again.', 'error');
    }
  };

  const handleDeleteClass = async (classId, className) => {
    setConfirmModal({
      isOpen: true,
      title: '⚠️ Delete Class',
      message: `Are you sure you want to delete "${className}"?\n\nThis will:\n• Remove the class permanently\n• Delete all quizzes and lessons\n• Delete all quiz results\n• Remove from all enrolled students\n\nThis action cannot be undone!`,
      onConfirm: () => performDeleteClass(classId, className)
    });
  };

  const performDeleteClass = async (classId, className) => {

    try {
      // Delete all quizzes for this class
      const quizzesQuery = query(collection(db, 'quizzes'), where('classId', '==', classId));
      const quizzesSnapshot = await getDocs(quizzesQuery);
      const quizDeletePromises = quizzesSnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(quizDeletePromises);

      // Delete all lessons for this class
      const lessonsQuery = query(collection(db, 'lessons'), where('classId', '==', classId));
      const lessonsSnapshot = await getDocs(lessonsQuery);
      const lessonDeletePromises = lessonsSnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(lessonDeletePromises);

      // Delete all quiz results for this class
      const resultsQuery = query(collection(db, 'quizResults'), where('classId', '==', classId));
      const resultsSnapshot = await getDocs(resultsQuery);
      const resultDeletePromises = resultsSnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(resultDeletePromises);

      // Delete the class itself
      await deleteDoc(doc(db, 'classes', classId));

      // Update local state
      setClasses(classes.filter(c => c.id !== classId));
      
      showToast('Class deleted successfully!', 'success');
    } catch (error) {
      console.error('Error deleting class:', error);
      showToast('Failed to delete class. Please try again.', 'error');
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

  const copyClassCode = (code) => {
    navigator.clipboard.writeText(code);
    showToast('Class code copied to clipboard!', 'success', 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Show ClassDetails if a class is selected
  if (selectedClassForDetails) {
    return (
      <ClassDetails 
        classId={selectedClassForDetails} 
        onBack={() => {
          setSelectedClassForDetails(null);
          fetchClasses(); // Refresh classes when returning
        }} 
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center">
              <h1 className="text-xl sm:text-2xl font-bold text-indigo-600">BrainSpark</h1>
              <span className="ml-3 sm:ml-4 px-2 sm:px-3 py-1 bg-indigo-100 text-indigo-700 text-xs sm:text-sm font-medium rounded-full">
                Teacher
              </span>
            </div>
            <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto justify-between sm:justify-end">
              <span className="text-sm sm:text-base text-gray-700 truncate">Welcome, {userName}!</span>
              <button
                onClick={handleLogout}
                className="px-3 sm:px-4 py-2 text-sm sm:text-base text-gray-700 hover:text-gray-900 font-medium"
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
            onClick={() => setShowCreateModal(true)}
            className="w-full sm:w-auto px-4 sm:px-6 py-2 sm:py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium flex items-center justify-center gap-2 text-sm sm:text-base"
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create New Class
          </button>
        </div>

        {classes.length === 0 ? (
          <div className="text-center py-12">
            <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <h3 className="text-xl font-medium text-gray-700 mb-2">No classes yet</h3>
            <p className="text-gray-500 mb-6">Create your first class to get started!</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium"
            >
              Create Class
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {classes.map((classItem) => (
              <div key={classItem.id} className="bg-white rounded-lg shadow hover:shadow-lg transition p-4 sm:p-6">
                <div className="flex items-start justify-between mb-3 sm:mb-4">
                  <div className="flex-1 min-w-0 pr-2">
                    <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-1 truncate">{classItem.name}</h3>
                    <p className="text-gray-600 text-xs sm:text-sm line-clamp-2">{classItem.description}</p>
                  </div>
                  <button
                    onClick={() => handleDeleteClass(classItem.id, classItem.name)}
                    className="p-1.5 sm:p-2 text-red-500 hover:bg-red-50 rounded-lg transition flex-shrink-0"
                    title="Delete Class"
                  >
                    <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>

                <div className="border-t border-gray-200 pt-3 sm:pt-4 mb-3 sm:mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs sm:text-sm text-gray-600">Class Code:</span>
                    <button
                      onClick={() => copyClassCode(classItem.code)}
                      className="text-indigo-600 hover:text-indigo-700 text-xs sm:text-sm font-medium"
                    >
                      Copy
                    </button>
                  </div>
                  <div className="bg-indigo-50 border-2 border-indigo-200 rounded-lg p-2 sm:p-3 text-center mb-2 sm:mb-3">
                    <span className="text-xl sm:text-2xl font-bold text-indigo-700 tracking-wider">{classItem.code}</span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs sm:text-sm text-gray-600 mb-3 gap-2">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    <span>{classItem.studentsCount} students</span>
                  </div>
                  <button 
                    onClick={() => setSelectedClassForDetails(classItem.id)}
                    className="text-indigo-600 hover:text-indigo-700 font-medium text-xs sm:text-sm"
                  >
                    View Details →
                  </button>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    onClick={() => {
                      setSelectedClass(classItem);
                      setShowLessonModal(true);
                    }}
                    className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium text-sm"
                  >
                    Post Lesson
                  </button>
                  <button
                    onClick={() => {
                      setSelectedClass(classItem);
                      setShowQuizModal(true);
                    }}
                    className="flex-1 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium text-sm"
                  >
                    Create Quiz
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-800">Create New Class</h3>
              <button
                onClick={() => setShowCreateModal(false)}
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
                  Class Name *
                </label>
                <input
                  type="text"
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="e.g., Math 101"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description (Optional)
                </label>
                <textarea
                  value={newClassDescription}
                  onChange={(e) => setNewClassDescription(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Brief description of the class"
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> A unique 6-character class code will be automatically generated for students to join.
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateClass}
                  disabled={isCreating}
                  className={`flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium ${
                    isCreating ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {isCreating ? 'Creating...' : 'Create Class'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showQuizModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full p-6 my-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-800">Create Quiz for {selectedClass?.name}</h3>
              <button
                onClick={() => {
                  setShowQuizModal(false);
                  setQuizTitle('');
                  setQuizDeadline('');
                  setQuestions([{ type: 'multiple-choice', question: '', options: ['', '', '', ''], correctAnswer: 0, points: 1 }]);
                  setGradingScale('traditional');
                  setCustomGradingScale(null);
                  setPassingGrade(70);
                  setTotalPoints(1);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quiz Title *</label>
                <input
                  type="text"
                  value={quizTitle}
                  onChange={(e) => setQuizTitle(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="e.g., Chapter 1 Quiz"
                />
              </div>

              {/* Grading Configuration */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-gray-800 mb-3">Grading Configuration</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Grading Scale</label>
                    <select
                      value={gradingScale}
                      onChange={(e) => setGradingScale(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    >
                      <option value="traditional">Traditional A-F</option>
                      <option value="plusMinus">Plus/Minus System</option>
                      <option value="passFail">Pass/Fail</option>
                      <option value="excellent">Excellence Scale</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Passing Grade (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={passingGrade}
                      onChange={(e) => setPassingGrade(parseInt(e.target.value) || 70)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>
                </div>
                
                <div className="mt-3 p-3 bg-white rounded border">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">Total Points:</span>
                    <span className="text-lg font-bold text-green-600">{totalPoints}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Automatically calculated from individual question points
                  </p>
                </div>
              </div>
              {/* ADD THIS DEADLINE SECTION */}
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">
      Deadline (Optional)
    </label>
    <input
      type="datetime-local"
      value={quizDeadline}
      onChange={(e) => setQuizDeadline(e.target.value)}
      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
    />
    <p className="text-sm text-gray-500 mt-1">
      Students won't be able to take the quiz after this date
    </p>
  </div>
  {/* END OF DEADLINE SECTION */}

              {questions.map((q, qIndex) => (
                <div key={qIndex} className="border border-gray-300 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-gray-700">Question {qIndex + 1}</h4>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <label className="text-xs text-gray-600">Points:</label>
                        <input
                          type="number"
                          min="1"
                          max="100"
                          value={q.points || 1}
                          onChange={(e) => handlePointsChange(qIndex, e.target.value)}
                          className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                      </div>
                      <select
                        value={q.type}
                        onChange={(e) => handleQuestionTypeChange(qIndex, e.target.value)}
                        className="px-3 py-1 border border-gray-300 rounded text-sm"
                      >
                        <option value="multiple-choice">Multiple Choice</option>
                        <option value="enumeration">Enumeration</option>
                      </select>
                      {questions.length > 1 && (
                        <button
                          onClick={() => handleRemoveQuestion(qIndex)}
                          className="text-red-500 hover:text-red-700 text-sm"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>

                  <input
                    type="text"
                    value={q.question}
                    onChange={(e) => handleQuestionChange(qIndex, e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-3 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="Enter your question"
                  />

                  {q.type === 'multiple-choice' ? (
                    <div className="space-y-2">
                      {q.options.map((option, oIndex) => (
                        <div key={oIndex} className="flex items-center gap-2">
                          <input
                            type="radio"
                            name={`correct-${qIndex}`}
                            checked={q.correctAnswer === oIndex}
                            onChange={() => handleCorrectAnswerChange(qIndex, oIndex)}
                            className="w-4 h-4 text-green-600"
                          />
                          <input
                            type="text"
                            value={option}
                            onChange={(e) => handleOptionChange(qIndex, oIndex, e.target.value)}
                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                            placeholder={`Option ${oIndex + 1}`}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Correct Answer (students will type their answer)
                      </label>
                      <input
                        type="text"
                        value={q.correctAnswer}
                        onChange={(e) => handleCorrectAnswerChange(qIndex, e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        placeholder="Enter the correct answer"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Student answers will be checked case-insensitively
                      </p>
                    </div>
                  )}
                </div>
              ))}

              <div className="flex gap-2">
                <button
                  onClick={() => handleAddQuestion('multiple-choice')}
                  className="flex-1 py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-green-500 hover:text-green-600 transition"
                >
                  + Add Multiple Choice
                </button>
                <button
                  onClick={() => handleAddQuestion('enumeration')}
                  className="flex-1 py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-500 hover:text-blue-600 transition"
                >
                  + Add Enumeration
                </button>
              </div>
            </div>

            <div className="flex gap-3 pt-6 border-t mt-6">
              <button
                onClick={() => {
                  setShowQuizModal(false);
                  setQuizTitle('');
                  setQuizDeadline('');
                  setQuestions([{ type: 'multiple-choice', question: '', options: ['', '', '', ''], correctAnswer: 0, points: 1 }]);
                  setGradingScale('traditional');
                  setCustomGradingScale(null);
                  setPassingGrade(70);
                  setTotalPoints(1);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateQuiz}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium"
              >
                Create Quiz
              </button>
            </div>
          </div>
        </div>
      )}

      {showLessonModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full p-6 my-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-800">Post Lesson for {selectedClass?.name}</h3>
              <button
                onClick={() => {
                  setShowLessonModal(false);
                  setLessonTitle('');
                  setLessonContent('');
                  setLessonLinks(['']);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Lesson Title *</label>
                <input
                  type="text"
                  value={lessonTitle}
                  onChange={(e) => setLessonTitle(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., Introduction to Algebra"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Lesson Content</label>
                <textarea
                  value={lessonContent}
                  onChange={(e) => setLessonContent(e.target.value)}
                  rows={6}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter lesson description, instructions, or content..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Add Links</label>
                <div className="space-y-2">
                  {lessonLinks.map((link, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        type="url"
                        value={link}
                        onChange={(e) => handleLinkChange(index, e.target.value)}
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="https://example.com"
                      />
                      {lessonLinks.length > 1 && (
                        <button
                          onClick={() => handleRemoveLink(index)}
                          className="text-red-500 hover:text-red-700 text-sm"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  onClick={handleAddLink}
                  className="mt-2 text-blue-600 hover:text-blue-700 text-sm font-medium"
                >
                  + Add Another Link
                </button>
              </div>
            </div>

            <div className="flex gap-3 pt-6 border-t mt-6">
              <button
                onClick={() => {
                  setShowLessonModal(false);
                  setLessonTitle('');
                  setLessonContent('');
                  setLessonLinks(['']);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateLesson}
                disabled={isUploadingLesson}
                className={`flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium ${
                  isUploadingLesson ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {isUploadingLesson ? 'Uploading...' : 'Post Lesson'}
              </button>
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

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
      />
    </div>
  );
}
