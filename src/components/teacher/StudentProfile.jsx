import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function StudentProfile({ studentId, classId, onBack }) {
  const [loading, setLoading] = useState(true);
  const [studentData, setStudentData] = useState(null);
  const [classData, setClassData] = useState(null);
  const [quizzes, setQuizzes] = useState([]);
  const [results, setResults] = useState([]);
  const [analytics, setAnalytics] = useState({
    average: 0,
    quizzesTaken: 0,
    quizzesAvailable: 0,
    completionRate: 0,
    highestScore: 0,
    lowestScore: 0,
    trend: 'stable',
    progressData: [],
    quizScores: [],
    recentActivity: [],
  });

  useEffect(() => {
    fetchStudentData();
  }, [studentId, classId]);

  const fetchStudentData = async () => {
    try {
      // Fetch student info
      const studentDoc = await getDocs(query(collection(db, 'users'), where('__name__', '==', studentId)));
      if (!studentDoc.empty) {
        setStudentData({ id: studentId, ...studentDoc.docs[0].data() });
      }

      // Fetch class info
      const classDoc = await getDocs(query(collection(db, 'classes'), where('__name__', '==', classId)));
      if (!classDoc.empty) {
        setClassData({ id: classId, ...classDoc.docs[0].data() });
      }

      // Fetch all quizzes for this class
      const quizzesQuery = query(collection(db, 'quizzes'), where('classId', '==', classId));
      const quizzesSnapshot = await getDocs(quizzesQuery);
      const quizData = quizzesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setQuizzes(quizData);

      // Fetch student's results for this class
      const resultsQuery = query(
        collection(db, 'quizResults'),
        where('studentId', '==', studentId),
        where('classId', '==', classId)
      );
      const resultsSnapshot = await getDocs(resultsQuery);
      const resultsData = resultsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setResults(resultsData);

      // Calculate analytics
      calculateAnalytics(quizData, resultsData);
    } catch (error) {
      console.error('Error fetching student data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateAnalytics = (quizData, resultsData) => {
    const quizzesAvailable = quizData.length;
    const quizzesTaken = resultsData.length;

    // Calculate average
    const average = resultsData.length > 0
      ? Math.round(resultsData.reduce((sum, r) => sum + r.score, 0) / resultsData.length)
      : 0;

    // Calculate completion rate
    const completionRate = quizzesAvailable > 0
      ? Math.round((quizzesTaken / quizzesAvailable) * 100)
      : 0;

    // Find highest and lowest scores
    const scores = resultsData.map(r => r.score);
    const highestScore = scores.length > 0 ? Math.max(...scores) : 0;
    const lowestScore = scores.length > 0 ? Math.min(...scores) : 0;

    // Create progress data (scores over time)
    const progressData = resultsData
      .sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt))
      .map((result, index) => {
        const quiz = quizData.find(q => q.id === result.quizId);
        return {
          name: `Quiz ${index + 1}`,
          score: result.score,
          quizTitle: quiz?.title || 'Unknown Quiz',
          date: new Date(result.submittedAt).toLocaleDateString(),
        };
      });

    // Create quiz scores data
    const quizScores = quizData.map(quiz => {
      const result = resultsData.find(r => r.quizId === quiz.id);
      return {
        name: quiz.title.length > 20 ? quiz.title.substring(0, 20) + '...' : quiz.title,
        score: result ? result.score : null,
        taken: result ? 'Yes' : 'No',
        date: result ? new Date(result.submittedAt).toLocaleDateString() : 'Not taken',
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

    // Recent activity
    const recentActivity = resultsData
      .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))
      .slice(0, 5)
      .map(result => {
        const quiz = quizData.find(q => q.id === result.quizId);
        return {
          quizTitle: quiz?.title || 'Unknown Quiz',
          score: result.score,
          correctAnswers: result.correctAnswers,
          totalQuestions: result.totalQuestions,
          date: new Date(result.submittedAt).toLocaleString(),
        };
      });

    setAnalytics({
      average,
      quizzesTaken,
      quizzesAvailable,
      completionRate,
      highestScore,
      lowestScore,
      trend,
      progressData,
      quizScores,
      recentActivity,
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading student profile...</p>
        </div>
      </div>
    );
  }

  if (!studentData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Student not found</p>
          <button onClick={onBack} className="px-4 py-2 bg-indigo-600 text-white rounded-lg">
            Back to Class
          </button>
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
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center">
                  <span className="text-indigo-600 font-bold text-xl">
                    {studentData.fullName?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-800">{studentData.fullName}</h1>
                  <p className="text-gray-600 text-sm">{studentData.email}</p>
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Class</p>
              <p className="font-semibold text-gray-800">{classData?.name}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Average Score</p>
                <p className={`text-3xl font-bold ${
                  analytics.average >= 70 ? 'text-green-600' :
                  analytics.average >= 50 ? 'text-yellow-600' :
                  'text-red-600'
                }`}>
                  {analytics.average}%
                </p>
              </div>
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                analytics.average >= 70 ? 'bg-green-100' :
                analytics.average >= 50 ? 'bg-yellow-100' :
                'bg-red-100'
              }`}>
                <svg className={`w-6 h-6 ${
                  analytics.average >= 70 ? 'text-green-600' :
                  analytics.average >= 50 ? 'text-yellow-600' :
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
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Highest Score</p>
                <p className="text-3xl font-bold text-green-600">{analytics.highestScore}%</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Performance Trend</p>
                <p className={`text-xl font-bold ${
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
                          <p className="text-xs text-gray-500">{payload[0].payload.date}</p>
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
                No quiz data available yet
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
                  <Tooltip content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-white p-3 border border-gray-200 rounded shadow">
                          <p className="font-semibold">{payload[0].payload.name}</p>
                          <p className="text-sm text-gray-600">
                            {payload[0].payload.taken === 'Yes' 
                              ? `Score: ${payload[0].value}%` 
                              : 'Not taken yet'}
                          </p>
                          {payload[0].payload.taken === 'Yes' && (
                            <p className="text-xs text-gray-500">{payload[0].payload.date}</p>
                          )}
                        </div>
                      );
                    }
                    return null;
                  }} />
                  <Bar dataKey="score" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-500">
                No quizzes available
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Recent Activity</h3>
          {analytics.recentActivity.length > 0 ? (
            <div className="space-y-3">
              {analytics.recentActivity.map((activity, index) => (
                <div key={index} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition">
                  <div className="flex-1">
                    <p className="font-semibold text-gray-800">{activity.quizTitle}</p>
                    <p className="text-sm text-gray-600">
                      {activity.correctAnswers} / {activity.totalQuestions} correct
                    </p>
                    <p className="text-xs text-gray-500">{activity.date}</p>
                  </div>
                  <div className={`text-2xl font-bold ${
                    activity.score >= 70 ? 'text-green-600' :
                    activity.score >= 50 ? 'text-yellow-600' :
                    'text-red-600'
                  }`}>
                    {activity.score}%
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              No quiz activity yet
            </div>
          )}
        </div>

        {/* Teacher Notes Section */}
        <div className="mt-6 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg shadow p-6 text-white">
          <h3 className="text-xl font-bold mb-2">Teacher's Assessment</h3>
          <div className="space-y-2 text-indigo-100">
            {analytics.average >= 90 && (
              <p>✨ <strong>Excellent Student!</strong> Consistently high performance. Consider advanced material.</p>
            )}
            {analytics.average >= 70 && analytics.average < 90 && (
              <p>👍 <strong>Good Performance.</strong> Solid understanding. Encourage continued effort.</p>
            )}
            {analytics.average >= 50 && analytics.average < 70 && (
              <p>⚠️ <strong>Needs Improvement.</strong> Consider offering extra help or tutoring.</p>
            )}
            {analytics.average < 50 && analytics.quizzesTaken > 0 && (
              <p>🚨 <strong>Requires Attention.</strong> Schedule a meeting to discuss challenges.</p>
            )}
            {analytics.completionRate < 50 && (
              <p>📋 <strong>Low Completion Rate.</strong> Student is missing many quizzes. Follow up recommended.</p>
            )}
            {analytics.trend === 'improving' && (
              <p>📈 <strong>Positive Trend!</strong> Student is showing improvement. Provide encouragement.</p>
            )}
            {analytics.trend === 'declining' && (
              <p>📉 <strong>Declining Performance.</strong> Investigate potential issues affecting performance.</p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
