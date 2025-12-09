import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function Analytics({ classId, onBack }) {
  const [loading, setLoading] = useState(true);
  const [classData, setClassData] = useState(null);
  const [students, setStudents] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [allResults, setAllResults] = useState([]);
  const [analytics, setAnalytics] = useState({
    classAverage: 0,
    totalQuizzes: 0,
    totalStudents: 0,
    completionRate: 0,
    quizAverages: [],
    studentProgress: [],
    topPerformers: [],
    needsHelp: [],
  });

  useEffect(() => {
    fetchAnalyticsData();
  }, [classId]);

  const fetchAnalyticsData = async () => {
    try {
      // Fetch class data
      const classDoc = await getDocs(query(collection(db, 'classes'), where('__name__', '==', classId)));
      const classInfo = classDoc.docs[0]?.data();
      setClassData({ id: classId, ...classInfo });

      // Fetch students
      if (classInfo?.students && classInfo.students.length > 0) {
        const studentPromises = classInfo.students.map(async (studentId) => {
          const studentDoc = await getDocs(query(collection(db, 'users'), where('__name__', '==', studentId)));
          if (!studentDoc.empty) {
            return { id: studentId, ...studentDoc.docs[0].data() };
          }
          return null;
        });
        const studentData = (await Promise.all(studentPromises)).filter(s => s !== null);
        setStudents(studentData);
      }

      // Fetch quizzes
      const quizzesQuery = query(collection(db, 'quizzes'), where('classId', '==', classId));
      const quizzesSnapshot = await getDocs(quizzesQuery);
      const quizData = quizzesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setQuizzes(quizData);

      // Fetch all quiz results
      const resultsQuery = query(collection(db, 'quizResults'), where('classId', '==', classId));
      const resultsSnapshot = await getDocs(resultsQuery);
      const resultsData = resultsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAllResults(resultsData);

      // Calculate analytics
      calculateAnalytics(classInfo, studentData, quizData, resultsData);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateAnalytics = (classInfo, studentData, quizData, resultsData) => {
    const totalStudents = studentData.length;
    const totalQuizzes = quizData.length;

    // Calculate class average
    const classAverage = resultsData.length > 0
      ? Math.round(resultsData.reduce((sum, r) => sum + r.score, 0) / resultsData.length)
      : 0;

    // Calculate completion rate
    const totalPossibleSubmissions = totalStudents * totalQuizzes;
    const completionRate = totalPossibleSubmissions > 0
      ? Math.round((resultsData.length / totalPossibleSubmissions) * 100)
      : 0;

    // Calculate quiz averages
    const quizAverages = quizData.map(quiz => {
      const quizResults = resultsData.filter(r => r.quizId === quiz.id);
      const average = quizResults.length > 0
        ? Math.round(quizResults.reduce((sum, r) => sum + r.score, 0) / quizResults.length)
        : 0;
      return {
        name: quiz.title.length > 20 ? quiz.title.substring(0, 20) + '...' : quiz.title,
        average: average,
        submissions: quizResults.length,
      };
    });

    // Calculate student progress (for each student, get their average)
    const studentProgress = studentData.map(student => {
      const studentResults = resultsData.filter(r => r.studentId === student.id);
      const average = studentResults.length > 0
        ? Math.round(studentResults.reduce((sum, r) => sum + r.score, 0) / studentResults.length)
        : 0;
      return {
        name: student.fullName,
        average: average,
        quizzesTaken: studentResults.length,
      };
    }).sort((a, b) => b.average - a.average);

    // Top performers (top 5)
    const topPerformers = studentProgress.slice(0, 5);

    // Students who need help (bottom 5 with average < 70)
    const needsHelp = studentProgress
      .filter(s => s.average < 70 && s.quizzesTaken > 0)
      .slice(-5)
      .reverse();

    setAnalytics({
      classAverage,
      totalQuizzes,
      totalStudents,
      completionRate,
      quizAverages,
      studentProgress,
      topPerformers,
      needsHelp,
    });
  };

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Analytics Dashboard</h1>
              <p className="text-gray-600 text-sm">{classData?.name}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Class Average</p>
                <p className={`text-3xl font-bold ${
                  analytics.classAverage >= 70 ? 'text-green-600' :
                  analytics.classAverage >= 50 ? 'text-yellow-600' :
                  'text-red-600'
                }`}>
                  {analytics.classAverage}%
                </p>
              </div>
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                analytics.classAverage >= 70 ? 'bg-green-100' :
                analytics.classAverage >= 50 ? 'bg-yellow-100' :
                'bg-red-100'
              }`}>
                <svg className={`w-6 h-6 ${
                  analytics.classAverage >= 70 ? 'text-green-600' :
                  analytics.classAverage >= 50 ? 'text-yellow-600' :
                  'text-red-600'
                }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Students</p>
                <p className="text-3xl font-bold text-indigo-600">{analytics.totalStudents}</p>
              </div>
              <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Quizzes</p>
                <p className="text-3xl font-bold text-blue-600">{analytics.totalQuizzes}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Completion Rate</p>
                <p className="text-3xl font-bold text-purple-600">{analytics.completionRate}%</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Quiz Averages Bar Chart */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Quiz Performance</h3>
            {analytics.quizAverages.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analytics.quizAverages}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Bar dataKey="average" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-500">
                No quiz data available
              </div>
            )}
          </div>

          {/* Student Performance Bar Chart */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Student Averages</h3>
            {analytics.studentProgress.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analytics.studentProgress}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Bar dataKey="average" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-500">
                No student data available
              </div>
            )}
          </div>
        </div>

        {/* Top Performers and Needs Help */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Performers */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <span>🏆</span> Top Performers
            </h3>
            {analytics.topPerformers.length > 0 ? (
              <div className="space-y-3">
                {analytics.topPerformers.map((student, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center font-bold">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium text-gray-800">{student.name}</p>
                        <p className="text-sm text-gray-600">{student.quizzesTaken} quizzes taken</p>
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-green-600">{student.average}%</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">No data available yet</p>
            )}
          </div>

          {/* Students Who Need Help */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <span>📚</span> Students Who Need Help
            </h3>
            {analytics.needsHelp.length > 0 ? (
              <div className="space-y-3">
                {analytics.needsHelp.map((student, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-orange-500 text-white rounded-full flex items-center justify-center">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      </div>
                      <div>
                        <p className="font-medium text-gray-800">{student.name}</p>
                        <p className="text-sm text-gray-600">{student.quizzesTaken} quizzes taken</p>
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-orange-600">{student.average}%</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">All students are doing great! 🎉</p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
