import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from '../../config/firebase';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function StudentAnalytics({ classId, onBack }) {
  const [loading, setLoading] = useState(true);
  const [classData, setClassData] = useState(null);
  const [quizzes, setQuizzes] = useState([]);
  const [myResults, setMyResults] = useState([]);
  const [analytics, setAnalytics] = useState({
    myAverage: 0,
    quizzesTaken: 0,
    quizzesAvailable: 0,
    completionRate: 0,
    progressData: [],
    quizScores: [],
    trend: 'stable',
  });

  useEffect(() => {
    fetchAnalyticsData();
  }, [classId]);

  const fetchAnalyticsData = async () => {
    try {
      const user = auth.currentUser;

      // Fetch class data
      const classDoc = await getDocs(query(collection(db, 'classes'), where('__name__', '==', classId)));
      const classInfo = classDoc.docs[0]?.data();
      setClassData({ id: classId, ...classInfo });

      // Fetch quizzes
      const quizzesQuery = query(collection(db, 'quizzes'), where('classId', '==', classId));
      const quizzesSnapshot = await getDocs(quizzesQuery);
      const quizData = quizzesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setQuizzes(quizData);

      // Fetch my results
      const resultsQuery = query(
        collection(db, 'quizResults'),
        where('studentId', '==', user.uid),
        where('classId', '==', classId)
      );
      const resultsSnapshot = await getDocs(resultsQuery);
      const resultsData = resultsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMyResults(resultsData);

      // Calculate analytics
      calculateAnalytics(quizData, resultsData);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateAnalytics = (quizData, resultsData) => {
    const quizzesAvailable = quizData.length;
    const quizzesTaken = resultsData.length;

    // Calculate my average
    const myAverage = resultsData.length > 0
      ? Math.round(resultsData.reduce((sum, r) => sum + r.score, 0) / resultsData.length)
      : 0;

    // Calculate completion rate
    const completionRate = quizzesAvailable > 0
      ? Math.round((quizzesTaken / quizzesAvailable) * 100)
      : 0;

    // Create progress data (scores over time)
    const progressData = resultsData
      .sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt))
      .map((result, index) => {
        const quiz = quizData.find(q => q.id === result.quizId);
        return {
          name: `Quiz ${index + 1}`,
          score: result.score,
          quizTitle: quiz?.title || 'Unknown Quiz',
        };
      });

    // Create quiz scores data
    const quizScores = quizData.map(quiz => {
      const result = resultsData.find(r => r.quizId === quiz.id);
      return {
        name: quiz.title.length > 15 ? quiz.title.substring(0, 15) + '...' : quiz.title,
        score: result ? result.score : 0,
        taken: result ? 'Yes' : 'No',
      };
    });

    // Calculate trend
    let trend = 'stable';
    if (progressData.length >= 3) {
      const recent = progressData.slice(-3);
      const avgRecent = recent.reduce((sum, r) => sum + r.score, 0) / recent.length;
      const older = progressData.slice(0, -3);
      const avgOlder = older.length > 0 ? older.reduce((sum, r) => sum + r.score, 0) / older.length : avgRecent;
      
      if (avgRecent > avgOlder + 5) trend = 'improving';
      else if (avgRecent < avgOlder - 5) trend = 'declining';
    }

    setAnalytics({
      myAverage,
      quizzesTaken,
      quizzesAvailable,
      completionRate,
      progressData,
      quizScores,
      trend,
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your progress...</p>
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
              <h1 className="text-2xl font-bold text-gray-800">My Progress</h1>
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
                <p className="text-sm text-gray-600 mb-1">My Average</p>
                <p className={`text-3xl font-bold ${
                  analytics.myAverage >= 70 ? 'text-green-600' :
                  analytics.myAverage >= 50 ? 'text-yellow-600' :
                  'text-red-600'
                }`}>
                  {analytics.myAverage}%
                </p>
              </div>
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                analytics.myAverage >= 70 ? 'bg-green-100' :
                analytics.myAverage >= 50 ? 'bg-yellow-100' :
                'bg-red-100'
              }`}>
                <svg className={`w-6 h-6 ${
                  analytics.myAverage >= 70 ? 'text-green-600' :
                  analytics.myAverage >= 50 ? 'text-yellow-600' :
                  'text-red-600'
                }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Quizzes Taken</p>
                <p className="text-3xl font-bold text-blue-600">{analytics.quizzesTaken}</p>
                <p className="text-xs text-gray-500">of {analytics.quizzesAvailable}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
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
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Trend</p>
                <p className={`text-2xl font-bold ${
                  analytics.trend === 'improving' ? 'text-green-600' :
                  analytics.trend === 'declining' ? 'text-red-600' :
                  'text-gray-600'
                }`}>
                  {analytics.trend === 'improving' ? '📈 Improving' :
                   analytics.trend === 'declining' ? '📉 Declining' :
                   '➡️ Stable'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Progress Over Time */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Progress Over Time</h3>
            {analytics.progressData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={analytics.progressData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-white p-3 border border-gray-200 rounded shadow">
                          <p className="font-semibold">{payload[0].payload.quizTitle}</p>
                          <p className="text-sm text-gray-600">Score: {payload[0].value}%</p>
                        </div>
                      );
                    }
                    return null;
                  }} />
                  <Line type="monotone" dataKey="score" stroke="#10b981" strokeWidth={2} dot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-500">
                Take some quizzes to see your progress!
              </div>
            )}
          </div>

          {/* Quiz Scores */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Quiz Scores</h3>
            {analytics.quizScores.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analytics.quizScores}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Bar dataKey="score" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-500">
                No quizzes available yet
              </div>
            )}
          </div>
        </div>

        {/* Motivational Message */}
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg shadow p-6 text-white">
          <div className="flex items-center gap-4">
            <div className="text-4xl">
              {analytics.myAverage >= 90 ? '🌟' :
               analytics.myAverage >= 70 ? '🎯' :
               analytics.myAverage >= 50 ? '💪' :
               '📚'}
            </div>
            <div>
              <h3 className="text-xl font-bold mb-1">
                {analytics.myAverage >= 90 ? 'Outstanding Work!' :
                 analytics.myAverage >= 70 ? 'Great Job!' :
                 analytics.myAverage >= 50 ? 'Keep Pushing!' :
                 analytics.quizzesTaken === 0 ? 'Ready to Start?' :
                 'You Can Do It!'}
              </h3>
              <p className="text-indigo-100">
                {analytics.myAverage >= 90 ? 'You\'re excelling in this class! Keep up the amazing work!' :
                 analytics.myAverage >= 70 ? 'You\'re doing well! Stay consistent and you\'ll reach the top!' :
                 analytics.myAverage >= 50 ? 'Don\'t give up! Every quiz is a chance to improve!' :
                 analytics.quizzesTaken === 0 ? 'Take your first quiz and start your learning journey!' :
                 'Review your mistakes and try again. You\'ve got this!'}
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
