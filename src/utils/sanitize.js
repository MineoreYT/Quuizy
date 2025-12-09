/**
 * Input Sanitization Utilities
 * Protects against XSS attacks and malicious input
 */

/**
 * Sanitize text input by removing potentially dangerous characters
 * @param {string} input - The input string to sanitize
 * @param {number} maxLength - Maximum allowed length (optional)
 * @returns {string} - Sanitized string
 */
export const sanitizeText = (input, maxLength = 1000) => {
  if (!input || typeof input !== 'string') return '';
  
  // Remove any HTML tags
  let sanitized = input.replace(/<[^>]*>/g, '');
  
  // Remove script-related content
  sanitized = sanitized.replace(/javascript:/gi, '');
  sanitized = sanitized.replace(/on\w+\s*=/gi, '');
  
  // Trim whitespace
  sanitized = sanitized.trim();
  
  // Limit length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }
  
  return sanitized;
};

/**
 * Sanitize email input
 * @param {string} email - Email to sanitize
 * @returns {string} - Sanitized email
 */
export const sanitizeEmail = (email) => {
  if (!email || typeof email !== 'string') return '';
  
  // Remove whitespace and convert to lowercase
  let sanitized = email.trim().toLowerCase();
  
  // Remove any characters that aren't valid in emails
  sanitized = sanitized.replace(/[^a-z0-9@._+-]/g, '');
  
  return sanitized;
};

/**
 * Sanitize URL input
 * @param {string} url - URL to sanitize
 * @returns {string} - Sanitized URL or empty string if invalid
 */
export const sanitizeUrl = (url) => {
  if (!url || typeof url !== 'string') return '';
  
  const trimmed = url.trim();
  
  // Only allow http and https protocols
  if (!trimmed.match(/^https?:\/\//i)) {
    return '';
  }
  
  // Remove javascript: and data: protocols
  if (trimmed.match(/^(javascript|data):/i)) {
    return '';
  }
  
  return trimmed;
};

/**
 * Sanitize class code (6 alphanumeric characters)
 * @param {string} code - Class code to sanitize
 * @returns {string} - Sanitized code
 */
export const sanitizeClassCode = (code) => {
  if (!code || typeof code !== 'string') return '';
  
  // Only allow alphanumeric characters, convert to uppercase
  const sanitized = code.replace(/[^a-z0-9]/gi, '').toUpperCase();
  
  // Limit to 6 characters
  return sanitized.substring(0, 6);
};

/**
 * Sanitize number input
 * @param {any} input - Input to convert to number
 * @param {number} min - Minimum allowed value
 * @param {number} max - Maximum allowed value
 * @returns {number} - Sanitized number
 */
export const sanitizeNumber = (input, min = 0, max = 100) => {
  const num = parseInt(input, 10);
  
  if (isNaN(num)) return min;
  if (num < min) return min;
  if (num > max) return max;
  
  return num;
};

/**
 * Sanitize array of strings
 * @param {Array} arr - Array to sanitize
 * @param {number} maxLength - Max length per item
 * @returns {Array} - Sanitized array
 */
export const sanitizeArray = (arr, maxLength = 500) => {
  if (!Array.isArray(arr)) return [];
  
  return arr
    .filter(item => typeof item === 'string')
    .map(item => sanitizeText(item, maxLength))
    .filter(item => item.length > 0);
};

/**
 * Escape HTML special characters for safe display
 * @param {string} text - Text to escape
 * @returns {string} - Escaped text
 */
export const escapeHtml = (text) => {
  if (!text || typeof text !== 'string') return '';
  
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  };
  
  return text.replace(/[&<>"'/]/g, (char) => map[char]);
};

/**
 * Validate and sanitize quiz question
 * @param {Object} question - Question object
 * @returns {Object} - Sanitized question
 */
export const sanitizeQuizQuestion = (question) => {
  if (!question || typeof question !== 'object') {
    return null;
  }
  
  return {
    question: sanitizeText(question.question, 500),
    options: sanitizeArray(question.options, 200).slice(0, 6), // Max 6 options
    correctAnswer: sanitizeText(question.correctAnswer, 200),
    points: sanitizeNumber(question.points, 1, 100),
  };
};

/**
 * Validate quiz data before submission
 * @param {Object} quizData - Quiz data to validate
 * @returns {Object|null} - Sanitized quiz or null if invalid
 */
export const sanitizeQuizData = (quizData) => {
  if (!quizData || typeof quizData !== 'object') {
    return null;
  }
  
  const sanitized = {
    title: sanitizeText(quizData.title, 200),
    description: sanitizeText(quizData.description, 1000),
    questions: [],
  };
  
  // Validate title
  if (!sanitized.title || sanitized.title.length < 3) {
    return null;
  }
  
  // Sanitize questions
  if (Array.isArray(quizData.questions)) {
    sanitized.questions = quizData.questions
      .map(q => sanitizeQuizQuestion(q))
      .filter(q => q !== null && q.question.length > 0);
  }
  
  // Must have at least 1 question
  if (sanitized.questions.length === 0) {
    return null;
  }
  
  return sanitized;
};
