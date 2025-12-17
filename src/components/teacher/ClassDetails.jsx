import { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc, arrayRemove, collection, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import Toast from '../Toast';
import ConfirmModal from '../ConfirmModal';
import { useToast } from '../../hooks/useToast';
import Analytics from './Analytics';
import StudentProfile from './StudentProfile';
import { sanitizeQuizData, sanitizeText, sanitizeUrl, sanitizeArray } from '../../utils/sanitize';

export default function ClassDetails({ classId, onBack }) {
  const [classData, setClassData] = useState(null);
  const [students, setStudents] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [quizResults, setQuizResults] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('students');
  const [selectedQuizForResults, setSelectedQuizForResults] = useState(null);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const { toasts, showToast, removeToast } = useToast();
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null });

  useEffect(() => {
    fetchClassData();
  }, [classId]);

  const fetchClassData = async () => {
    try {
      console.log('Fetching class data for classId:', classId);
      const classDoc = await getDoc(doc(db, 'classes', classId));
      console.log('Class doc fetched successfully:', classDoc.exists());
      
      if (classDoc.exists()) {
        const data = classDoc.data();
        setClassData({ id: classDoc.id, ...data });

        // Fetch student details
        if (data.students && data.students.length > 0) {
          console.log('Fetching student details for:', data.students);
          const studentPromises = data.students.map(async (studentId) => {
            const studentDoc = await getDoc(doc(db, 'users', studentId));
            if (studentDoc.exists()) {
              return { id: studentId, ...studentDoc.data() };
            }
            return null;
          });
          const studentData = await Promise.all(studentPromises);
          setStudents(studentData.filter(s => s !== null));
          console.log('Student data fetched successfully');
        }

        // Fetch quizzes for this class
        console.log('Fetching quizzes for class:', classId);
        const q = query(collection(db, 'quizzes'), where('classId', '==', classId));
        const quizSnapshot = await getDocs(q);
        const quizData = quizSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setQuizzes(quizData);
        console.log('Quizzes fetched successfully:', quizData.length);

        // Fetch lessons for this class
        const lessonsQuery = query(collection(db, 'lessons'), where('classId', '==', classId));
        const lessonsSnapshot = await getDocs(lessonsQuery);
        const lessonsData = lessonsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setLessons(lessonsData);

        // Fetch all quiz results for this class
        const resultsQuery = query(collection(db, 'quizResults'), where('classId', '==', classId));
        const resultsSnapshot = await getDocs(resultsQuery);
        
        const resultsMap = {};
        resultsSnapshot.forEach(doc => {
          const result = doc.data();
          if (!resultsMap[result.quizId]) {
            resultsMap[result.quizId] = [];
          }
          resultsMap[result.quizId].push({ id: doc.id, ...result });
        });
        setQuizResults(resultsMap);
      }
    } catch (error) {
      console.error('Error fetching class data:', error);
      alert('Failed to load class details');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveStudent = async (studentId, studentName) => {
    setConfirmModal({
      isOpen: true,
      title: 'Remove Student',
      message: `Are you sure you want to remove ${studentName} from this class?\n\nThis will also delete all their quiz results for this class.`,
      onConfirm: () => performRemoveStudent(studentId, studentName)
    });
  };

  const performRemoveStudent = async (studentId, studentName) => {
    try {
      // Remove student from class
      await updateDoc(doc(db, 'classes', classId), {
        students: arrayRemove(studentId)
      });

      // Clean up orphaned quiz results for this student in this class
      const resultsQuery = query(
        collection(db, 'quizResults'), 
        where('studentId', '==', studentId),
        where('classId', '==', classId)
      );
      const resultsSnapshot = await getDocs(resultsQuery);
      
      if (!resultsSnapshot.empty) {
        const deletePromises = resultsSnapshot.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(deletePromises);
        console.log(`Cleaned up ${resultsSnapshot.docs.length} quiz results for removed student`);
      }

      setStudents(students.filter(s => s.id !== studentId));
      showToast(`${studentName} removed successfully`, 'success');
    } catch (error) {
      console.error('Error removing student:', error);
      showToast('Failed to remove student', 'error');
    }
  };

  const handleDeleteQuiz = async (quizId, quizTitle) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Quiz',
      message: `Are you sure you want to delete "${quizTitle}"?\n\nThis will also delete all student submissions for this quiz.`,
      onConfirm: () => performDeleteQuiz(quizId, quizTitle)
    });
  };

  const performDeleteQuiz = async (quizId, quizTitle) => {
    try {
      await deleteDoc(doc(db, 'quizzes', quizId));
      setQuizzes(quizzes.filter(q => q.id !== quizId));
      showToast('Quiz deleted successfully', 'success');
    } catch (error) {
      console.error('Error deleting quiz:', error);
      showToast('Failed to delete quiz', 'error');
    }
  };

  const handleDeleteLesson = async (lessonId, lessonTitle) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Lesson',
      message: `Are you sure you want to delete "${lessonTitle}"?`,
      onConfirm: () => performDeleteLesson(lessonId)
    });
  };

  const performDeleteLesson = async (lessonId) => {
    try {
      await deleteDoc(doc(db, 'lessons', lessonId));
      setLessons(lessons.filter(l => l.id !== lessonId));
      showToast('Lesson deleted successfully', 'success');
    } catch (error) {
      console.error('Error deleting lesson:', error);
      showToast('Failed to delete lesson', 'error');
    }
  };

  const handleDeleteClass = async () => {
    setConfirmModal({
      isOpen: true,
      title: '⚠️ Delete Class',
      message: `Are you sure you want to delete "${classData.name}"?\n\nThis will:\n• Delete all ${quizzes.length} quizzes\n• Delete all ${lessons.length} lessons\n• Delete all quiz results\n• Remove from all ${students.length} students\n\nThis action cannot be undone!`,
      onConfirm: performDeleteClass
    });
  };

  const performDeleteClass = async () => {

    try {
      // Delete all quizzes for this class
      const quizDeletePromises = quizzes.map(quiz => deleteDoc(doc(db, 'quizzes', quiz.id)));
      await Promise.all(quizDeletePromises);

      // Delete all lessons for this class
      const lessonDeletePromises = lessons.map(lesson => deleteDoc(doc(db, 'lessons', lesson.id)));
      await Promise.all(lessonDeletePromises);

      // Delete all quiz results for this class
      const resultsQuery = query(collection(db, 'quizResults'), where('classId', '==', classId));
      const resultsSnapshot = await getDocs(resultsQuery);
      const resultDeletePromises = resultsSnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(resultDeletePromises);

      // Delete the class itself
      await deleteDoc(doc(db, 'classes', classId));

      showToast('Class deleted successfully!', 'success');
      setTimeout(() => onBack(), 1000); // Go back to dashboard after showing toast
    } catch (error) {
      console.error('Error deleting class:', error);
      showToast('Failed to delete class. Please try again.', 'error');
    }
  };

  const copyClassCode = () => {
    navigator.clipboard.writeText(classData.code);
    showToast('Class code copied to clipboard!', 'success', 2000);
  };

  const getQuizStats = (quizId) => {
    const results = quizResults[quizId] || [];
    if (results.length === 0) return { taken: 0, average: 0 };

    const totalScore = results.reduce((sum, result) => sum + result.score, 0);
    const average = Math.round(totalScore / results.length);

    return { taken: results.length, average };
  };

  const viewQuizResults = (quiz) => {
    setSelectedQuizForResults(quiz);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading class details...</p>
        </div>
      </div>
    );
  }

  if (!classData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Class not found</p>
          <button onClick={onBack} className="px-4 py-2 bg-indigo-600 text-white rounded-lg">
            Back to Classes
          </button>
        </div>
      </div>
    );
  }

  // Show Analytics view
  if (showAnalytics) {
    return <Analytics classId={classId} onBack={() => setShowAnalytics(false)} />;
  }

  // Show Student Profile view
  if (selectedStudentId) {
    return <StudentProfile studentId={selectedStudentId} classId={classId} onBack={() => setSelectedStudentId(null)} />;
  }

  // Show quiz results view
  if (selectedQuizForResults) {
    const results = quizResults[selectedQuizForResults.id] || [];
    const stats = getQuizStats(selectedQuizForResults.id);

    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSelectedQuizForResults(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-gray-800">{selectedQuizForResults.title}</h1>
                <p className="text-gray-600 text-sm">Quiz Results</p>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-3xl font-bold text-blue-600 mb-1">{selectedQuizForResults.questions.length}</div>
                <div className="text-gray-600 text-sm">Questions</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-3xl font-bold text-green-600 mb-1">{stats.taken}</div>
                <div className="text-gray-600 text-sm">Students Completed</div>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <div className="text-3xl font-bold text-purple-600 mb-1">{stats.average}%</div>
                <div className="text-gray-600 text-sm">Average Score</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-800">Student Results</h2>
            </div>

            <div className="p-6">
              {results.length === 0 ? (
                <div className="text-center py-12">
                  <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <h3 className="text-lg font-medium text-gray-700 mb-2">No submissions yet</h3>
                  <p className="text-gray-500">Students haven't taken this quiz yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Student</th>
                        <th className="text-center py-3 px-4 font-semibold text-gray-700">Score</th>
                        <th className="text-center py-3 px-4 font-semibold text-gray-700">Correct Answers</th>
                        <th className="text-center py-3 px-4 font-semibold text-gray-700">Submitted</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((result) => {
                        const student = students.find(s => s.id === result.studentId);
                        const studentName = student ? student.fullName : 'Unknown Student';
                        
                        return (
                          <tr key={result.id} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                                  <span className="text-indigo-600 font-semibold text-sm">
                                    {studentName.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                                <span className="font-medium text-gray-800">{studentName}</span>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${
                                result.score >= 70 ? 'bg-green-100 text-green-700' :
                                result.score >= 50 ? 'bg-yellow-100 text-yellow-700' :
                                'bg-red-100 text-red-700'
                              }`}>
                                {result.score}%
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center text-gray-700">
                              {result.correctAnswers} / {result.totalQuestions}
                            </td>
                            <td className="py-3 px-4 text-center text-gray-600 text-sm">
                              {new Date(result.submittedAt).toLocaleDateString()} {new Date(result.submittedAt).toLocaleTimeString()}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-4">
            <button
              onClick={onBack}
              className="p-2 hover:bg-gray-100 rounded-lg transition self-start"
            >
              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-800 truncate">{classData.name}</h1>
              <p className="text-gray-600 text-xs sm:text-sm line-clamp-2">{classData.description}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowAnalytics(true)}
                className="w-full sm:w-auto px-3 sm:px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium flex items-center justify-center gap-2 text-sm"
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <span className="hidden sm:inline">Analytics</span>
              </button>
              <button
                onClick={handleDeleteClass}
                className="w-full sm:w-auto px-3 sm:px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium flex items-center justify-center gap-2 text-sm"
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1-1v3M4 7h16" />
                </svg>
                <span className="hidden sm:inline">Delete Class</span>
                <span className="sm:hidden">Delete</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-4 sm:mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-6">
            <div className="text-center p-3 sm:p-4 bg-indigo-50 rounded-lg">
              <div className="text-2xl sm:text-3xl font-bold text-indigo-600 mb-1">{students.length}</div>
              <div className="text-gray-600 text-xs sm:text-sm">Students Enrolled</div>
            </div>
            <div className="text-center p-3 sm:p-4 bg-green-50 rounded-lg">
              <div className="text-2xl sm:text-3xl font-bold text-green-600 mb-1">{quizzes.length}</div>
              <div className="text-gray-600 text-xs sm:text-sm">Quizzes Created</div>
            </div>
            <div className="text-center p-3 sm:p-4 bg-blue-50 rounded-lg">
              <div className="text-xl sm:text-2xl font-bold text-blue-600 mb-1 tracking-wider">{classData.code}</div>
              <button onClick={copyClassCode} className="text-blue-600 text-xs sm:text-sm hover:underline">
                Copy Class Code
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow">
          <div className="border-b border-gray-200 overflow-x-auto">
            <nav className="flex min-w-max sm:min-w-0">
              <button
                onClick={() => setActiveTab('students')}
                className={`px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-medium whitespace-nowrap ${
                  activeTab === 'students'
                    ? 'border-b-2 border-indigo-600 text-indigo-600'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                Students ({students.length})
              </button>
              <button
                onClick={() => setActiveTab('lessons')}
                className={`px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-medium whitespace-nowrap ${
                  activeTab === 'lessons'
                    ? 'border-b-2 border-indigo-600 text-indigo-600'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                Lessons ({lessons.length})
              </button>
              <button
                onClick={() => setActiveTab('quizzes')}
                className={`px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-medium whitespace-nowrap ${
                  activeTab === 'quizzes'
                    ? 'border-b-2 border-indigo-600 text-indigo-600'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                Quizzes ({quizzes.length})
              </button>
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'students' && (
              <div>
                {students.length === 0 ? (
                  <div className="text-center py-12">
                    <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    <h3 className="text-lg font-medium text-gray-700 mb-2">No students yet</h3>
                    <p className="text-gray-500">Share the class code with students to let them join!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {students.map((student) => (
                      <div key={student.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition">
                        <button
                          onClick={() => setSelectedStudentId(student.id)}
                          className="flex items-center gap-3 flex-1 text-left hover:opacity-80 transition"
                        >
                          <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                            <span className="text-indigo-600 font-semibold">
                              {student.fullName?.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <div className="font-medium text-gray-800 flex items-center gap-2">
                              {student.fullName}
                              <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </div>
                            <div className="text-sm text-gray-500">{student.email}</div>
                          </div>
                        </button>
                        <button
                          onClick={() => handleRemoveStudent(student.id, student.fullName)}
                          className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition text-sm font-medium"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'lessons' && (
              <div>
                {lessons.length === 0 ? (
                  <div className="text-center py-12">
                    <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                    <h3 className="text-lg font-medium text-gray-700 mb-2">No lessons yet</h3>
                    <p className="text-gray-500">Post your first lesson to get started!</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {lessons.map((lesson) => (
                      <div key={lesson.id} className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-800 mb-2">{lesson.title}</h4>
                            {lesson.content && (
                              <p className="text-sm text-gray-600 mb-3 whitespace-pre-wrap">{lesson.content}</p>
                            )}

                            {lesson.links && lesson.links.length > 0 && (
                              <div>
                                <p className="text-sm font-medium text-gray-700 mb-2">Links:</p>
                                <div className="space-y-1">
                                  {lesson.links.map((link, index) => (
                                    <a
                                      key={index}
                                      href={link}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                      </svg>
                                      {link}
                                    </a>
                                  ))}
                                </div>
                              </div>
                            )}

                            <div className="text-xs text-gray-500 mt-3">
                              Posted on {new Date(lesson.createdAt).toLocaleDateString()} at {new Date(lesson.createdAt).toLocaleTimeString()}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteLesson(lesson.id, lesson.title)}
                          className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition text-sm font-medium"
                        >
                          Delete
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'quizzes' && (
              <div>
                {quizzes.length === 0 ? (
                  <div className="text-center py-12">
                    <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <h3 className="text-lg font-medium text-gray-700 mb-2">No quizzes yet</h3>
                    <p className="text-gray-500">Create your first quiz to get started!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {quizzes.map((quiz) => {
                      const stats = getQuizStats(quiz.id);
                      
                      return (
                        <div key={quiz.id} className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <h4 className="font-semibold text-gray-800 mb-1">{quiz.title}</h4>
                              <div className="flex items-center gap-4 text-sm text-gray-600">
                                <span>{quiz.questions.length} questions</span>
                                <span>•</span>
                                <span>{stats.taken} submissions</span>
                                <span>•</span>
                                <span>Avg: {stats.average}%</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => viewQuizResults(quiz)}
                              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-sm font-medium"
                            >
                              View Results
                            </button>
                            <button
                              onClick={() => handleDeleteQuiz(quiz.id, quiz.title)}
                              className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition text-sm font-medium"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

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
