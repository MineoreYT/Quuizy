/**
 * Grading System Utilities
 * Handles points, percentages, letter grades, and grading scales
 */

// Default grading scales
export const DEFAULT_GRADING_SCALES = {
  traditional: {
    name: "Traditional A-F",
    grades: {
      "A": { min: 90, max: 100, color: "#10b981" },
      "B": { min: 80, max: 89, color: "#3b82f6" },
      "C": { min: 70, max: 79, color: "#f59e0b" },
      "D": { min: 60, max: 69, color: "#ef4444" },
      "F": { min: 0, max: 59, color: "#6b7280" }
    }
  },
  plusMinus: {
    name: "Plus/Minus System",
    grades: {
      "A+": { min: 97, max: 100, color: "#10b981" },
      "A": { min: 93, max: 96, color: "#10b981" },
      "A-": { min: 90, max: 92, color: "#10b981" },
      "B+": { min: 87, max: 89, color: "#3b82f6" },
      "B": { min: 83, max: 86, color: "#3b82f6" },
      "B-": { min: 80, max: 82, color: "#3b82f6" },
      "C+": { min: 77, max: 79, color: "#f59e0b" },
      "C": { min: 73, max: 76, color: "#f59e0b" },
      "C-": { min: 70, max: 72, color: "#f59e0b" },
      "D+": { min: 67, max: 69, color: "#ef4444" },
      "D": { min: 63, max: 66, color: "#ef4444" },
      "D-": { min: 60, max: 62, color: "#ef4444" },
      "F": { min: 0, max: 59, color: "#6b7280" }
    }
  },
  passFail: {
    name: "Pass/Fail",
    grades: {
      "Pass": { min: 70, max: 100, color: "#10b981" },
      "Fail": { min: 0, max: 69, color: "#ef4444" }
    }
  },
  excellent: {
    name: "Excellence Scale",
    grades: {
      "Excellent": { min: 95, max: 100, color: "#10b981" },
      "Very Good": { min: 85, max: 94, color: "#3b82f6" },
      "Good": { min: 75, max: 84, color: "#f59e0b" },
      "Satisfactory": { min: 65, max: 74, color: "#ef4444" },
      "Needs Improvement": { min: 0, max: 64, color: "#6b7280" }
    }
  }
};

/**
 * Calculate percentage from points
 * @param {number} pointsEarned - Points student earned
 * @param {number} totalPoints - Maximum possible points
 * @returns {number} - Percentage (0-100)
 */
export const calculatePercentage = (pointsEarned, totalPoints) => {
  if (totalPoints === 0) return 0;
  return Math.round((pointsEarned / totalPoints) * 100);
};

/**
 * Get letter grade based on percentage and grading scale
 * @param {number} percentage - Student's percentage (0-100)
 * @param {Object} gradingScale - Grading scale object
 * @returns {Object} - Grade info { letter, color, min, max }
 */
export const getLetterGrade = (percentage, gradingScale) => {
  if (!gradingScale || !gradingScale.grades) {
    gradingScale = DEFAULT_GRADING_SCALES.traditional;
  }

  for (const [letter, range] of Object.entries(gradingScale.grades)) {
    if (percentage >= range.min && percentage <= range.max) {
      return {
        letter,
        color: range.color,
        min: range.min,
        max: range.max
      };
    }
  }

  // Fallback to F if no grade found
  return {
    letter: "F",
    color: "#6b7280",
    min: 0,
    max: 59
  };
};

/**
 * Check if student passed based on passing grade
 * @param {number} percentage - Student's percentage
 * @param {number} passingGrade - Minimum percentage to pass (default 70)
 * @returns {boolean} - Whether student passed
 */
export const didStudentPass = (percentage, passingGrade = 70) => {
  return percentage >= passingGrade;
};

/**
 * Calculate total points for a quiz
 * @param {Array} questions - Array of question objects with points
 * @returns {number} - Total possible points
 */
export const calculateTotalPoints = (questions) => {
  if (!questions || questions.length === 0) return 0;
  
  return questions.reduce((total, question) => {
    // Handle backward compatibility - default to 1 point if not specified
    return total + (question.points || 1);
  }, 0);
};

/**
 * Calculate points earned by student
 * @param {Array} questions - Quiz questions
 * @param {Object} answers - Student's answers
 * @returns {Object} - { pointsEarned, pointsPerQuestion, totalPoints }
 */
export const calculateStudentPoints = (questions, answers) => {
  let pointsEarned = 0;
  const pointsPerQuestion = [];
  
  questions.forEach((question, index) => {
    // Handle backward compatibility - default to 1 point if not specified
    const questionPoints = question.points || 1;
    let earnedPoints = 0;

    if (question.type === 'enumeration') {
      // Case-insensitive comparison for text questions
      const userAnswer = (answers[index] || '').toString().trim().toLowerCase();
      const correctAnswer = question.correctAnswer.toString().trim().toLowerCase();
      if (userAnswer === correctAnswer) {
        earnedPoints = questionPoints;
      }
    } else {
      // Multiple choice comparison
      if (answers[index] === question.correctAnswer) {
        earnedPoints = questionPoints;
      }
    }

    pointsPerQuestion.push(earnedPoints);
    pointsEarned += earnedPoints;
  });

  const totalPoints = calculateTotalPoints(questions);

  return {
    pointsEarned,
    pointsPerQuestion,
    totalPoints
  };
};

