import { useState, useEffect, useRef } from 'react';
import { Mail, ArrowLeft, Loader2, Check, AlertCircle, Lock, Eye, EyeOff, ShieldCheck, KeyRound } from 'lucide-react';
import { Modal } from './Modal';
import Button from './Button';
import { authApi } from '../../api';

/**
 * ForgotPasswordModal — 3-step forgot password flow:
 *   Step 1: Enter email
 *   Step 2: Verify 6-digit code
 *   Step 3: Set new password
 */
const ForgotPasswordModal = ({ isOpen, onClose, onSwitchToLogin, initialEmail = '' }) => {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [cooldown, setCooldown] = useState(0);

  const codeInputRefs = useRef([]);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      // Pre-fill email from login field if provided
      setEmail(initialEmail || '');
      setStep(1);
      setCode(['', '', '', '', '', '']);
      setPassword('');
      setPasswordConfirmation('');
      setShowPassword(false);
      setShowConfirmPassword(false);
      setError('');
      setSuccess('');
      setCooldown(0);
    }
  }, [isOpen, initialEmail]);

  // Cooldown timer for resend
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown(prev => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Auto-focus first code input when step 2 opens
  useEffect(() => {
    if (step === 2) {
      setTimeout(() => codeInputRefs.current[0]?.focus(), 100);
    }
  }, [step]);

  // ── Step 1: Send reset code ────────────────────────────────────────────
  const handleSendCode = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await authApi.forgotPassword(email.trim().toLowerCase());
      setStep(2);
      setCooldown(60);
      setSuccess('A verification code has been sent to your email.');
    } catch (err) {
      setError(err.message || 'Failed to send reset code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Resend code ────────────────────────────────────────────────────────
  const handleResendCode = async () => {
    if (cooldown > 0) return;
    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      await authApi.forgotPassword(email.trim().toLowerCase());
      setCooldown(60);
      setCode(['', '', '', '', '', '']);
      setSuccess('A new verification code has been sent to your email.');
      setTimeout(() => codeInputRefs.current[0]?.focus(), 100);
    } catch (err) {
      setError(err.message || 'Failed to resend code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Code input handlers ────────────────────────────────────────────────
  const handleCodeChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;

    const newCode = [...code];
    // Handle paste of full code
    if (value.length > 1) {
      const digits = value.slice(0, 6).split('');
      digits.forEach((d, i) => {
        if (i < 6) newCode[i] = d;
      });
      setCode(newCode);
      const nextIdx = Math.min(digits.length, 5);
      codeInputRefs.current[nextIdx]?.focus();
      return;
    }
    newCode[index] = value;
    setCode(newCode);
    setError('');

    if (value && index < 5) {
      codeInputRefs.current[index + 1]?.focus();
    }
  };

  const handleCodeKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      codeInputRefs.current[index - 1]?.focus();
    }
  };

  const handleCodePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const newCode = [...code];
    pasted.split('').forEach((d, i) => {
      if (i < 6) newCode[i] = d;
    });
    setCode(newCode);
    const nextIdx = Math.min(pasted.length, 5);
    codeInputRefs.current[nextIdx]?.focus();
  };

  // ── Step 2: Verify code ────────────────────────────────────────────────
  const handleVerifyCode = async (e) => {
    e.preventDefault();
    const codeStr = code.join('');
    if (codeStr.length !== 6) {
      setError('Please enter the complete 6-digit code.');
      return;
    }

    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      await authApi.forgotPasswordVerifyCode(email.trim().toLowerCase(), codeStr);
      setStep(3);
      setSuccess('Code verified! Set your new password below.');
    } catch (err) {
      setError(err.message || 'Invalid verification code.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Step 3: Reset password ─────────────────────────────────────────────
  const handleResetPassword = async (e) => {
    e.preventDefault();

    if (!password) {
      setError('Please enter a new password.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== passwordConfirmation) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      await authApi.resetPassword({
        email: email.trim().toLowerCase(),
        password,
        password_confirmation: passwordConfirmation,
      });
      setStep(4); // Success state
    } catch (err) {
      setError(err.message || 'Failed to reset password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    onClose();
  };

  const handleBackToLogin = () => {
    onClose();
    if (onSwitchToLogin) onSwitchToLogin();
  };

  const getTitle = () => {
    switch (step) {
      case 1: return 'Forgot Password';
      case 2: return 'Verify Code';
      case 3: return 'New Password';
      case 4: return 'Password Reset';
      default: return 'Forgot Password';
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={getTitle()}
      size="sm"
    >
      <div className="space-y-4">
        {/* ── Step 1: Email Input ────────────────────────────── */}
        {step === 1 && (
          <form onSubmit={handleSendCode} className="space-y-4" noValidate>
            {/* Icon */}
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-gradient-to-br from-button-500 to-button-600 rounded-xl flex items-center justify-center shadow-lg shadow-button-500/25">
                <KeyRound size={28} className="text-white" />
              </div>
            </div>

            <div className="text-center mb-4">
              <p className="text-gray-600 dark:text-gray-300 text-sm">
                Enter your registered email address and we'll send you a verification code to reset your password.
              </p>
            </div>

            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-700 text-red-600 dark:text-red-400 text-sm rounded-xl flex items-center gap-2">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            <div>
              <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                Email Address
                <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 z-10" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(''); }}
                  placeholder="Enter your email address"
                  className="w-full py-3 pl-10 pr-4 text-sm border-2 rounded-xl transition-all shadow-sm focus:outline-none focus:ring-4 border-primary-300 dark:border-primary-700 bg-white dark:bg-gray-700 hover:border-primary-400 focus:border-primary-500 focus:ring-primary-500/20 dark:text-white"
                  autoFocus
                />
              </div>
            </div>

            <Button type="submit" className="w-full py-3" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 size={18} className="mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail size={18} className="mr-2" />
                  Send Reset Code
                </>
              )}
            </Button>

            <p className="text-center text-sm text-gray-500 dark:text-gray-400">
              Remember your password?{' '}
              <button
                type="button"
                onClick={handleBackToLogin}
                className="font-semibold text-button-600 dark:text-button-400 hover:underline"
              >
                Back to Login
              </button>
            </p>
          </form>
        )}

        {/* ── Step 2: Code Verification ─────────────────────── */}
        {step === 2 && (
          <form onSubmit={handleVerifyCode} className="space-y-4" noValidate>
            {/* Icon */}
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-gradient-to-br from-button-500 to-button-600 rounded-xl flex items-center justify-center shadow-lg shadow-button-500/25">
                <ShieldCheck size={28} className="text-white" />
              </div>
            </div>

            <div className="text-center mb-2">
              <p className="text-gray-600 dark:text-gray-300 text-sm">
                Enter the 6-digit code sent to
              </p>
              <p className="font-semibold text-gray-800 dark:text-gray-100 text-sm mt-1">
                {email}
              </p>
            </div>

            {success && (
              <div className="p-3 bg-green-50 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-700 text-green-600 dark:text-green-400 text-sm rounded-xl flex items-center gap-2">
                <Check size={16} />
                {success}
              </div>
            )}

            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-700 text-red-600 dark:text-red-400 text-sm rounded-xl flex items-center gap-2">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            {/* 6-digit code inputs */}
            <div className="flex justify-center gap-2">
              {code.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => (codeInputRefs.current[index] = el)}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleCodeChange(index, e.target.value)}
                  onKeyDown={(e) => handleCodeKeyDown(index, e)}
                  onPaste={index === 0 ? handleCodePaste : undefined}
                  className="w-11 h-13 text-center text-xl font-bold border-2 rounded-xl transition-all focus:outline-none focus:ring-4 border-primary-300 dark:border-primary-700 bg-white dark:bg-gray-700 focus:border-primary-500 focus:ring-primary-500/20 dark:text-white"
                />
              ))}
            </div>

            <Button type="submit" className="w-full py-3" disabled={isLoading || code.join('').length !== 6}>
              {isLoading ? (
                <>
                  <Loader2 size={18} className="mr-2 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <Check size={18} className="mr-2" />
                  Verify Code
                </>
              )}
            </Button>

            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={() => { setStep(1); setError(''); setSuccess(''); setCode(['', '', '', '', '', '']); }}
                className="flex items-center gap-1 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              >
                <ArrowLeft size={14} />
                Change email
              </button>
              <button
                type="button"
                onClick={handleResendCode}
                disabled={cooldown > 0 || isLoading}
                className={`font-medium ${cooldown > 0 ? 'text-gray-400 dark:text-gray-500 cursor-not-allowed' : 'text-button-600 dark:text-button-400 hover:underline'}`}
              >
                {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend Code'}
              </button>
            </div>
          </form>
        )}

        {/* ── Step 3: New Password ──────────────────────────── */}
        {step === 3 && (
          <form onSubmit={handleResetPassword} className="space-y-4" noValidate>
            {/* Icon */}
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-gradient-to-br from-button-500 to-button-600 rounded-xl flex items-center justify-center shadow-lg shadow-button-500/25">
                <Lock size={28} className="text-white" />
              </div>
            </div>

            <div className="text-center mb-2">
              <p className="text-gray-600 dark:text-gray-300 text-sm">
                Create a new password for your account.
              </p>
            </div>

            {success && (
              <div className="p-3 bg-green-50 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-700 text-green-600 dark:text-green-400 text-sm rounded-xl flex items-center gap-2">
                <Check size={16} />
                {success}
              </div>
            )}

            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-700 text-red-600 dark:text-red-400 text-sm rounded-xl flex items-center gap-2">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            {/* New Password */}
            <div>
              <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                New Password
                <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 z-10" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(''); }}
                  placeholder="Enter new password"
                  className="w-full py-3 pl-10 pr-12 text-sm border-2 rounded-xl transition-all shadow-sm focus:outline-none focus:ring-4 border-primary-300 dark:border-primary-700 bg-white dark:bg-gray-700 hover:border-primary-400 focus:border-primary-500 focus:ring-primary-500/20 dark:text-white"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-gray-300 transition-colors z-10"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {password && password.length < 8 && (
                <p className="mt-1.5 text-xs text-amber-500 flex items-center gap-1">
                  <AlertCircle size={12} />
                  Password must be at least 8 characters
                </p>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                Confirm Password
                <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 z-10" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={passwordConfirmation}
                  onChange={(e) => { setPasswordConfirmation(e.target.value); setError(''); }}
                  placeholder="Confirm new password"
                  className="w-full py-3 pl-10 pr-12 text-sm border-2 rounded-xl transition-all shadow-sm focus:outline-none focus:ring-4 border-primary-300 dark:border-primary-700 bg-white dark:bg-gray-700 hover:border-primary-400 focus:border-primary-500 focus:ring-primary-500/20 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-gray-300 transition-colors z-10"
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {passwordConfirmation && password !== passwordConfirmation && (
                <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle size={12} />
                  Passwords do not match
                </p>
              )}
              {passwordConfirmation && password === passwordConfirmation && password.length >= 8 && (
                <p className="mt-1.5 text-xs text-green-500 flex items-center gap-1">
                  <Check size={12} />
                  Passwords match
                </p>
              )}
            </div>

            <Button type="submit" className="w-full py-3" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 size={18} className="mr-2 animate-spin" />
                  Resetting...
                </>
              ) : (
                <>
                  <Lock size={18} className="mr-2" />
                  Reset Password
                </>
              )}
            </Button>
          </form>
        )}

        {/* ── Step 4: Success ───────────────────────────────── */}
        {step === 4 && (
          <div className="space-y-4 text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg shadow-green-500/25">
                <Check size={28} className="text-white" />
              </div>
            </div>

            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
              Password Reset Successful!
            </h3>
            <p className="text-gray-600 dark:text-gray-300 text-sm">
              Your password has been reset successfully. You can now log in with your new password.
            </p>

            <Button onClick={handleBackToLogin} className="w-full py-3">
              Back to Login
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default ForgotPasswordModal;
