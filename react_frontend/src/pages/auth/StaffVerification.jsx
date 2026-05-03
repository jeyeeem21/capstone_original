import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Mail, CheckCircle, Loader2, ArrowLeft, RefreshCw } from 'lucide-react';
import { Button, FormInput, useToast } from '../../components/ui';
import { apiClient } from '../../api';

const StaffVerification = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const toast = useToast();
  
  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [verificationCode, setVerificationCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [verified, setVerified] = useState(false);

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    if (!email || !verificationCode || verificationCode.length !== 6) return;

    try {
      setLoading(true);
      setError('');
      
      const response = await apiClient.post('/staff/verify-email', {
        email: email,
        code: verificationCode,
      });

      if (response.success) {
        setVerified(true);
        toast.success('Email Verified', 'Your email has been verified successfully! You can now log in to your account.');
        
        // Redirect to login after 2 seconds
        setTimeout(() => {
          navigate('/?login=true', { 
            state: { 
              message: 'Email verified successfully! You can now log in.',
              email: email 
            }
          });
        }, 2000);
      } else {
        setError(response.message || 'Verification failed');
      }
    } catch (error) {
      const message = error.response?.data?.message || 'Verification failed. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!email) {
      toast.error('Error', 'Please enter your email address first.');
      return;
    }

    try {
      setResending(true);
      const response = await apiClient.post('/staff/resend-verification', {
        email: email,
      });

      if (response.success) {
        toast.success('Code Sent', `Verification code sent to ${email}`);
        setVerificationCode('');
        setError('');
      } else {
        toast.error('Error', response.message || 'Failed to resend verification code.');
      }
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to resend verification code.';
      toast.error('Error', message);
    } finally {
      setResending(false);
    }
  };

  if (verified) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 text-center">
          <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={40} className="text-green-600 dark:text-green-400" />
          </div>
          
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4">
            Email Verified!
          </h1>
          
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            Your email address has been successfully verified. You can now log in to your account.
          </p>
          
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Redirecting to login page...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
            <Mail size={40} className="text-blue-600 dark:text-blue-400" />
          </div>
          
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">
            Verify Your Email
          </h1>
          
          <p className="text-gray-600 dark:text-gray-300">
            Enter the 6-digit verification code sent to your email address to activate your account.
          </p>
        </div>

        <form onSubmit={handleVerifyCode} className="space-y-6">
          <FormInput
            label="Email Address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            required
          />

          <div>
            <FormInput
              label="Verification Code"
              type="text"
              value={verificationCode}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                setVerificationCode(value);
                setError('');
              }}
              placeholder="000000"
              maxLength={6}
              className="text-center text-2xl tracking-widest font-mono"
              required
            />
            {error && (
              <p className="text-sm text-red-500 mt-2">{error}</p>
            )}
          </div>

          <div className="space-y-4">
            <Button
              type="submit"
              className="w-full"
              disabled={loading || !email || verificationCode.length !== 6}
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="mr-2 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <CheckCircle size={16} className="mr-2" />
                  Verify Email
                </>
              )}
            </Button>

            <button
              type="button"
              onClick={handleResendCode}
              disabled={resending || !email}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {resending ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <RefreshCw size={16} />
                  Resend Code
                </>
              )}
            </button>
          </div>
        </form>

        <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={() => navigate('/?login=true')}
            className="flex items-center justify-center gap-2 w-full px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          >
            <ArrowLeft size={16} />
            Back to Login
          </button>
        </div>

        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-500/30">
          <p className="text-xs text-blue-700 dark:text-blue-300">
            <strong>Note:</strong> The verification code expires in 24 hours. If you don't receive the email, check your spam folder or contact your administrator.
          </p>
        </div>
      </div>
    </div>
  );
};

export default StaffVerification;