/**
 * Generate grade distribution for analytics
 * @param {Array} results - Array of quiz results
 * @param {Object} gradingScale - Grading scale to use
 * @returns {Array} - Grade distribution data for charts
 */
export const generateGradeDistribution = (results, gradingScale) => {
  if (!gradingScale || !gradingScale.grades) {
    gradingScale = DEFAULT_GRADING_SCALES.traditional;
  }

  const distribution = {};
  
  // Initialize all grades with 0 count
  Object.keys(gradingScale.grades).forEach(grade => {
    distribution[grade] = 0;
  });

  // Count students in each grade
  results.forEach(result => {
    const grade = getLetterGrade(result.percentage || result.score, gradingScale);
    distribution[grade.letter] = (distribution[grade.letter] || 0) + 1;
  });

  // Convert to chart data format
  return Object.entries(distribution).map(([grade, count]) => ({
    grade,
    count,
    color: gradingScale.grades[grade]?.color || "#6b7280"
  }));
};

/**
 * Calculate class statistics with grading
 * @param {Array} results - Array of quiz results
 * @param {Object} gradingScale - Grading scale to use
 * @param {number} passingGrade - Minimum percentage to pass
 * @returns {Object} - Class statistics
 */
export const calculateClassStats = (results, gradingScale, passingGrade = 70) => {
  if (results.length === 0) {
    return {
      averagePercentage: 0,
      averagePoints: 0,
      totalStudents: 0,
      passedStudents: 0,
      failedStudents: 0,
      passRate: 0,
      gradeDistribution: []
    };
  }

  const totalPercentage = results.reduce((sum, r) => sum + (r.percentage || r.score), 0);
  const totalPoints = results.reduce((sum, r) => sum + (r.pointsEarned || 0), 0);
  const averagePercentage = Math.round(totalPercentage / results.length);
  const averagePoints = Math.round(totalPoints / results.length);

  const passedStudents = results.filter(r => 
    didStudentPass(r.percentage || r.score, passingGrade)
  ).length;
  const failedStudents = results.length - passedStudents;
  const passRate = Math.round((passedStudents / results.length) * 100);

  const gradeDistribution = generateGradeDistribution(results, gradingScale);

  return {
    averagePercentage,
    averagePoints,
    totalStudents: results.length,
    passedStudents,
    failedStudents,
    passRate,
    gradeDistribution
  };
};

/**
 * Export gradebook data to CSV format
 * @param {Array} students - Array of student objects
 * @param {Array} results - Array of quiz results
 * @param {Object} quizInfo - Quiz information
 * @returns {string} - CSV formatted string
 */
export const exportGradebook = (students, results, quizInfo) => {
  const headers = [
    'Student Name',
    'Email',
    'Points Earned',
    'Total Points',
    'Percentage',
    'Letter Grade',
    'Pass/Fail',
    'Submitted At'
  ];

  const rows = students.map(student => {
    const result = results.find(r => r.studentId === student.id);
    
    if (!result) {
      return [
        student.fullName || 'Unknown',
        student.email || '',
        '0',
        quizInfo.totalPoints || '0',
        '0%',
        'F',
        'Not Submitted',
        ''
      ];
    }

    // Handle backward compatibility for older quiz results
    const percentage = result.percentage || result.score || 0;
    const pointsEarned = result.pointsEarned || 0;
    const totalPoints = result.totalPoints || quizInfo.totalPoints || 1;
    const gradingScale = quizInfo.gradingScale || DEFAULT_GRADING_SCALES.traditional;
    const passingGrade = quizInfo.passingGrade || 70;

    const grade = getLetterGrade(percentage, gradingScale);
    const passed = didStudentPass(percentage, passingGrade);

    return [
      student.fullName || 'Unknown',
      student.email || '',
      pointsEarned,
      totalPoints,
      `${percentage}%`,
      grade.letter,
      passed ? 'Pass' : 'Fail',
      result.submittedAt ? new Date(result.submittedAt).toLocaleString() : ''
    ];
  });

  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => `"${cell}"`).join(','))
    .join('\n');

  return csvContent;
};

/**
 * Download CSV file
 * @param {string} csvContent - CSV formatted string
 * @param {string} filename - Name of the file to download
 */
export const downloadCSV = (csvContent, filename) => {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};

/**
 * Validate grading scale
 * @param {Object} gradingScale - Grading scale to validate
 * @returns {boolean} - Whether the grading scale is valid
 */
export const validateGradingScale = (gradingScale) => {
  if (!gradingScale || !gradingScale.grades) return false;
  
  const grades = Object.values(gradingScale.grades);
  
  // Check if all grades have min and max values
  for (const grade of grades) {
    if (typeof grade.min !== 'number' || typeof grade.max !== 'number') {
      return false;
    }
    if (grade.min < 0 || grade.max > 100 || grade.min > grade.max) {
      return false;
    }
  }
  
  return true;
};