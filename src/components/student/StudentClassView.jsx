import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from '../../config/firebase';
import StudentAnalytics from './StudentAnalytics';

export default function StudentClassView({ classData, onBack, onTakeQuiz }) {
  const [quizzes, setQuizzes] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [myResults, setMyResults] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('quizzes'); // 'quizzes' or 'lessons'
  const [viewMode, setViewMode] = useState('all'); // 'all', 'completed', 'missing'
  const [showAnalytics, setShowAnalytics] = useState(false);

  useEffect(() => {
    fetchQuizzesAndResults();
  }, [classData.id]);

  const fetchQuizzesAndResults = async () => {
    try {
      const user = auth.currentUser;

      // Fetch all quizzes for this class
      const quizzesQuery = query(collection(db, 'quizzes'), where('classId', '==', classData.id));
      const quizzesSnapshot = await getDocs(quizzesQuery);
      const quizData = quizzesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setQuizzes(quizData);

      // Fetch my quiz results
      const resultsQuery = query(
        collection(db, 'quizResults'),
        where('studentId', '==', user.uid),
        where('classId', '==', classData.id)
      );
      const resultsSnapshot = await getDocs(resultsQuery);
      
      const resultsMap = {};
      resultsSnapshot.forEach(doc => {
        const result = doc.data();
        resultsMap[result.quizId] = result;
      });
      
      setMyResults(resultsMap);

      // Fetch lessons for this class
      const lessonsQuery = query(collection(db, 'lessons'), where('classId', '==', classData.id));
      const lessonsSnapshot = await getDocs(lessonsQuery);
      const lessonsData = lessonsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setLessons(lessonsData);
    } catch (error) {
      console.error('Error fetching quizzes:', error);
      alert('Failed to load quizzes');
    } finally {
      setLoading(false);
    }
  };

  const calculateOverallGrade = () => {
    const completedQuizzes = quizzes.filter(q => myResults[q.id]);
    if (completedQuizzes.length === 0) return 0;

    const totalScore = completedQuizzes.reduce((sum, quiz) => {
      return sum + myResults[quiz.id].score;
    }, 0);

    return Math.round(totalScore / completedQuizzes.length);
  };

  const getMissingQuizzes = () => {
    return quizzes.filter(quiz => !myResults[quiz.id]);
  };

  const getCompletedQuizzes = () => {
    return quizzes.filter(quiz => myResults[quiz.id]);
  };

  const isQuizPastDeadline = (quiz) => {
    if (!quiz.deadline) return false;
    return new Date(quiz.deadline) < new Date();
  };

  const overallGrade = calculateOverallGrade();
  const missingQuizzes = getMissingQuizzes();
  const completedQuizzes = getCompletedQuizzes();

  // Filter quizzes based on view mode
  const getFilteredQuizzes = () => {
    if (viewMode === 'completed') return completedQuizzes;
    if (viewMode === 'missing') return missingQuizzes;
    return quizzes;
  };

  const filteredQuizzes = getFilteredQuizzes();

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

  // Show Analytics view
  if (showAnalytics) {
    return <StudentAnalytics classId={classData.id} onBack={() => setShowAnalytics(false)} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg transition flex-shrink-0">
              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg sm:text-2xl font-bold text-gray-800 truncate">{classData.name}</h1>
              <p className="text-gray-600 text-xs sm:text-sm line-clamp-1">{classData.description}</p>
            </div>
            <button
              onClick={() => setShowAnalytics(true)}
              className="px-3 sm:px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium flex items-center gap-2 text-sm"
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span className="hidden sm:inline">My Progress</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards - Now Clickable */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6 mb-6 sm:mb-8">
          <button
            onClick={() => setViewMode('completed')}
            className={`bg-white rounded-lg shadow p-3 sm:p-6 text-left hover:shadow-lg transition ${
              viewMode === 'completed' ? 'ring-2 ring-green-500' : ''
            }`}
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-2">
              <div>
                <p className="text-xs sm:text-sm text-gray-600 mb-1">Overall Grade</p>
                <p className={`text-2xl sm:text-3xl font-bold ${
                  overallGrade >= 70 ? 'text-green-600' :
                  overallGrade >= 50 ? 'text-yellow-600' :
                  'text-red-600'
                }`}>
                  {overallGrade}%
                </p>
              </div>
              <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center ${
                overallGrade >= 70 ? 'bg-green-100' :
                overallGrade >= 50 ? 'bg-yellow-100' :
                'bg-red-100'
              }`}>
                <svg className={`w-5 h-5 sm:w-6 sm:h-6 ${
                  overallGrade >= 70 ? 'text-green-600' :
                  overallGrade >= 50 ? 'text-yellow-600' :
                  'text-red-600'
                }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
              </div>
            </div>
          </button>

          <button
            onClick={() => setViewMode('completed')}
            className={`bg-white rounded-lg shadow p-6 text-left hover:shadow-lg transition ${
              viewMode === 'completed' ? 'ring-2 ring-blue-500' : ''
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Quizzes Taken</p>
                <p className="text-3xl font-bold text-blue-600">{completedQuizzes.length}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </button>

          <button
            onClick={() => setViewMode('missing')}
            className={`bg-white rounded-lg shadow p-6 text-left hover:shadow-lg transition ${
              viewMode === 'missing' ? 'ring-2 ring-orange-500' : ''
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Missing Quizzes</p>
                <p className="text-3xl font-bold text-orange-600">{missingQuizzes.length}</p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </button>

          <button
            onClick={() => setViewMode('all')}
            className={`bg-white rounded-lg shadow p-6 text-left hover:shadow-lg transition ${
              viewMode === 'all' ? 'ring-2 ring-indigo-500' : ''
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Quizzes</p>
                <p className="text-3xl font-bold text-indigo-600">{quizzes.length}</p>
              </div>
              <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
          </button>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow">
          <div className="border-b border-gray-200 overflow-x-auto">
            <nav className="flex min-w-max sm:min-w-0">
              <button
                onClick={() => setActiveTab('quizzes')}
                className={`px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-medium whitespace-nowrap ${
                  activeTab === 'quizzes'
                    ? 'border-b-2 border-green-600 text-green-600'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                Quizzes ({quizzes.length})
              </button>
              <button
                onClick={() => setActiveTab('lessons')}
                className={`px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-medium whitespace-nowrap ${
                  activeTab === 'lessons'
                    ? 'border-b-2 border-green-600 text-green-600'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                Lessons ({lessons.length})
              </button>
            </nav>
          </div>

          {activeTab === 'quizzes' && (
            <>
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-800">
                  {viewMode === 'completed' && 'Completed Quizzes'}
                  {viewMode === 'missing' && 'Available Quizzes'}
                  {viewMode === 'all' && 'All Quizzes'}
                </h2>
              </div>
          <div className="p-6">
            {filteredQuizzes.length === 0 ? (
              <div className="text-center py-12">
                <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="text-lg font-medium text-gray-700 mb-2">No quizzes found</h3>
                <p className="text-gray-500">
                  {viewMode === 'completed' && 'You haven\'t completed any quizzes yet'}
                  {viewMode === 'missing' && 'All quizzes are completed!'}
                  {viewMode === 'all' && 'Your teacher hasn\'t created any quizzes yet'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredQuizzes.map((quiz) => {
                  const result = myResults[quiz.id];
                  const isCompleted = !!result;
                  const isPastDeadline = isQuizPastDeadline(quiz);
                  const canTakeQuiz = !isCompleted && !isPastDeadline;
                  
                  return (
                    <div key={quiz.id} className={`p-4 border rounded-lg ${
                      isCompleted ? 'border-gray-200 bg-gray-50' : 
                      isPastDeadline ? 'border-red-200 bg-red-50' :
                      'border-green-200 bg-green-50'
                    }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-gray-800">{quiz.title}</h3>
                            {isCompleted && (
                              <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                                Completed
                              </span>
                            )}
                            {isPastDeadline && !isCompleted && (
                              <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded">
                                Past Deadline
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-gray-600">
                            <span>{quiz.questions.length} questions</span>
                            {quiz.deadline && (
                              <>
                                <span>•</span>
                                <span className={isPastDeadline && !isCompleted ? 'text-red-600 font-medium' : ''}>
                                  Due: {new Date(quiz.deadline).toLocaleString()}
                                </span>
                              </>
                            )}
                            {isCompleted && (
                              <>
                                <span>•</span>
                                <span>{result.correctAnswers} / {result.totalQuestions} correct</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="text-right ml-4">
                          {isCompleted ? (
                            <div>
                              <div className={`text-3xl font-bold mb-1 ${
                                result.score >= 70 ? 'text-green-600' :
                                result.score >= 50 ? 'text-yellow-600' :
                                'text-red-600'
                              }`}>
                                {result.score}%
                              </div>
                              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                                result.score >= 70 ? 'bg-green-100 text-green-700' :
                                result.score >= 50 ? 'bg-yellow-100 text-yellow-700' :
                                'bg-red-100 text-red-700'
                              }`}>
                                {result.score >= 70 ? 'Excellent' : result.score >= 50 ? 'Good' : 'Needs Improvement'}
                              </span>
                            </div>
                          ) : canTakeQuiz ? (
                            <button
                              onClick={() => onTakeQuiz(classData.id)}
                              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium"
                            >
                              Take Quiz
                            </button>
                          ) : isPastDeadline ? (
                            <span className="px-4 py-2 bg-gray-300 text-gray-600 rounded-lg font-medium">
                              Deadline Passed
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
            </>
          )}

          {activeTab === 'lessons' && (
            <div className="p-6">
              {lessons.length === 0 ? (
                <div className="text-center py-12">
                  <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                  <h3 className="text-lg font-medium text-gray-700 mb-2">No lessons yet</h3>
                  <p className="text-gray-500">Your teacher hasn't posted any lessons yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {lessons.map((lesson) => (
                    <div key={lesson.id} className="p-6 border border-gray-200 rounded-lg hover:bg-gray-50 transition">
                      <h3 className="text-xl font-semibold text-gray-800 mb-3">{lesson.title}</h3>
                      
                      {lesson.content && (
                        <p className="text-gray-700 mb-4 whitespace-pre-wrap">{lesson.content}</p>
                      )}

                      {lesson.links && lesson.links.length > 0 && (
                        <div className="mb-4">
                          <p className="text-sm font-semibold text-gray-700 mb-2">🔗 Links:</p>
                          <div className="space-y-2">
                            {lesson.links.map((link, index) => (
                              <a
                                key={index}
                                href={link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition"
                              >
                                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                                <span className="text-green-700 font-medium break-all">{link}</span>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="text-xs text-gray-500 pt-3 border-t border-gray-200">
                        Posted on {new Date(lesson.createdAt).toLocaleDateString()} at {new Date(lesson.createdAt).toLocaleTimeString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}