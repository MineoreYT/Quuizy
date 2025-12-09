import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions();

/**
 * Submit quiz answers to Cloud Function for server-side validation
 * This prevents students from seeing correct answers in the client
 */
export const submitQuizSecure = async (quizId, classId, answers) => {
  const submitQuiz = httpsCallable(functions, 'submitQuiz');
  
  try {
    const result = await submitQuiz({ quizId, classId, answers });
    return result.data;
  } catch (error) {
    console.error('Error submitting quiz:', error);
    throw error;
  }
};

/**
 * Get quiz questions without correct answers
 * This prevents students from seeing answers before submitting
 */
export const getQuizQuestionsSecure = async (quizId) => {
  const getQuizQuestions = httpsCallable(functions, 'getQuizQuestions');
  
  try {
    const result = await getQuizQuestions({ quizId });
    return result.data;
  } catch (error) {
    console.error('Error fetching quiz:', error);
    throw error;
  }
};
