import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { calculateClassStats, generateGradeDistribution, getLetterGrade, exportGradebook, downloadCSV, DEFAULT_GRADING_SCALES, calculateTotalPoints } from '../../utils/grading';

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
    gradeDistribution: [],
    averagePoints: 0,
    passRate: 0,
  });

  // Export modal state
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');
  const [exportType, setExportType] = useState('all'); // 'all', 'dateRange', 'specificQuiz'
  const [selectedQuizForExport, setSelectedQuizForExport] = useState('');

  useEffect(() => {
    fetchAnalyticsData();
  }, [classId]);

  const handleRefresh = () => {
    setLoading(true);
    fetchAnalyticsData();
  };

  const handleExportGradebook = () => {
    if (students.length === 0) {
      alert('No students found to export');
      return;
    }

    if (quizzes.length === 0) {
      alert('No quizzes found to export');
      return;
    }

    // Open export modal for date selection
    setShowExportModal(true);
  };

  const handleConfirmExport = () => {
    let filteredQuizzes = [...quizzes];
    let filenameSuffix = 'Complete_Gradebook';

    // Filter quizzes based on export type
    if (exportType === 'dateRange' && exportStartDate && exportEndDate) {
      const startDate = new Date(exportStartDate);
      const endDate = new Date(exportEndDate);
      endDate.setHours(23, 59, 59, 999); // Include the entire end date

      filteredQuizzes = quizzes.filter(quiz => {
        const quizDate = new Date(quiz.createdAt);
        return quizDate >= startDate && quizDate <= endDate;
      });

      filenameSuffix = `Gradebook_${exportStartDate}_to_${exportEndDate}`;
    } else if (exportType === 'specificQuiz' && selectedQuizForExport) {
      filteredQuizzes = quizzes.filter(quiz => quiz.id === selectedQuizForExport);
      const selectedQuiz = quizzes.find(q => q.id === selectedQuizForExport);
      filenameSuffix = `${selectedQuiz?.title || 'Quiz'}_Results`;
    }

    if (filteredQuizzes.length === 0) {
      alert('No quizzes found for the selected criteria');
      return;
    }

    // Create CSV with filtered quizzes
    const csvContent = exportComprehensiveGradebook(filteredQuizzes);
    const filename = `${classData?.name || 'Class'}_${filenameSuffix}_${new Date().toISOString().split('T')[0]}.csv`;
    downloadCSV(csvContent, filename);

    // Close modal and reset
    setShowExportModal(false);
    setExportStartDate('');
    setExportEndDate('');
    setExportType('all');
    setSelectedQuizForExport('');
  };

  const exportComprehensiveGradebook = (filteredQuizzes = quizzes) => {
    const rows = [];

    // Calculate class statistics
    let totalStudents = students.length;
    let totalClassPoints = 0;
    let totalPossiblePoints = 0;
    const quizAverages = [];
    const quizTotals = [];

    // Calculate totals for each quiz
    filteredQuizzes.forEach(quiz => {
      let quizTotalEarned = 0;
      let quizTotalPossible = 0;
      let submissionCount = 0;

      students.forEach(student => {
        const result = allResults.find(r => r.studentId === student.id && r.quizId === quiz.id);
        const quizMaxPoints = quiz.totalPoints || (quiz.questions ? calculateTotalPoints(quiz.questions) : 1);
        
        if (result) {
          const pointsEarned = result.pointsEarned || 0;
          quizTotalEarned += pointsEarned;
          submissionCount++;
        }
        quizTotalPossible += quizMaxPoints;
      });

      const average = submissionCount > 0 ? (quizTotalEarned / submissionCount).toFixed(2) : '0.00';
      const percentage = quizTotalPossible > 0 ? ((quizTotalEarned / quizTotalPossible) * 100).toFixed(2) + '%' : '0.00%';
      
      quizAverages.push(average);
      quizTotals.push(quiz.totalPoints || (quiz.questions ? calculateTotalPoints(quiz.questions) : 1));
      
      totalClassPoints += quizTotalEarned;
      totalPossiblePoints += quizTotalPossible;
    });

    // Class average
    const classAverage = totalPossiblePoints > 0 ? ((totalClassPoints / totalPossiblePoints) * 100).toFixed(2) + '%' : '0.00%';

    // Create headers
    const headers = ['SpreadsheetClass.com', `Total Students = ${totalStudents}`, classAverage, ...filteredQuizzes.map(quiz => ((quiz.totalPoints || (quiz.questions ? calculateTotalPoints(quiz.questions) : 1)) / (quiz.totalPoints || (quiz.questions ? calculateTotalPoints(quiz.questions) : 1)) * 100).toFixed(2) + '%')];
    
    // Class average row
    const classAverageRow = ['Class Average', classAverage, (totalClassPoints / totalStudents).toFixed(1), totalPossiblePoints, ...quizAverages];
    
    // Totals row
    const totalsRow = ['Totals', `${totalPossiblePoints} Possible / ${totalStudents} Student`, totalClassPoints, totalPossiblePoints, ...quizTotals];
    
    // Quiz names header
    const quizNamesRow = ['Student Name', '%', 'Points', 'Possible', ...filteredQuizzes.map(quiz => quiz.title)];

    // Add summary rows
    rows.push(headers);
    rows.push(classAverageRow);
    rows.push(totalsRow);
    rows.push(quizNamesRow);

    // Add student data
    students.forEach(student => {
      let studentTotalPoints = 0;
      let studentPossiblePoints = 0;
      const studentScores = [];

      filteredQuizzes.forEach(quiz => {
        const result = allResults.find(r => r.studentId === student.id && r.quizId === quiz.id);
        const quizMaxPoints = quiz.totalPoints || (quiz.questions ? calculateTotalPoints(quiz.questions) : 1);
        
        if (result) {
          const pointsEarned = result.pointsEarned || 0;
          studentScores.push(pointsEarned);
          studentTotalPoints += pointsEarned;
        } else {
          studentScores.push(0);
        }
        studentPossiblePoints += quizMaxPoints;
      });

      const studentPercentage = studentPossiblePoints > 0 ? ((studentTotalPoints / studentPossiblePoints) * 100).toFixed(2) + '%' : '0.00%';

      const studentRow = [
        student.fullName || 'Unknown',
        studentPercentage,
        studentTotalPoints,
        studentPossiblePoints,
        ...studentScores
      ];

      rows.push(studentRow);
    });

    // Convert to CSV format
    const csvContent = rows
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    return csvContent;
  };

  const fetchAnalyticsData = async () => {
    try {
      console.log('Fetching analytics for class:', classId);
      
      // Fetch class data
      const classDoc = await getDocs(query(collection(db, 'classes'), where('__name__', '==', classId)));
      const classInfo = classDoc.empty ? null : { id: classId, ...classDoc.docs[0].data() };
      setClassData(classInfo);

      // Fetch students
      let studentData = [];
      if (classInfo?.students && classInfo.students.length > 0) {
        const studentPromises = classInfo.students.map(async (studentId) => {
          const studentDoc = await getDocs(query(collection(db, 'users'), where('__name__', '==', studentId)));
          if (!studentDoc.empty) {
            return { id: studentId, ...studentDoc.docs[0].data() };
          }
          return null;
        });
        studentData = (await Promise.all(studentPromises)).filter(s => s !== null);
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

    // Filter results to only include current students and get latest submission per student per quiz
    const currentStudentIds = studentData.map(s => s.id);
    const allCurrentSubmissions = resultsData.filter(r => currentStudentIds.includes(r.studentId));
    
    // Get only the latest submission per student per quiz (in case of retakes)
    const latestSubmissions = {};
    allCurrentSubmissions.forEach(result => {
      const key = `${result.studentId}-${result.quizId}`;
      if (!latestSubmissions[key] || new Date(result.submittedAt) > new Date(latestSubmissions[key].submittedAt)) {
        latestSubmissions[key] = result;
      }
    });
    const currentStudentSubmissions = Object.values(latestSubmissions);

    // Use the new grading system for class statistics with backward compatibility
    const defaultGradingScale = DEFAULT_GRADING_SCALES.traditional;
    
    // Ensure all results have percentage field for backward compatibility
    const compatibleSubmissions = currentStudentSubmissions.map(result => ({
      ...result,
      percentage: result.percentage || result.score || 0,
      pointsEarned: result.pointsEarned || 0
    }));
    
    const classStats = calculateClassStats(compatibleSubmissions, defaultGradingScale, 70);

    // Calculate completion rate (only count submissions from current students)
    const totalPossibleSubmissions = totalStudents * totalQuizzes;
    const completionRate = totalPossibleSubmissions > 0
      ? Math.min(100, Math.round((currentStudentSubmissions.length / totalPossibleSubmissions) * 100))
      : 0;

    // Calculate quiz averages with grading information and backward compatibility
    const quizAverages = quizData.map(quiz => {
      const quizResults = currentStudentSubmissions.filter(r => r.quizId === quiz.id);
      
      // Ensure backward compatibility for quiz results
      const compatibleQuizResults = quizResults.map(result => ({
        ...result,
        percentage: result.percentage || result.score || 0,
        pointsEarned: result.pointsEarned || 0
      }));
      
      const quizStats = calculateClassStats(compatibleQuizResults, quiz.gradingScale || defaultGradingScale, quiz.passingGrade || 70);
      
      return {
        name: quiz.title.length > 20 ? quiz.title.substring(0, 20) + '...' : quiz.title,
        average: quizStats.averagePercentage,
        averagePoints: quizStats.averagePoints,
        submissions: quizResults.length,
        passRate: quizStats.passRate,
        totalPoints: quiz.totalPoints || (quiz.questions ? calculateTotalPoints(quiz.questions) : 0),
      };
    });

    // Calculate student progress with letter grades
    const studentProgress = studentData.map(student => {
      const studentResults = currentStudentSubmissions.filter(r => r.studentId === student.id);
      const average = studentResults.length > 0
        ? Math.round(studentResults.reduce((sum, r) => sum + (r.percentage || r.score), 0) / studentResults.length)
        : 0;
      const averagePoints = studentResults.length > 0
        ? Math.round(studentResults.reduce((sum, r) => sum + (r.pointsEarned || 0), 0) / studentResults.length)
        : 0;
      const letterGrade = getLetterGrade(average, defaultGradingScale);
      
      return {
        name: student.fullName,
        average: average,
        averagePoints: averagePoints,
        letterGrade: letterGrade.letter,
        letterGradeColor: letterGrade.color,
        quizzesTaken: studentResults.length,
      };
    }).sort((a, b) => b.average - a.average);

    // Top performers (top 5 who have taken quizzes and scored > 0)
    const topPerformers = studentProgress
      .filter(s => s.quizzesTaken > 0 && s.average > 0)
      .slice(0, 5);

    // Students who need help (bottom 5 with average < 70)
    const needsHelp = studentProgress
      .filter(s => s.average < 70 && s.quizzesTaken > 0)
      .slice(-5)
      .reverse();

    setAnalytics({
      classAverage: classStats.averagePercentage,
      averagePoints: classStats.averagePoints,
      totalQuizzes,
      totalStudents,
      completionRate,
      passRate: classStats.passRate,
      quizAverages,
      studentProgress,
      topPerformers,
      needsHelp,
      gradeDistribution: classStats.gradeDistribution,
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
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-800">Analytics Dashboard</h1>
              <p className="text-gray-600 text-sm">{classData?.name}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleExportGradebook}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-2"
                title="Export complete gradebook with all quizzes"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export All Quizzes
              </button>
              <button
                onClick={handleRefresh}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
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

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Pass Rate</p>
                <p className={`text-3xl font-bold ${
                  analytics.passRate >= 80 ? 'text-green-600' :
                  analytics.passRate >= 60 ? 'text-yellow-600' :
                  'text-red-600'
                }`}>
                  {analytics.passRate}%
                </p>
              </div>
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                analytics.passRate >= 80 ? 'bg-green-100' :
                analytics.passRate >= 60 ? 'bg-yellow-100' :
                'bg-red-100'
              }`}>
                <svg className={`w-6 h-6 ${
                  analytics.passRate >= 80 ? 'text-green-600' :
                  analytics.passRate >= 60 ? 'text-yellow-600' :
                  'text-red-600'
                }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.586-3.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0l-3-3a2 2 0 010-2.828z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
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

          {/* Grade Distribution Pie Chart */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Grade Distribution</h3>
            {analytics.gradeDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={analytics.gradeDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ grade, count }) => `${grade}: ${count}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="count"
                  >
                    {analytics.gradeDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-500">
                No grade data available
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
                    <div className="text-right">
                      <div className="text-2xl font-bold text-green-600">{student.average}%</div>
                      <div className="text-sm font-bold" style={{ color: student.letterGradeColor }}>
                        Grade: {student.letterGrade}
                      </div>
                    </div>
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
                    <div className="text-right">
                      <div className="text-2xl font-bold text-orange-600">{student.average}%</div>
                      <div className="text-sm font-bold" style={{ color: student.letterGradeColor }}>
                        Grade: {student.letterGrade}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">All students are doing great! 🎉</p>
            )}
          </div>
        </div>
      </main>

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-800">Export Gradebook</h3>
              <button
                onClick={() => setShowExportModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Export Type</label>
                <select
                  value={exportType}
                  onChange={(e) => setExportType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="all">All Quizzes</option>
                  <option value="dateRange">Date Range</option>
                  <option value="specificQuiz">Specific Quiz</option>
                </select>
              </div>

              {exportType === 'dateRange' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                    <input
                      type="date"
                      value={exportStartDate}
                      onChange={(e) => setExportStartDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                    <input
                      type="date"
                      value={exportEndDate}
                      onChange={(e) => setExportEndDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>
                </>
              )}

              {exportType === 'specificQuiz' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Select Quiz</label>
                  <select
                    value={selectedQuizForExport}
                    onChange={(e) => setSelectedQuizForExport(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    <option value="">Choose a quiz...</option>
                    {quizzes.map(quiz => (
                      <option key={quiz.id} value={quiz.id}>
                        {quiz.title} ({new Date(quiz.createdAt).toLocaleDateString()})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  <strong>Export Format:</strong> Vertical layout with student name, email, quiz name, and points per row.
                </p>
              </div>
            </div>

            <div className="flex gap-3 pt-6 border-t mt-6">
              <button
                onClick={() => setShowExportModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmExport}
                disabled={
                  (exportType === 'dateRange' && (!exportStartDate || !exportEndDate)) ||
                  (exportType === 'specificQuiz' && !selectedQuizForExport)
                }
                className={`flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium ${
                  (exportType === 'dateRange' && (!exportStartDate || !exportEndDate)) ||
                  (exportType === 'specificQuiz' && !selectedQuizForExport)
                    ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                Export CSV
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
