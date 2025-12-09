import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useState } from 'react';
import { resendVerificationEmail } from '../services/authService';
import { auth } from '../config/firebase';

export default function ProtectedRoute({ children, requiredRole }) {
  const { currentUser, userRole, loading } = useAuth();
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState('');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (!currentUser.emailVerified) {
    const handleResendEmail = async () => {
      setResending(true);
      setResendMessage('');
      try {
        await resendVerificationEmail();
        setResendMessage('✅ Verification email sent! Check your inbox.');
      } catch (error) {
        setResendMessage('❌ Failed to send email. Please try again.');
      } finally {
        setResending(false);
      }
    };

    const handleRefresh = () => {
      window.location.reload();
    };

    const handleLogout = async () => {
      await auth.signOut();
      window.location.href = '/login';
    };

    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-yellow-50 to-orange-100 p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Email Verification Required</h2>
          <p className="text-gray-600 mb-4">
            Please verify your email address to access Quizzie. Check your inbox for the verification link.
          </p>
          <p className="text-sm text-gray-500 mb-6">
            Email: <span className="font-semibold">{currentUser.email}</span>
          </p>
          
          {resendMessage && (
            <div className={`mb-4 p-3 rounded-lg text-sm ${
              resendMessage.includes('✅') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
            }`}>
              {resendMessage}
            </div>
          )}

          <div className="space-y-3">
            <button
              onClick={handleRefresh}
              className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 transition font-medium"
            >
              I've Verified - Refresh Page
            </button>
            <button
              onClick={handleResendEmail}
              disabled={resending}
              className="w-full bg-gray-200 text-gray-700 py-3 rounded-lg hover:bg-gray-300 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {resending ? 'Sending...' : 'Resend Verification Email'}
            </button>
            <button
              onClick={handleLogout}
              className="w-full text-gray-600 hover:text-gray-800 py-2 text-sm font-medium"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (requiredRole && userRole !== requiredRole) {
    return <Navigate to={userRole === 'teacher' ? '/teacher/dashboard' : '/student/dashboard'} replace />;
  }

  return children;
}