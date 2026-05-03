import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Lock, Eye, EyeOff, ArrowLeft, ArrowRight, Check, AlertCircle,
  Loader2, ShieldCheck, FileText, ScrollText, CheckCircle2, XCircle, Mail,
} from 'lucide-react';
import { Modal, FormModal } from './Modal';
import Button from './Button';
import { FormInput } from './FormElements';
import AddressAutocomplete from './AddressAutocomplete';
import { useAuth } from '../../context/AuthContext';
import { useBusinessSettings } from '../../context/BusinessSettingsContext';
import { authApi, websiteContentApi } from '../../api';
import { DEFAULT_LOGO } from '../../api/config';

const PHONE_REGEX = /^(\+63\d{10}|09\d{9})$/;

/**
 * RegisterModal — 4-step registration flow using separate modals:
 *   Step 1: Customer Details  (FormModal — mirrors admin "Add New Customer")
 *   Step 2: Terms & Privacy   (Modal — read & accept)
 *   Step 3: Create Account    (Modal — password fields, email from step 1)
 *   Step 4: Email Verification (Modal — 6-digit code)
 */
const RegisterModal = ({ isOpen, onClose, onSwitchToLogin }) => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { settings } = useBusinessSettings();

  // ── Step management ────────────────────────────────────────────────────────
  const [step, setStep] = useState(null);

  useEffect(() => {
    if (isOpen) setStep('details');
    else setStep(null);
  }, [isOpen]);

  // ── Customer details (step 1) ──────────────────────────────────────────────
  const [customerForm, setCustomerForm] = useState({
    name: '', contact: '', phone: '', email: '', address: '', address_landmark: '',
  });
  const [detailErrors, setDetailErrors] = useState({});
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [emailTaken, setEmailTaken] = useState(false);
  const emailDebounce = useRef(null);

  // ── Account creation (step 3) ──────────────────────────────────────────────
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [accountErrors, setAccountErrors] = useState({});
  const [accountSubmitted, setAccountSubmitted] = useState(false);

  // ── Terms (step 2) ─────────────────────────────────────────────────────────
  const [legalContent, setLegalContent] = useState(null);
  const [loadingLegal, setLoadingLegal] = useState(false);
  const [legalError, setLegalError] = useState('');
  const [legalTab, setLegalTab] = useState('terms');

  // ── Verification (step 4) ──────────────────────────────────────────────────
  const [sendingCode, setSendingCode] = useState(false);
  const [verifyCode, setVerifyCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState('');
  const [resendCountdown, setResendCountdown] = useState(0);
  const countdownRef = useRef(null);
  const [completing, setCompleting] = useState(false);
  const [globalError, setGlobalError] = useState('');

  // ── Reset everything when modal closes ─────────────────────────────────────
  useEffect(() => {
    if (!isOpen) {
      setCustomerForm({ name: '', contact: '', phone: '', email: '', address: '' });
      setDetailErrors({});
      setCheckingEmail(false);
      setEmailTaken(false);
      setPassword('');
      setPasswordConfirm('');
      setShowPassword(false);
      setShowConfirm(false);
      setAccountErrors({});
      setAccountSubmitted(false);
      setLegalTab('terms');
      setLegalError('');
      setSendingCode(false);
      setVerifyCode('');
      setVerifying(false);
      setVerifyError('');
      setResendCountdown(0);
      setCompleting(false);
      setGlobalError('');
      clearInterval(countdownRef.current);
    }
  }, [isOpen]);

  // ── Redirect if already authenticated ──────────────────────────────────────
  useEffect(() => {
    if (isAuthenticated && isOpen) {
      onClose();
      navigate('/customer/dashboard', { replace: true });
    }
  }, [isAuthenticated, isOpen, navigate, onClose]);

  // ── Countdown timer ────────────────────────────────────────────────────────
  const startCountdown = useCallback((seconds = 60) => {
    setResendCountdown(seconds);
    clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setResendCountdown(prev => {
        if (prev <= 1) { clearInterval(countdownRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => () => clearInterval(countdownRef.current), []);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const logoSrc = settings?.business_logo && !settings.business_logo.startsWith('blob:')
    ? settings.business_logo : DEFAULT_LOGO;
  const bizName = settings?.business_name || 'KJP Ricemill';

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 1: Customer Details — email check on change
  // ═══════════════════════════════════════════════════════════════════════════
  const handleDetailChange = (e) => {
    const { name, value } = e.target;
    setCustomerForm(prev => ({ ...prev, [name]: value }));
    setDetailErrors(prev => ({ ...prev, [name]: undefined }));

    if (name === 'email') {
      setEmailTaken(false);
      clearTimeout(emailDebounce.current);
      if (!value || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return;
      setCheckingEmail(true);
      emailDebounce.current = setTimeout(async () => {
        try {
          const res = await authApi.checkEmail(value.trim());
          if (res.taken) {
            setEmailTaken(true);
            setDetailErrors(prev => ({ ...prev, email: ['This email is already registered.'] }));
          }
        } catch {/* ignore */}
        finally { setCheckingEmail(false); }
      }, 500);
    }

    if (name === 'phone' && value) {
      const clean = value.replace(/\s/g, '');
      if (clean && !PHONE_REGEX.test(clean)) {
        setDetailErrors(prev => ({ ...prev, phone: ['Format: +63 followed by 10 digits or 09 followed by 9 digits'] }));
      }
    }
  };

  const handleDetailSubmit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!customerForm.name.trim()) errs.name = ['Business name is required.'];
    if (!customerForm.contact.trim()) errs.contact = ['Contact person is required.'];
    const phone = customerForm.phone.replace(/\s/g, '');
    if (!phone) errs.phone = ['Phone number is required.'];
    else if (!PHONE_REGEX.test(phone)) errs.phone = ['Format: +63 followed by 10 digits or 09 followed by 9 digits'];
    if (!customerForm.email.trim()) errs.email = ['Email is required.'];
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerForm.email)) errs.email = ['Enter a valid email address.'];
    else if (emailTaken) errs.email = ['This email is already registered.'];
    if (!customerForm.address.trim()) errs.address = ['Address is required.'];

    if (Object.keys(errs).length) {
      setDetailErrors(errs);
      throw new Error('validation');
    }

    if (!legalContent) {
      setLoadingLegal(true);
      setLegalError('');
      try {
        const res = await websiteContentApi.getLegalContent();
        if (res.success && res.data) setLegalContent(res.data);
        else setLegalError('Failed to load terms. Please try again.');
      } catch {
        setLegalError('Failed to load terms. Please try again.');
      } finally { setLoadingLegal(false); }
    }
    setLegalTab('terms');
    setStep('terms');
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 2: Terms
  // ═══════════════════════════════════════════════════════════════════════════
  const handleDeclineTerms = () => setStep('details');
  const handleRetryLegal = async () => {
    setLoadingLegal(true);
    setLegalError('');
    try {
      const res = await websiteContentApi.getLegalContent();
      if (res.success && res.data) setLegalContent(res.data);
      else setLegalError('Failed to load terms. Please try again.');
    } catch {
      setLegalError('Failed to load terms. Please try again.');
    } finally { setLoadingLegal(false); }
  };
  const handleAcceptTerms = () => {
    setVerifyCode('');
    setVerifyError('');
    setGlobalError('');
    handleSendVerification();
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 3: Send verification code & Verify email
  // ═══════════════════════════════════════════════════════════════════════════
  const handleSendVerification = async () => {
    setSendingCode(true);
    setGlobalError('');
    try {
      const res = await authApi.registerSendVerification({
        business_name: customerForm.name.trim(),
        contact_person: customerForm.contact.trim(),
        phone: customerForm.phone.replace(/\s/g, ''),
        email: customerForm.email.trim().toLowerCase(),
        address: customerForm.address.trim(),
        address_landmark: customerForm.address_landmark?.trim() || '',
      });
      if (!res.success) {
        if (res.errors) {
          const serverDetailErrs = {};
          Object.entries(res.errors).forEach(([key, val]) => {
            if (['business_name', 'contact_person', 'phone', 'email', 'address'].includes(key)) {
              const mappedKey = key === 'business_name' ? 'name' : key === 'contact_person' ? 'contact' : key;
              serverDetailErrs[mappedKey] = val;
            }
          });
          if (Object.keys(serverDetailErrs).length) {
            setDetailErrors(serverDetailErrs);
            setGlobalError(res.error || res.message || 'Please fix the errors in your details.');
            setStep('details');
            return;
          }
        }
        setGlobalError(res.error || res.message || 'Failed to send verification code.');
        return;
      }
      setVerifyCode('');
      setVerifyError('');
      startCountdown(60);
      setStep('verify');
    } catch (err) {
      setGlobalError(err.message || 'Failed to send verification code.');
    } finally {
      setSendingCode(false);
    }
  };

  const handleVerify = async (code) => {
    if (code.length < 6) return;
    setVerifying(true);
    setVerifyError('');
    try {
      const res = await authApi.registerVerifyCode(customerForm.email.trim().toLowerCase(), code);
      if (!res.success) { setVerifyError(res.error || 'Invalid verification code.'); return; }
      // Email verified — move to password step
      setPassword('');
      setPasswordConfirm('');
      setAccountErrors({});
      setAccountSubmitted(false);
      setGlobalError('');
      setStep('account');
    } catch (err) {
      setVerifyError(err.message || 'Verification failed.');
    } finally {
      setVerifying(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 4: Create Account — set password after verification
  // ═══════════════════════════════════════════════════════════════════════════
  const handleAccountSubmit = async () => {
    setAccountSubmitted(true);
    const errs = {};
    if (!password) errs.password = ['Password is required.'];
    else if (password.length < 8) errs.password = ['Minimum 8 characters.'];
    if (!passwordConfirm) errs.password_confirmation = ['Please confirm your password.'];
    else if (password !== passwordConfirm) errs.password_confirmation = ['Passwords do not match.'];

    if (Object.keys(errs).length) { setAccountErrors(errs); return; }

    setCompleting(true);
    setGlobalError('');
    try {
      const res = await authApi.registerComplete(customerForm.email.trim().toLowerCase(), password, passwordConfirm);
      if (!res.success) {
        if (res.errors) {
          setAccountErrors(res.errors);
        }
        setGlobalError(res.error || res.message || 'Registration failed. Please try again.');
        return;
      }
      setStep('done');
    } catch (err) {
      setGlobalError(err.message || 'Registration failed.');
    } finally {
      setCompleting(false);
    }
  };

  const handleResend = async () => {
    if (resendCountdown > 0) return;
    setSendingCode(true);
    setVerifyError('');
    try {
      const res = await authApi.registerSendVerification({
        business_name: customerForm.name.trim(),
        contact_person: customerForm.contact.trim(),
        phone: customerForm.phone.replace(/\s/g, ''),
        email: customerForm.email.trim().toLowerCase(),
        address: customerForm.address.trim(),
        address_landmark: customerForm.address_landmark?.trim() || '',
      });
      if (res.success) startCountdown(60);
      else setVerifyError(res.error || 'Failed to resend code.');
    } catch {
      setVerifyError('Failed to resend code.');
    } finally {
      setSendingCode(false);
    }
  };

  const handleCancelVerification = async () => {
    try { await authApi.registerCancel(customerForm.email.trim().toLowerCase()); } catch {/* silent */}
    setVerifyCode('');
    setVerifyError('');
    setStep('details');
  };

  const handleDoneLogin = () => {
    onClose();
    setTimeout(() => onSwitchToLogin?.(), 150);
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <>
      {/* ═══ STEP 1: Customer Details (FormModal — like admin Add Customer) ═══ */}
      <FormModal
        isOpen={step === 'details'}
        onClose={onClose}
        onSubmit={handleDetailSubmit}
        title="Add New Customer"
        submitText={<><ArrowRight size={16} className="mr-1" /> Next: Review Terms</>}
        size="lg"
        loading={checkingEmail}
        submitDisabled={emailTaken}
      >
        {({ submitted }) => (
          <>
            {/* Logo */}
            <div className="flex justify-center mb-4">
              <div className="w-14 h-14 bg-gradient-to-br from-button-500 to-button-600 rounded-xl flex items-center justify-center shadow-lg shadow-button-500/25 overflow-hidden">
                <img src={logoSrc} alt={bizName} className="w-10 h-10 object-contain"
                  onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
                <span className="hidden text-white font-bold text-sm">{bizName.substring(0, 3)}</span>
              </div>
            </div>
            <p className="text-center text-sm text-gray-600 dark:text-gray-300 mb-4">
              Fill in your business details to get started.
            </p>

            {globalError && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-700 text-red-600 dark:text-red-400 text-sm rounded-xl flex items-center gap-2">
                <AlertCircle size={16} className="flex-shrink-0" />
                {globalError}
              </div>
            )}

            <FormInput label="Business Name" name="name" value={customerForm.name}
              onChange={handleDetailChange} required placeholder="Enter business name"
              submitted={submitted} error={detailErrors.name?.[0]} />
            <FormInput label="Contact Person" name="contact" value={customerForm.contact}
              onChange={handleDetailChange} required placeholder="Enter contact person name"
              submitted={submitted} error={detailErrors.contact?.[0]} />
            <div className="grid grid-cols-2 gap-4">
              <FormInput label="Phone" name="phone" value={customerForm.phone}
                onChange={handleDetailChange} required placeholder="+639171234567 or 09171234567"
                submitted={submitted} error={detailErrors.phone?.[0]}
                hint="Format: +63 followed by 10 digits or 09 followed by 9 digits" />
              <FormInput label="Email" name="email" type="email" value={customerForm.email}
                onChange={handleDetailChange} required placeholder="email@example.com"
                submitted={submitted} error={detailErrors.email?.[0]} loading={checkingEmail} />
            </div>
            <AddressAutocomplete label="Address" name="address" value={customerForm.address}
              onChange={handleDetailChange} required
              submitted={submitted} error={detailErrors.address?.[0]}
              landmark={customerForm.address_landmark}
              onLandmarkChange={handleDetailChange} />

            <p className="mt-2 text-center text-sm text-gray-500 dark:text-gray-400">
              Already have an account?{' '}
              <button type="button" onClick={() => { onClose(); setTimeout(() => onSwitchToLogin?.(), 150); }}
                className="font-semibold text-button-600 dark:text-button-400 hover:underline">
                Sign in
              </button>
            </p>
          </>
        )}
      </FormModal>

      {/* ═══ STEP 2: Terms & Conditions ═══ */}
      <Modal
        isOpen={step === 'terms'}
        onClose={handleDeclineTerms}
        title="Terms & Privacy Policy"
        size="lg"
        footer={
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={handleDeclineTerms}>
              <ArrowLeft size={16} className="mr-1" /> Back
            </Button>
            <Button onClick={handleAcceptTerms} disabled={loadingLegal || !!legalError}>
              <Check size={16} className="mr-1" /> I Accept & Continue
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="flex justify-center mb-2">
            <div className="w-12 h-12 bg-button-100 dark:bg-button-900/30 rounded-2xl flex items-center justify-center">
              <ScrollText size={24} className="text-button-600 dark:text-button-400" />
            </div>
          </div>
          <p className="text-center text-sm text-gray-600 dark:text-gray-300">
            Please read and accept before creating your account.
          </p>

          {/* Tabs */}
          <div className="flex bg-gray-100 dark:bg-gray-700 rounded-xl p-1 gap-1">
            {[
              { key: 'terms',   label: 'Terms & Conditions', icon: <FileText size={14} /> },
              { key: 'privacy', label: 'Privacy Policy',     icon: <ShieldCheck size={14} /> },
            ].map(({ key, label, icon }) => (
              <button
                key={key}
                onClick={() => setLegalTab(key)}
                className={[
                  'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all',
                  legalTab === key
                    ? 'bg-button-500 text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600',
                ].join(' ')}
              >
                {icon} {label}
              </button>
            ))}
          </div>

          {/* Content */}
          {loadingLegal ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-button-500" />
            </div>
          ) : legalError ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
              <AlertCircle size={28} className="text-red-400" />
              <p className="text-sm text-red-500">{legalError}</p>
              <button type="button" onClick={handleRetryLegal}
                className="text-sm font-medium text-button-600 dark:text-button-400 hover:underline">
                Retry
              </button>
            </div>
          ) : (
            <div className="max-h-60 overflow-y-auto p-4 rounded-xl border border-primary-200 dark:border-primary-700 bg-primary-50/30 dark:bg-gray-700/30 text-sm space-y-3 text-gray-700 dark:text-gray-300">
              {legalTab === 'terms' && (
                <>
                  <h3 className="font-bold text-gray-800 dark:text-gray-100">{bizName} — Terms and Conditions</h3>
                  {legalContent?.termsLastUpdated && <p className="text-xs text-gray-500">{legalContent.termsLastUpdated}</p>}
                  {legalContent?.termsIntro && <p>{legalContent.termsIntro}</p>}
                  {(legalContent?.termsSections || []).map((s, i) => (
                    <div key={i}>
                      <h4 className="font-semibold text-gray-800 dark:text-gray-100">{i + 1}. {s.title}</h4>
                      <p>{s.content}</p>
                    </div>
                  ))}
                  {!legalContent?.termsSections?.length && (
                    <p className="text-center py-4 text-gray-400">No terms configured yet.</p>
                  )}
                </>
              )}
              {legalTab === 'privacy' && (
                <>
                  <h3 className="font-bold text-gray-800 dark:text-gray-100">{bizName} — Privacy Policy</h3>
                  {legalContent?.privacyLastUpdated && <p className="text-xs text-gray-500">{legalContent.privacyLastUpdated}</p>}
                  {legalContent?.privacyIntro && <p>{legalContent.privacyIntro}</p>}
                  {(legalContent?.privacySections || []).map((s, i) => (
                    <div key={i}>
                      <h4 className="font-semibold text-gray-800 dark:text-gray-100">{i + 1}. {s.title}</h4>
                      <p>{s.content}</p>
                    </div>
                  ))}
                  {!legalContent?.privacySections?.length && (
                    <p className="text-center py-4 text-gray-400">No privacy policy configured yet.</p>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* ═══ STEP 3: Email Verification ═══ */}
      <Modal
        isOpen={step === 'verify'}
        onClose={() => {}}
        title="Verify Your Email"
        size="lg"
        showCloseButton={false}
        closeOnOverlayClick={false}
      >
        <div className="space-y-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail size={32} className="text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">
              Verify Your Email
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              A 6-digit verification code has been sent to <strong>{customerForm.email}</strong>
            </p>
          </div>

          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-500/30">
            <h4 className="font-semibold text-blue-800 dark:text-blue-300 mb-3 flex items-center gap-2">
              <ShieldCheck size={18} />
              Your Details
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-blue-700 dark:text-blue-400">Business:</span>
                <span className="font-semibold text-blue-800 dark:text-blue-200">{customerForm.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-blue-700 dark:text-blue-400">Contact:</span>
                <span className="font-semibold text-blue-800 dark:text-blue-200">{customerForm.contact}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-blue-700 dark:text-blue-400">Email:</span>
                <span className="font-semibold text-blue-800 dark:text-blue-200">{customerForm.email}</span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
              Verification Code <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                inputMode="numeric"
                value={verifyCode}
                onChange={e => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setVerifyCode(val);
                  setVerifyError('');
                  if (val.length === 6) handleVerify(val);
                }}
                placeholder="••••••"
                maxLength={6}
                disabled={verifying}
                className={`w-full px-4 py-4 text-center text-2xl tracking-[0.5em] font-mono border-2 rounded-xl transition-all focus:outline-none focus:ring-4 ${
                  verifyError
                    ? 'border-red-400 bg-red-50 dark:bg-red-900/20 focus:border-red-500 focus:ring-red-500/20'
                    : 'border-primary-300 dark:border-primary-700 bg-white dark:bg-gray-700 focus:border-button-500 focus:ring-button-500/20'
                }`}
                autoFocus
              />
              {verifying && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  <Loader2 size={20} className="animate-spin text-button-500" />
                </div>
              )}
            </div>
            {verifyError && (
              <p className="mt-2 text-sm text-red-500 flex items-center gap-1">
                <AlertCircle size={14} /> {verifyError}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400">Didn't receive the code?</span>
            <button
              onClick={handleResend}
              disabled={resendCountdown > 0 || sendingCode}
              className="font-medium text-button-600 dark:text-button-400 hover:underline disabled:opacity-50 disabled:no-underline flex items-center gap-1"
            >
              {sendingCode ? <><Loader2 size={14} className="animate-spin" /> Sending...</> :
               resendCountdown > 0 ? `Resend in ${resendCountdown}s` : 'Resend Code'}
            </button>
          </div>

          <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-500/30">
            <div className="flex items-start gap-3">
              <CheckCircle2 size={18} className="text-green-600 dark:text-green-400 mt-0.5" />
              <div>
                <h4 className="font-semibold text-green-800 dark:text-green-300 mb-1">Next Steps</h4>
                <ol className="text-xs text-green-700 dark:text-green-400 space-y-1 list-decimal list-inside">
                  <li>Check your email for the 6-digit code</li>
                  <li>Enter the code above to verify</li>
                  <li>Once verified, you'll set your password</li>
                </ol>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button variant="outline" onClick={handleCancelVerification} disabled={verifying}>
              <XCircle size={16} className="mr-2" /> Cancel
            </Button>
            <Button
              onClick={() => handleVerify(verifyCode)}
              disabled={verifyCode.length < 6 || verifying}
            >
              {verifying
                ? <><Loader2 size={16} className="mr-2 animate-spin" /> Verifying...</>
                : <><Check size={16} className="mr-2" /> Verify & Continue</>}
            </Button>
          </div>

          <p className="text-center text-xs text-gray-400 dark:text-gray-500">
            Code expires in 15 minutes. Check your spam folder if you don't see it.
          </p>
        </div>
      </Modal>

      {/* ═══ STEP 4: Create Account (password — after email verified) ═══ */}
      <Modal
        isOpen={step === 'account'}
        onClose={() => {}}
        title="Set Your Password"
        size="lg"
        showCloseButton={false}
        closeOnOverlayClick={false}
      >
        <div className="space-y-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock size={32} className="text-green-600 dark:text-green-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">
              Almost Done!
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              Your email has been verified. Set a password for <strong>{customerForm.name || 'your account'}</strong>
            </p>
          </div>

          <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-500/30">
            <h4 className="font-semibold text-green-800 dark:text-green-300 mb-3 flex items-center gap-2">
              <CheckCircle2 size={18} />
              Email Verified
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-green-700 dark:text-green-400">Business:</span>
                <span className="font-semibold text-green-800 dark:text-green-200">{customerForm.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-green-700 dark:text-green-400">Contact:</span>
                <span className="font-semibold text-green-800 dark:text-green-200">{customerForm.contact}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-green-700 dark:text-green-400">Email:</span>
                <span className="font-semibold text-green-800 dark:text-green-200">{customerForm.email}</span>
              </div>
            </div>
          </div>

          {globalError && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-700 text-red-600 dark:text-red-400 text-sm rounded-xl flex items-center gap-2">
              <AlertCircle size={16} className="flex-shrink-0" />
              {globalError}
            </div>
          )}

          {/* Password */}
          <div>
            <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
              Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 z-10" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => { setPassword(e.target.value); setAccountErrors(prev => ({ ...prev, password: undefined })); }}
                placeholder="Minimum 8 characters"
                className={`w-full pl-10 pr-12 py-3 text-sm border-2 rounded-xl transition-all shadow-sm focus:outline-none focus:ring-4 ${
                  accountErrors.password
                    ? 'border-red-400 bg-red-50 dark:bg-red-900/20 focus:border-red-500 focus:ring-red-500/20'
                    : (accountSubmitted && password && password.length >= 8)
                      ? 'border-green-400 bg-green-50 dark:bg-green-900/20 focus:border-green-500 focus:ring-green-500/20'
                      : 'border-primary-300 dark:border-primary-700 bg-white dark:bg-gray-700 hover:border-primary-400 focus:border-primary-500 focus:ring-primary-500/20'
                }`}
                autoFocus
              />
              <button type="button" onClick={() => setShowPassword(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors z-10">
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {accountErrors.password && (
              <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1"><AlertCircle size={12} />{accountErrors.password[0]}</p>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
              Confirm Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 z-10" />
              <input
                type={showConfirm ? 'text' : 'password'}
                value={passwordConfirm}
                onChange={e => { setPasswordConfirm(e.target.value); setAccountErrors(prev => ({ ...prev, password_confirmation: undefined })); }}
                placeholder="Re-enter password"
                className={`w-full pl-10 pr-12 py-3 text-sm border-2 rounded-xl transition-all shadow-sm focus:outline-none focus:ring-4 ${
                  accountErrors.password_confirmation
                    ? 'border-red-400 bg-red-50 dark:bg-red-900/20 focus:border-red-500 focus:ring-red-500/20'
                    : (accountSubmitted && passwordConfirm && password === passwordConfirm)
                      ? 'border-green-400 bg-green-50 dark:bg-green-900/20 focus:border-green-500 focus:ring-green-500/20'
                      : 'border-primary-300 dark:border-primary-700 bg-white dark:bg-gray-700 hover:border-primary-400 focus:border-primary-500 focus:ring-primary-500/20'
                }`}
              />
              <button type="button" onClick={() => setShowConfirm(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors z-10">
                {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {accountErrors.password_confirmation && (
              <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1"><AlertCircle size={12} />{accountErrors.password_confirmation[0]}</p>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button onClick={handleAccountSubmit} disabled={completing} className="w-full">
              {completing
                ? <><Loader2 size={16} className="mr-2 animate-spin" /> Creating Account...</>
                : <><CheckCircle2 size={16} className="mr-2" /> Create Account</>}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ═══ DONE: Success ═══ */}
      <Modal
        isOpen={step === 'done'}
        onClose={() => {}}
        title="Registration Successful"
        size="sm"
        showCloseButton={false}
        closeOnOverlayClick={false}
      >
        <div className="text-center py-4">
          <div className="flex justify-center mb-4">
            <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
              <CheckCircle2 size={48} className="text-green-500" />
            </div>
          </div>
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-2">Welcome to {bizName}!</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-4">Your account has been created successfully. You can now login with your email and password.</p>
          <Button onClick={handleDoneLogin} className="w-full py-3">
            <Check size={18} className="mr-2" /> Go to Login
          </Button>
        </div>
      </Modal>
    </>
  );
};

export default RegisterModal;
