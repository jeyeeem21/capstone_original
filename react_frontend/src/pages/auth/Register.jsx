import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  UserPlus, User, Building2, Phone, Mail, MapPin, Lock, Eye, EyeOff,
  ArrowLeft, ArrowRight, Check, AlertCircle, Loader2, ShieldCheck,
  FileText, ScrollText, Send, CheckCircle2, XCircle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useBusinessSettings } from '../../context/BusinessSettingsContext';
import { useTheme } from '../../context/ThemeContext';
import { authApi, websiteContentApi } from '../../api';
import { debouncedSearchAddress } from '../../api/openRouteService';
import { DEFAULT_LOGO } from '../../api/config';

// ─── Steps ────────────────────────────────────────────────────────────────────
// 1  details    – fill in the registration form (no password)
// 2  terms      – read & accept terms/privacy
// 3  verify     – enter the 6-digit email code
// 4  account    – set password (after email verified)
// 5  done       – success screen (auto-redirect)

const PHONE_REGEX = /^(\+63\d{10}|09\d{9})$/;

const Register = () => {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();
  const { settings } = useBusinessSettings();
  const { theme } = useTheme();

  // ── redirect if already logged in ─────────────────────────────────────────
  useEffect(() => {
    if (isAuthenticated) navigate('/customer/dashboard', { replace: true });
  }, [isAuthenticated, navigate]);

  // ── step state ─────────────────────────────────────────────────────────────
  const [step, setStep] = useState('details'); // details | terms | verify | account | done

  // ── form data ──────────────────────────────────────────────────────────────
  const [form, setForm] = useState({
    business_name:   '',
    contact_person:  '',
    phone:           '',
    email:           '',
    address:         '',
    address_landmark: '',
    password:        '',
    password_confirmation: '',
  });
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [emailTaken, setEmailTaken] = useState(false);
  const emailDebounce = useRef(null);
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [showAddressSuggestions, setShowAddressSuggestions] = useState(false);

  // ── terms ──────────────────────────────────────────────────────────────────
  const [legalContent, setLegalContent] = useState(null);
  const [loadingLegal, setLoadingLegal] = useState(false);
  const [legalTab, setLegalTab] = useState('terms');

  // ── verification ───────────────────────────────────────────────────────────
  const [sendingCode, setSendingCode] = useState(false);
  const [verifyCode, setVerifyCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState('');
  const [resendCountdown, setResendCountdown] = useState(0);
  const countdownRef = useRef(null);

  // ── submitting final step ─────────────────────────────────────────────────
  const [completing, setCompleting] = useState(false);
  const [globalError, setGlobalError] = useState('');

  // ── countdown timer for resend ────────────────────────────────────────────
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

  // ── email uniqueness check (debounced) ────────────────────────────────────
  const handleEmailChange = (e) => {
    const val = e.target.value;
    setForm(prev => ({ ...prev, email: val }));
    setErrors(prev => ({ ...prev, email: undefined }));
    setEmailTaken(false);
    clearTimeout(emailDebounce.current);
    if (!val || !/\S+@\S+\.\S+/.test(val)) return;
    setCheckingEmail(true);
    emailDebounce.current = setTimeout(async () => {
      try {
        const res = await authApi.checkEmail(val.trim());
        if (res.taken) {
          setEmailTaken(true);
          setErrors(prev => ({ ...prev, email: ['This email is already registered.'] }));
        }
      } catch {/* ignore */}
      finally { setCheckingEmail(false); }
    }, 600);
  };

  // ── generic field change ──────────────────────────────────────────────────
  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'email') { handleEmailChange(e); return; }
    setForm(prev => ({ ...prev, [name]: value }));
    setErrors(prev => ({ ...prev, [name]: undefined }));
  };

  // ── account step state ─────────────────────────────────────────────────────
  const [accountSubmitted, setAccountSubmitted] = useState(false);
  const [accountErrors, setAccountErrors] = useState({});

  // ── client-side validation for step 1 ─────────────────────────────────────
  const validateDetails = () => {
    const errs = {};
    if (!form.business_name.trim())   errs.business_name   = ['Business name is required.'];
    if (!form.contact_person.trim())  errs.contact_person  = ['Contact person is required.'];
    if (!form.phone.trim())           errs.phone           = ['Phone number is required.'];
    else if (!PHONE_REGEX.test(form.phone.trim()))
      errs.phone = ['Format: +63XXXXXXXXXX or 09XXXXXXXXX'];
    if (!form.email.trim())           errs.email           = ['Email is required.'];
    else if (!/\S+@\S+\.\S+/.test(form.email))
      errs.email = ['Enter a valid email address.'];
    else if (emailTaken)              errs.email           = ['This email is already registered.'];
    if (!form.address.trim())         errs.address         = ['Address is required.'];
    return errs;
  };

  // ── STEP 1 → STEP 2 (show terms) ─────────────────────────────────────────
  const handleDetailsNext = () => {
    setSubmitted(true);
    const errs = validateDetails();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    // Load legal content if not yet loaded
    if (!legalContent) {
      setLoadingLegal(true);
      websiteContentApi.getLegalContent()
        .then(res => { if (res.success && res.data) setLegalContent(res.data); })
        .catch(() => {})
        .finally(() => setLoadingLegal(false));
    }
    setLegalTab('terms');
    setStep('terms');
  };

  // ── Decline terms → back to details ───────────────────────────────────────
  const handleDeclineTerms = () => {
    // If we have an email pending (shouldn't be at this stage), cancel it
    setStep('details');
  };

  // ── Accept terms → send verification code ─────────────────────────────────
  const handleAcceptTerms = async () => {
    setSendingCode(true);
    setGlobalError('');
    try {
      const res = await authApi.registerSendVerification({
        business_name:         form.business_name.trim(),
        contact_person:        form.contact_person.trim(),
        phone:                 form.phone.trim(),
        email:                 form.email.trim().toLowerCase(),
        address:               form.address.trim(),
        address_landmark:      form.address_landmark?.trim() || '',
      });
      if (!res.success) {
        if (res.errors) setErrors(res.errors);
        setGlobalError(res.error || res.message || 'Failed to send verification code.');
        setStep('details');
        return;
      }
      setVerifyCode('');
      setVerifyError('');
      startCountdown(60);
      setStep('verify');
    } catch (err) {
      setGlobalError(err.message || 'Failed to send verification code.');
      setStep('details');
    } finally {
      setSendingCode(false);
    }
  };

  // ── Verify code → move to password step ────────────────────────────────────
  const handleVerify = async (code) => {
    if (code.length < 6) return;
    setVerifying(true);
    setVerifyError('');
    try {
      const res = await authApi.registerVerifyCode(form.email.trim().toLowerCase(), code);
      if (!res.success) {
        setVerifyError(res.error || 'Invalid verification code.');
        return;
      }
      // Email verified — move to password step
      setForm(prev => ({ ...prev, password: '', password_confirmation: '' }));
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

  // ── Set password & complete registration ───────────────────────────────────
  const handleAccountSubmit = async () => {
    setAccountSubmitted(true);
    const errs = {};
    if (!form.password) errs.password = ['Password is required.'];
    else if (form.password.length < 8) errs.password = ['Minimum 8 characters.'];
    if (!form.password_confirmation) errs.password_confirmation = ['Please confirm your password.'];
    else if (form.password !== form.password_confirmation) errs.password_confirmation = ['Passwords do not match.'];
    if (Object.keys(errs).length) { setAccountErrors(errs); return; }

    setCompleting(true);
    setGlobalError('');
    try {
      const res = await authApi.registerComplete(
        form.email.trim().toLowerCase(),
        form.password,
        form.password_confirmation,
      );
      if (!res.success) {
        if (res.errors) setAccountErrors(res.errors);
        setGlobalError(res.error || res.message || 'Registration failed. Please try again.');
        return;
      }
      setStep('done');
      setTimeout(() => navigate('/customer/dashboard', { replace: true }), 3000);
    } catch (err) {
      setGlobalError(err.message || 'Registration failed.');
    } finally {
      setCompleting(false);
    }
  };

  // ── Resend code ────────────────────────────────────────────────────────────
  const handleResend = async () => {
    if (resendCountdown > 0) return;
    setSendingCode(true);
    setVerifyError('');
    try {
      const res = await authApi.registerSendVerification({
        business_name:         form.business_name.trim(),
        contact_person:        form.contact_person.trim(),
        phone:                 form.phone.trim(),
        email:                 form.email.trim().toLowerCase(),
        address:               form.address.trim(),
        address_landmark:      form.address_landmark?.trim() || '',
      });
      if (res.success) startCountdown(60);
      else setVerifyError(res.error || 'Failed to resend code.');
    } catch {
      setVerifyError('Failed to resend code.');
    } finally {
      setSendingCode(false);
    }
  };

  // ── Cancel verification → back to details (audit log server-side) ─────────
  const handleCancelVerification = async () => {
    try {
      await authApi.registerCancel(form.email.trim().toLowerCase());
    } catch {/* silent */}
    setVerifyCode('');
    setVerifyError('');
    setStep('details');
  };

  // ── helpers ────────────────────────────────────────────────────────────────
  const fieldError = (name) => errors[name]?.[0] || accountErrors[name]?.[0];
  const inputClass = (name) => {
    const hasErr = !!fieldError(name);
    return [
      'w-full px-4 py-3 pl-10 text-sm border-2 rounded-xl transition-all shadow-sm',
      'focus:outline-none focus:ring-4',
      hasErr
        ? 'border-red-400 bg-red-50 dark:bg-red-900/20 focus:border-red-500 focus:ring-red-500/20'
        : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:border-gray-400 focus:border-button-500 focus:ring-button-500/20',
    ].join(' ');
  };

  const logoSrc = settings?.business_logo && !settings.business_logo.startsWith('blob:')
    ? settings.business_logo
    : DEFAULT_LOGO;
  const bizName = settings?.business_name || 'KJP Ricemill';

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: `linear-gradient(135deg, ${theme.bg_secondary || 'var(--color-bg-secondary)'} 0%, ${theme.bg_primary || '#ffffff'} 50%, ${theme.bg_secondary || 'var(--color-bg-secondary)'} 100%)` }}
    >
      {/* Decorative blobs */}
      <div className="absolute inset-0 opacity-5 pointer-events-none">
        <div className="absolute top-20 left-20 w-72 h-72 rounded-full blur-3xl" style={{ backgroundColor: theme.button_primary }} />
        <div className="absolute bottom-20 right-20 w-96 h-96 rounded-full blur-3xl" style={{ backgroundColor: theme.border_color }} />
      </div>

      <div className="relative w-full max-w-lg">
        {/* ── DONE ─────────────────────────────────────────────────────────── */}
        {step === 'done' && (
          <div className="rounded-2xl shadow-xl border-2 p-8 text-center" style={{ backgroundColor: theme.bg_primary, borderColor: theme.button_primary }}>
            <div className="flex justify-center mb-4">
              <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                <CheckCircle2 size={48} className="text-green-500" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">Registration Successful!</h1>
            <p className="text-gray-500 dark:text-gray-400 mb-1">Welcome to {bizName}.</p>
            <p className="text-sm text-gray-400 dark:text-gray-500">Redirecting you to your dashboard…</p>
            <div className="mt-6 flex justify-center">
              <Loader2 size={24} className="animate-spin text-button-500" />
            </div>
          </div>
        )}

        {/* ── VERIFY ───────────────────────────────────────────────────────── */}
        {step === 'verify' && (
          <div className="rounded-2xl shadow-xl border-2 p-8" style={{ backgroundColor: theme.bg_primary, borderColor: theme.border_color + '40' }}>
            {/* Logo */}
            <div className="flex justify-center mb-5">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg overflow-hidden" style={{ background: `linear-gradient(135deg, ${theme.button_primary}, ${theme.button_primary}cc)` }}>
                <img src={logoSrc} alt={bizName} className="w-12 h-12 object-contain"
                  onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
                <span className="hidden text-white font-bold text-lg">{bizName.substring(0, 3)}</span>
              </div>
            </div>
            <div className="text-center mb-6">
              <h1 className="text-xl font-bold" style={{ color: theme.text_primary }}>Verify Your Email</h1>
              <p className="text-sm mt-1" style={{ color: theme.text_secondary }}>
                We sent a 6-digit code to{' '}
                <span className="font-semibold" style={{ color: theme.text_primary }}>{form.email}</span>
              </p>
            </div>

            <div className="space-y-4">
              {/* Code input */}
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
                    disabled={verifying || completing}
                    className={[
                      'w-full px-4 py-4 text-center text-2xl tracking-[0.5em] font-mono border-2 rounded-xl transition-all',
                      'focus:outline-none focus:ring-4',
                      verifyError
                        ? 'border-red-400 bg-red-50 focus:border-red-500 focus:ring-red-500/20'
                        : 'border-primary-300 focus:border-button-500 focus:ring-button-500/20',
                    ].join(' ')}
                    autoFocus
                  />
                  {(verifying || completing) && (
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

              {/* Resend */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Didn't receive it?</span>
                <button
                  onClick={handleResend}
                  disabled={resendCountdown > 0 || sendingCode}
                  className="font-medium text-button-600 dark:text-button-400 hover:underline disabled:opacity-50 disabled:no-underline flex items-center gap-1"
                >
                  {sendingCode ? <><Loader2 size={14} className="animate-spin" /> Sending…</> :
                   resendCountdown > 0 ? `Resend in ${resendCountdown}s` : 'Resend Code'}
                </button>
              </div>

              {/* Navigation */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleCancelVerification}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
                >
                  <XCircle size={16} /> Cancel
                </button>
                <button
                  onClick={() => handleVerify(verifyCode)}
                  disabled={verifyCode.length < 6 || verifying || completing}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-button-500 hover:bg-button-600 text-white rounded-xl transition-colors font-medium disabled:opacity-50"
                >
                  {(verifying || completing) ? <><Loader2 size={16} className="animate-spin" /> Verifying…</> : <><Check size={16} /> Verify & Continue</>}
                </button>
              </div>
            </div>

            <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-4">
              Code expires in 15 minutes. Check your spam folder if you don't see it.
            </p>
          </div>
        )}

        {/* ── ACCOUNT (set password after verification) ────────────────────── */}
        {step === 'account' && (
          <div className="rounded-2xl shadow-xl border-2 p-8" style={{ backgroundColor: theme.bg_primary, borderColor: theme.border_color + '40' }}>
            <div className="flex justify-center mb-5">
              <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: '#dcfce7' }}>
                <Lock size={32} className="text-green-600" />
              </div>
            </div>
            <div className="text-center mb-6">
              <h1 className="text-xl font-bold" style={{ color: theme.text_primary }}>Almost Done!</h1>
              <p className="text-sm mt-1" style={{ color: theme.text_secondary }}>
                Your email has been verified. Set a password for your account.
              </p>
            </div>

            {globalError && (
              <div className="mb-4 p-3 bg-red-50 border-2 border-red-200 text-red-600 text-sm rounded-xl flex items-center gap-2">
                <AlertCircle size={16} className="flex-shrink-0" />
                {globalError}
              </div>
            )}

            <div className="space-y-4">
              {/* Password */}
              <div>
                <label className="flex items-center gap-1 text-sm font-semibold mb-1.5" style={{ color: theme.text_primary }}>
                  <Lock size={14} /> Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input name="password" type={showPassword ? 'text' : 'password'} value={form.password}
                    onChange={handleChange} placeholder="Minimum 8 characters"
                    className={`${inputClass('password')} pr-12`} autoFocus />
                  <button type="button" onClick={() => setShowPassword(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {(accountErrors.password || fieldError('password')) && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11} />{accountErrors.password?.[0] || fieldError('password')}</p>}
              </div>

              {/* Confirm Password */}
              <div>
                <label className="flex items-center gap-1 text-sm font-semibold mb-1.5" style={{ color: theme.text_primary }}>
                  <Lock size={14} /> Confirm Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input name="password_confirmation" type={showConfirm ? 'text' : 'password'} value={form.password_confirmation}
                    onChange={handleChange} placeholder="Re-enter password"
                    className={`${inputClass('password_confirmation')} pr-12`} />
                  <button type="button" onClick={() => setShowConfirm(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                    {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {(accountErrors.password_confirmation || fieldError('password_confirmation')) && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11} />{accountErrors.password_confirmation?.[0] || fieldError('password_confirmation')}</p>}
              </div>

              <button
                onClick={handleAccountSubmit}
                disabled={completing}
                className="w-full flex items-center justify-center gap-2 py-3 mt-2 text-white font-semibold rounded-xl transition-all disabled:opacity-50"
                style={{ backgroundColor: theme.button_primary, boxShadow: `0 4px 16px ${theme.button_primary}40` }}
              >
                {completing
                  ? <><Loader2 size={16} className="animate-spin" /> Creating Account…</>
                  : <><CheckCircle2 size={16} /> Create Account</>}
              </button>
            </div>
          </div>
        )}

        {/* ── TERMS ────────────────────────────────────────────────────────── */}
        {step === 'terms' && (
          <div className="rounded-2xl shadow-xl border-2 p-8" style={{ backgroundColor: theme.bg_primary, borderColor: theme.border_color + '40' }}>
            <div className="flex justify-center mb-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: theme.button_primary + '18' }}>
                <ScrollText size={28} style={{ color: theme.button_primary }} />
              </div>
            </div>
            <div className="text-center mb-5">
              <h1 className="text-xl font-bold" style={{ color: theme.text_primary }}>Terms &amp; Privacy Policy</h1>
              <p className="text-sm mt-1" style={{ color: theme.text_secondary }}>
                Please read and accept before creating your account.
              </p>
            </div>

            {/* Tabs */}
            <div className="flex rounded-xl p-1 gap-1 mb-4" style={{ backgroundColor: theme.bg_secondary }}>
              {[
                { key: 'terms',   label: 'Terms & Conditions', icon: <FileText size={14} /> },
                { key: 'privacy', label: 'Privacy Policy',     icon: <ShieldCheck size={14} /> },
              ].map(({ key, label, icon }) => (
                <button
                  key={key}
                  onClick={() => setLegalTab(key)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all"
                  style={legalTab === key
                    ? { backgroundColor: theme.button_primary, color: '#fff', boxShadow: `0 2px 8px ${theme.button_primary}40` }
                    : { color: theme.text_secondary }
                  }
                >
                  {icon} {label}
                </button>
              ))}
            </div>

            {/* Content */}
            {loadingLegal ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={24} className="animate-spin" style={{ color: theme.button_primary }} />
              </div>
            ) : (
              <div className="max-h-72 overflow-y-auto p-4 rounded-xl border text-sm space-y-3"
                style={{ backgroundColor: theme.bg_secondary, borderColor: theme.border_color + '40', color: theme.text_secondary }}
              >
                {legalTab === 'terms' && (
                  <>
                    <h3 className="font-bold" style={{ color: theme.text_primary }}>{bizName} — Terms and Conditions</h3>
                    {legalContent?.termsLastUpdated && (
                      <p className="text-xs" style={{ color: theme.text_secondary }}>Last updated: {legalContent.termsLastUpdated}</p>
                    )}
                    {legalContent?.termsIntro && <p>{legalContent.termsIntro}</p>}
                    {(legalContent?.termsSections || []).map((s, i) => (
                      <div key={i}>
                        <h4 className="font-semibold" style={{ color: theme.text_primary }}>{i + 1}. {s.title}</h4>
                        <p>{s.content}</p>
                      </div>
                    ))}
                    {(!legalContent?.termsSections?.length) && (
                      <p className="text-center py-4" style={{ color: theme.text_secondary }}>No terms configured yet.</p>
                    )}
                  </>
                )}
                {legalTab === 'privacy' && (
                  <>
                    <h3 className="font-bold" style={{ color: theme.text_primary }}>{bizName} — Privacy Policy</h3>
                    {legalContent?.privacyLastUpdated && (
                      <p className="text-xs" style={{ color: theme.text_secondary }}>Last updated: {legalContent.privacyLastUpdated}</p>
                    )}
                    {legalContent?.privacyIntro && <p>{legalContent.privacyIntro}</p>}
                    {(legalContent?.privacySections || []).map((s, i) => (
                      <div key={i}>
                        <h4 className="font-semibold" style={{ color: theme.text_primary }}>{i + 1}. {s.title}</h4>
                        <p>{s.content}</p>
                      </div>
                    ))}
                    {(!legalContent?.privacySections?.length) && (
                      <p className="text-center py-4" style={{ color: theme.text_secondary }}>No privacy policy configured yet.</p>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Buttons */}
            <div className="flex gap-3 mt-5">
              <button
                onClick={handleDeclineTerms}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border-2 rounded-xl transition-colors font-medium"
                style={{ borderColor: theme.border_color + '60', color: theme.text_secondary }}
              >
                <ArrowLeft size={16} /> Back
              </button>
              <button
                onClick={handleAcceptTerms}
                disabled={sendingCode || loadingLegal}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-white rounded-xl transition-colors font-medium disabled:opacity-50"
                style={{ backgroundColor: theme.button_primary }}
              >
                {sendingCode
                  ? <><Loader2 size={16} className="animate-spin" /> Sending code…</>
                  : <><Check size={16} /> I Accept & Continue</>}
              </button>
            </div>
          </div>
        )}

        {/* ── DETAILS ──────────────────────────────────────────────────────── */}
        {step === 'details' && (
          <div className="rounded-2xl shadow-xl border-2 p-8" style={{ backgroundColor: theme.bg_primary, borderColor: theme.border_color + '40' }}>
            {/* Header */}
            <div className="flex justify-center mb-5">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg overflow-hidden" style={{ background: `linear-gradient(135deg, ${theme.button_primary}, ${theme.button_primary}cc)`, boxShadow: `0 8px 24px ${theme.button_primary}40` }}>
                <img src={logoSrc} alt={bizName} className="w-12 h-12 object-contain"
                  onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
                <span className="hidden text-white font-bold text-lg">{bizName.substring(0, 3)}</span>
              </div>
            </div>
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold" style={{ color: theme.text_primary }}>{bizName}</h1>
              <p className="text-sm mt-1" style={{ color: theme.text_secondary }}>Create your customer account</p>
            </div>

            {globalError && (
              <div className="mb-4 p-3 bg-red-50 border-2 border-red-200 text-red-600 text-sm rounded-xl flex items-center gap-2">
                <AlertCircle size={16} className="flex-shrink-0" />
                {globalError}
              </div>
            )}

            <div className="space-y-4">
              {/* Business Name */}
              <div>
                <label className="flex items-center gap-1 text-sm font-semibold mb-1.5" style={{ color: theme.text_primary }}>
                  <Building2 size={14} /> Business Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Building2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input name="business_name" value={form.business_name} onChange={handleChange}
                    placeholder="e.g. Juan's Rice Trading" className={inputClass('business_name')} />
                </div>
                {fieldError('business_name') && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11} />{fieldError('business_name')}</p>}
              </div>

              {/* Contact Person */}
              <div>
                <label className="flex items-center gap-1 text-sm font-semibold mb-1.5" style={{ color: theme.text_primary }}>
                  <User size={14} /> Contact Person <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input name="contact_person" value={form.contact_person} onChange={handleChange}
                    placeholder="Full name of contact person" className={inputClass('contact_person')} />
                </div>
                {fieldError('contact_person') && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11} />{fieldError('contact_person')}</p>}
              </div>

              {/* Phone & Email */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="flex items-center gap-1 text-sm font-semibold mb-1.5" style={{ color: theme.text_primary }}>
                    <Phone size={14} /> Phone <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input name="phone" value={form.phone} onChange={handleChange}
                      placeholder="+63 or 09..." className={inputClass('phone')} />
                  </div>
                  {fieldError('phone') && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11} />{fieldError('phone')}</p>}
                </div>
                <div>
                  <label className="flex items-center gap-1 text-sm font-semibold mb-1.5" style={{ color: theme.text_primary }}>
                    <Mail size={14} /> Email <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input name="email" type="email" value={form.email} onChange={handleChange}
                      placeholder="email@example.com" className={inputClass('email')} />
                    {checkingEmail && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <Loader2 size={14} className="animate-spin text-gray-400" />
                      </div>
                    )}
                    {!checkingEmail && form.email && !fieldError('email') && /\S+@\S+\.\S+/.test(form.email) && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <Check size={14} className="text-green-500" />
                      </div>
                    )}
                  </div>
                  {fieldError('email') && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11} />{fieldError('email')}</p>}
                </div>
              </div>

              {/* Address with Autocomplete */}
              <div>
                <label className="flex items-center gap-1 text-sm font-semibold mb-1.5" style={{ color: theme.text_primary }}>
                  <MapPin size={14} /> Address <span className="text-red-500">*</span>
                  <span className="ml-auto text-xs font-normal text-blue-500">🇵🇭 Philippines only</span>
                </label>
                <div className="relative">
                  <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 z-10" />
                  <input name="address" value={form.address} onChange={(e) => {
                    handleChange(e);
                    const val = e.target.value;
                    if (val.length >= 3) {
                      debouncedSearchAddress(val, (results) => {
                        setAddressSuggestions(results);
                        setShowAddressSuggestions(results.length > 0);
                      });
                    } else {
                      setAddressSuggestions([]);
                      setShowAddressSuggestions(false);
                    }
                  }}
                    onFocus={() => { if (addressSuggestions.length > 0) setShowAddressSuggestions(true); }}
                    placeholder="e.g. Brgy. San Jose, Roxas City, Capiz"
                    autoComplete="off"
                    className={inputClass('address')} />
                  {showAddressSuggestions && addressSuggestions.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-600 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                      {addressSuggestions.map((s, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => {
                            setForm(prev => ({ ...prev, address: s.label }));
                            setShowAddressSuggestions(false);
                            setAddressSuggestions([]);
                          }}
                          className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-0 transition-colors flex items-start gap-2"
                        >
                          <MapPin size={14} className="text-gray-400 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-medium text-gray-800 dark:text-gray-100 leading-tight block">{s.label}</span>
                            {s.locality && (
                              <span className="text-xs text-gray-400">
                                {s.locality}{s.region ? `, ${s.region}` : ''}
                              </span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <p className="mt-1 text-xs text-gray-400">Philippine addresses only. Select from suggestions for accurate delivery computation.</p>
                {fieldError('address') && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11} />{fieldError('address')}</p>}
              </div>

              {/* Landmark / Directions */}
              <div>
                <label className="flex items-center gap-1 text-sm font-semibold mb-1.5" style={{ color: theme.text_primary }}>
                  <MapPin size={14} /> House/Block No. &amp; Landmark <span className="ml-1 text-xs font-normal text-gray-400">(Optional)</span>
                </label>
                <input
                  name="address_landmark"
                  value={form.address_landmark}
                  onChange={handleChange}
                  placeholder="e.g. Blk 4, tapat ng yellow house, looban ng Heron St."
                  autoComplete="off"
                  className={inputClass('address_landmark')}
                />
                <p className="mt-1 text-xs text-gray-400">Helps the driver find your exact location.</p>
              </div>

              {/* Next */}
              <button
                onClick={handleDetailsNext}
                disabled={checkingEmail || emailTaken}
                className="w-full flex items-center justify-center gap-2 py-3 mt-2 text-white font-semibold rounded-xl transition-all disabled:opacity-50"
                style={{ backgroundColor: theme.button_primary, boxShadow: `0 4px 16px ${theme.button_primary}40` }}
              >
                <ArrowRight size={18} /> Next: Review Terms
              </button>
            </div>

            {/* Links */}
            <div className="mt-5 text-center space-y-2">
              <p className="text-sm" style={{ color: theme.text_secondary }}>
                Already have an account?{' '}
                <Link to="/?login=true" className="font-semibold hover:underline" style={{ color: theme.button_primary }}>
                  Sign in
                </Link>
              </p>
              <Link to="/" className="block text-sm transition-colors" style={{ color: theme.text_secondary }}>
                ← Back to website
              </Link>
            </div>
          </div>
        )}

        {/* Footer */}
        {step !== 'done' && (
          <p className="text-center text-xs text-gray-400 mt-4">
            &copy; {new Date().getFullYear()} {bizName}. All rights reserved.
          </p>
        )}
      </div>
    </div>
  );
};

export default Register;
