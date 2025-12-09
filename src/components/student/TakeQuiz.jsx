import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { db, auth } from '../../config/firebase';

export default function TakeQuiz({ classId, onBack }) {
  const [quizzes, setQuizzes] = useState([]);
  const [completedQuizzes, setCompletedQuizzes] = useState(new Set());
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [showResults, setShowResults] = useState(false);
  const [score, setScore] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchQuizzesAndResults();
  }, [classId]);

  const fetchQuizzesAndResults = async () => {
    try {
      const user = auth.currentUser;

      // Fetch all quizzes for this class
      const quizzesQuery = query(collection(db, 'quizzes'), where('classId', '==', classId));
      const quizzesSnapshot = await getDocs(quizzesQuery);
      const quizData = quizzesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setQuizzes(quizData);

      // Fetch student's quiz results to check which quizzes they've already taken
      const resultsQuery = query(
        collection(db, 'quizResults'),
        where('studentId', '==', user.uid),
        where('classId', '==', classId)
      );
      const resultsSnapshot = await getDocs(resultsQuery);
      
      const completedQuizIds = new Set();
      resultsSnapshot.forEach(doc => {
        completedQuizIds.add(doc.data().quizId);
      });
      
      setCompletedQuizzes(completedQuizIds);
    } catch (error) {
      console.error('Error fetching quizzes:', error);
      alert('Failed to load quizzes');
    } finally {
      setLoading(false);
    }
  };

  const startQuiz = (quiz) => {
  if (completedQuizzes.has(quiz.id)) {
    alert('You have already completed this quiz!');
    return;
  }

  // ADD THIS DEADLINE CHECK
  if (quiz.deadline && new Date(quiz.deadline) < new Date()) {
    alert('This quiz is past its deadline and can no longer be taken.');
    return;
  }

  setSelectedQuiz(quiz);
  setCurrentQuestionIndex(0);
  setAnswers({});
  setShowResults(false);
  setScore(0);
};

  const handleAnswerSelect = (questionIndex, answer) => {
    setAnswers({
      ...answers,
      [questionIndex]: answer
    });
  };

  const handleNext = () => {
    if (currentQuestionIndex < selectedQuiz.questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const handleSubmit = async () => {
    if (Object.keys(answers).length < selectedQuiz.questions.length) {
      if (!confirm('You haven\'t answered all questions. Submit anyway?')) {
        return;
      }
    }

    let correctCount = 0;
    selectedQuiz.questions.forEach((question, index) => {
      if (question.type === 'enumeration') {
        // Case-insensitive comparison for enumeration questions
        const userAnswer = (answers[index] || '').toString().trim().toLowerCase();
        const correctAnswer = question.correctAnswer.toString().trim().toLowerCase();
        if (userAnswer === correctAnswer) {
          correctCount++;
        }
      } else {
        // Multiple choice comparison
        if (answers[index] === question.correctAnswer) {
          correctCount++;
        }
      }
    });

    const finalScore = Math.round((correctCount / selectedQuiz.questions.length) * 100);
    setScore(finalScore);
    setShowResults(true);

    try {
      await addDoc(collection(db, 'quizResults'), {
        quizId: selectedQuiz.id,
        classId: classId,
        studentId: auth.currentUser.uid,
        answers: answers,
        score: finalScore,
        correctAnswers: correctCount,
        totalQuestions: selectedQuiz.questions.length,
        submittedAt: new Date().toISOString()
      });

      // Add this quiz to completed set
      setCompletedQuizzes(prev => new Set([...prev, selectedQuiz.id]));
    } catch (error) {
      console.error('Error saving quiz result:', error);
    }
  };

  const resetQuiz = () => {
    setSelectedQuiz(null);
    setCurrentQuestionIndex(0);
    setAnswers({});
    setShowResults(false);
    setScore(0);
  };

  const isQuizCompleted = (quizId) => {
    return completedQuizzes.has(quizId);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading quizzes...</p>
        </div>
      </div>
    );
  }

  if (showResults) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-2xl w-full">
          <div className="text-center">
            <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 ${
              score >= 70 ? 'bg-green-100' : score >= 50 ? 'bg-yellow-100' : 'bg-red-100'
            }`}>
              <span className={`text-4xl font-bold ${
                score >= 70 ? 'text-green-600' : score >= 50 ? 'text-yellow-600' : 'text-red-600'
              }`}>
                {score}%
              </span>
            </div>

            <h2 className="text-3xl font-bold text-gray-800 mb-2">Quiz Completed!</h2>
            <p className="text-gray-600 mb-8">
              You got {Object.keys(answers).filter(key => answers[key] === selectedQuiz.questions[key].correctAnswer).length} out of {selectedQuiz.questions.length} questions correct
            </p>

            <div className="space-y-4 mb-8 max-h-96 overflow-y-auto">
              {selectedQuiz.questions.map((question, index) => {
                const userAnswer = answers[index];
                let isCorrect = false;
                
                if (question.type === 'enumeration') {
                  const userAns = (userAnswer || '').toString().trim().toLowerCase();
                  const correctAns = question.correctAnswer.toString().trim().toLowerCase();
                  isCorrect = userAns === correctAns;
                } else {
                  isCorrect = userAnswer === question.correctAnswer;
                }

                return (
                  <div key={index} className={`p-4 rounded-lg border-2 ${
                    isCorrect ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
                  }`}>
                    <div className="flex items-start gap-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                        isCorrect ? 'bg-green-500' : 'bg-red-500'
                      }`}>
                        {isCorrect ? (
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-800 mb-2">{question.question}</p>
                        {question.type === 'enumeration' ? (
                          <>
                            <p className="text-sm text-gray-600">
                              Your answer: <span className={isCorrect ? 'text-green-700 font-medium' : 'text-red-700 font-medium'}>
                                {userAnswer || 'Not answered'}
                              </span>
                            </p>
                            {!isCorrect && (
                              <p className="text-sm text-green-700 mt-1">
                                Correct answer: <span className="font-medium">{question.correctAnswer}</span>
                              </p>
                            )}
                          </>
                        ) : (
                          <>
                            <p className="text-sm text-gray-600">
                              Your answer: <span className={isCorrect ? 'text-green-700 font-medium' : 'text-red-700 font-medium'}>
                                {userAnswer !== undefined ? question.options[userAnswer] : 'Not answered'}
                              </span>
                            </p>
                            {!isCorrect && (
                              <p className="text-sm text-green-700 mt-1">
                                Correct answer: <span className="font-medium">{question.options[question.correctAnswer]}</span>
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              onClick={onBack}
              className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium"
            >
              Back to Class
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (selectedQuiz) {
    const currentQuestion = selectedQuiz.questions[currentQuestionIndex];
    const progress = ((currentQuestionIndex + 1) / selectedQuiz.questions.length) * 100;

    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
            <div className="flex items-center justify-between gap-2">
              <h1 className="text-base sm:text-xl font-bold text-gray-800 truncate">{selectedQuiz.title}</h1>
              <button
                onClick={resetQuiz}
                className="px-3 sm:px-4 py-1.5 sm:py-2 text-sm sm:text-base text-gray-600 hover:text-gray-800 whitespace-nowrap"
              >
                Exit Quiz
              </button>
            </div>
            <div className="mt-3 sm:mt-4 bg-gray-200 rounded-full h-2">
              <div
                className="bg-green-600 h-2 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
          <div className="bg-white rounded-lg shadow-lg p-4 sm:p-8">
            <div className="mb-6">
              <span className="text-sm text-gray-600">
                Question {currentQuestionIndex + 1} of {selectedQuiz.questions.length}
              </span>
              <h2 className="text-2xl font-bold text-gray-800 mt-2">{currentQuestion.question}</h2>
            </div>

            <div className="space-y-3 mb-8">
              {currentQuestion.type === 'enumeration' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Type your answer below:
                  </label>
                  <input
                    type="text"
                    value={answers[currentQuestionIndex] || ''}
                    onChange={(e) => handleAnswerSelect(currentQuestionIndex, e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    placeholder="Enter your answer here..."
                  />
                  <p className="text-sm text-gray-500 mt-2">
                    Your answer will be checked automatically
                  </p>
                </div>
              ) : (
                currentQuestion.options.map((option, index) => (
                  <button
                    key={index}
                    onClick={() => handleAnswerSelect(currentQuestionIndex, index)}
                    className={`w-full p-4 text-left rounded-lg border-2 transition ${
                      answers[currentQuestionIndex] === index
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-300 hover:border-green-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                        answers[currentQuestionIndex] === index
                          ? 'border-green-500 bg-green-500'
                          : 'border-gray-300'
                      }`}>
                        {answers[currentQuestionIndex] === index && (
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <span className="font-medium text-gray-800">{option}</span>
                    </div>
                  </button>
                ))
              )}
            </div>

            <div className="flex items-center justify-between">
              <button
                onClick={handlePrevious}
                disabled={currentQuestionIndex === 0}
                className={`px-6 py-3 rounded-lg font-medium transition ${
                  currentQuestionIndex === 0
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Previous
              </button>

              {currentQuestionIndex === selectedQuiz.questions.length - 1 ? (
                <button
                  onClick={handleSubmit}
                  className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium"
                >
                  Submit Quiz
                </button>
              ) : (
                <button
                  onClick={handleNext}
                  className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium"
                >
                  Next
                </button>
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
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg transition">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <h1 className="text-2xl font-bold text-gray-800">Available Quizzes</h1>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {quizzes.length === 0 ? (
          <div className="text-center py-12">
            <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="text-xl font-medium text-gray-700 mb-2">No quizzes available</h3>
            <p className="text-gray-500">Your teacher hasn't created any quizzes yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {quizzes.map((quiz) => {
              const completed = isQuizCompleted(quiz.id);
               const isPastDeadline = quiz.deadline && new Date(quiz.deadline) < new Date();
  const canTake = !completed && !isPastDeadline;
              
              return (
    <div key={quiz.id} className={`bg-white rounded-lg shadow hover:shadow-lg transition p-6 ${
      completed || isPastDeadline ? 'opacity-75' : ''
    }`}>
      <div className="mb-4">
        <div className="flex items-start justify-between mb-2">
          <h3 className="text-xl font-bold text-gray-800">{quiz.title}</h3>
          <div className="flex flex-col gap-1">
            {completed && (
              <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">
                Completed ✓
              </span>
            )}
            {isPastDeadline && !completed && (
              <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded">
                Past Deadline
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-1 text-sm text-gray-600">
          <span>{quiz.questions.length} questions</span>
          {quiz.deadline && (
            <span className={isPastDeadline && !completed ? 'text-red-600 font-medium' : ''}>
              Due: {new Date(quiz.deadline).toLocaleString()}
            </span>
          )}
        </div>
      </div>

      {completed ? (
        <button
          disabled
          className="w-full py-3 bg-gray-300 text-gray-500 rounded-lg cursor-not-allowed font-medium"
        >
          Already Completed
        </button>
      ) : isPastDeadline ? (
        <button
          disabled
          className="w-full py-3 bg-red-300 text-red-700 rounded-lg cursor-not-allowed font-medium"
        >
          Deadline Passed
        </button>
      ) : (
        <button
          onClick={() => startQuiz(quiz)}
          className="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium"
        >
          Start Quiz
        </button>
      )}
    </div>
  );
            })}
          </div>
        )}
      </main>
    </div>
  );
}