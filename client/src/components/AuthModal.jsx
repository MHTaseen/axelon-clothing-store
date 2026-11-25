import React, { useState } from 'react';
import {
  User,
  Mail,
  Phone,
  MapPin,
  Lock,
  X,
  Eye,
  EyeOff,
  ShieldCheck,
  CheckCircle2,
  KeyRound,
  ArrowLeft
} from 'lucide-react';

function checkPasswordRules(pw = '') {
  return {
    length: pw.length >= 8,
    lower: /[a-z]/.test(pw),
    upper: /[A-Z]/.test(pw),
    digit: /[0-9]/.test(pw),
    special: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(pw)
  };
}

export default function AuthModal({ isOpen, onClose, onAuthSuccess, noticeMessage = '' }) {
  // 'signin' | 'register' | 'verify-register' | 'forgot-email' | 'forgot-reset'
  const [step, setStep] = useState('signin');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [showPw, setShowPw] = useState(false);

  // Registration & Sign In Fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [password, setPassword] = useState('');

  // OTP Verification & Password Reset Fields
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');

  if (!isOpen) return null;

  const pwRules = checkPasswordRules(step === 'forgot-reset' ? newPassword : password);
  const isPwStrong = Object.values(pwRules).every(Boolean);

  const resetMessages = () => {
    setError('');
    setInfo('');
  };

  // Sign In with Email & Password ONLY
  const handleSignIn = async (e) => {
    e.preventDefault();
    resetMessages();
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Invalid email or password.');
        return;
      }
      if (data.needsVerification) {
        // Admin signing in from a new device: a code was emailed
        setInfo(data.message);
        setOtpCode('');
        setStep('verify-login');
        return;
      }
      onAuthSuccess(data.user);
      setPassword('');
      onClose();
    } catch {
      setError('Network error during sign in.');
    } finally {
      setLoading(false);
    }
  };

  // Admin new-device sign-in: confirm the emailed code
  const handleVerifyLogin = async (e) => {
    e.preventDefault();
    resetMessages();
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: otpCode })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Invalid or expired code.');
        return;
      }
      onAuthSuccess(data.user);
      setPassword('');
      setOtpCode('');
      setStep('signin');
      onClose();
    } catch {
      setError('Network error verifying the code.');
    } finally {
      setLoading(false);
    }
  };

  // Register Step 1: Validate fields + Email MX check + Request 6-digit OTP
  const handleRequestRegisterOtp = async (e) => {
    e.preventDefault();
    resetMessages();
    if (!isPwStrong) {
      setError('Password must be at least 8 characters with uppercase, lowercase, a digit, and a special character.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, email, phone, address, password })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not start registration.');
        return;
      }
      setInfo(data.message);
      setOtpCode('');
      setStep('verify-register');
    } catch {
      setError('Network error while verifying email.');
    } finally {
      setLoading(false);
    }
  };

  // Register Step 2: Verify 6-digit Email Code
  const handleVerifyRegisterOtp = async (e) => {
    e.preventDefault();
    resetMessages();
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: otpCode })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Invalid verification code.');
        return;
      }
      onAuthSuccess(data.user);
      setPassword('');
      setOtpCode('');
      onClose();
    } catch {
      setError('Network error verifying OTP.');
    } finally {
      setLoading(false);
    }
  };

  // Forgot Password Step 1: Send Reset OTP to Email
  const handleRequestResetOtp = async (e) => {
    e.preventDefault();
    resetMessages();
    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not find account.');
        return;
      }
      setInfo(data.message);
      setOtpCode('');
      setNewPassword('');
      setStep('forgot-reset');
    } catch {
      setError('Network error requesting password reset.');
    } finally {
      setLoading(false);
    }
  };

  // Forgot Password Step 2: Verify OTP & Update Password
  const handleConfirmResetPassword = async (e) => {
    e.preventDefault();
    resetMessages();
    if (!isPwStrong) {
      setError('New password must be at least 8 characters with uppercase, lowercase, digit, and special character.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: otpCode, newPassword })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not reset password.');
        return;
      }
      setInfo(data.message);
      setPassword('');
      setNewPassword('');
      setOtpCode('');
      setStep('signin');
    } catch {
      setError('Network error resetting password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#060F24]/75 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md max-h-[92vh] overflow-y-auto bg-white shadow-2xl border border-[#B8844E]/60">
        {/* Header */}
        <div className="flex items-center justify-between bg-[#0F2557] px-6 py-4 text-white border-b border-[#B8844E]/40">
          <div>
            <h3 className="font-serif text-2xl font-bold text-[#F2D5B1]">
              {step === 'signin' && 'Sign In'}
              {step === 'register' && 'Create Account'}
              {step === 'verify-register' && 'Verify Your Email'}
              {step === 'verify-login' && 'New Device Check'}
              {step === 'forgot-email' && 'Reset Password'}
              {step === 'forgot-reset' && 'Set New Password'}
            </h3>
            <p className="text-[11px] text-white/75">
              {step === 'signin' && 'Sign in with your verified Email & Password'}
              {step === 'register' && '1 account per unique Email & Phone Number'}
              {step === 'verify-register' && 'Enter the 6-digit code sent to your email'}
              {step === 'verify-login' && 'Enter the 6-digit sign-in code sent to your email'}
              {step === 'forgot-email' && 'Enter your registered email to receive a reset code'}
              {step === 'forgot-reset' && 'Verify your code and choose a strong new password'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-white/80 hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Sign In / Register Switcher */}
        {(step === 'signin' || step === 'register') && (
          <div className="grid grid-cols-2 bg-[#FBF6F0] p-1.5 m-5 mb-0 border border-[#DBBB97]">
            <button
              type="button"
              onClick={() => {
                setStep('signin');
                resetMessages();
              }}
              className={`py-2 text-xs font-bold uppercase tracking-widest transition ${
                step === 'signin' ? 'bg-[#0F2557] text-[#F2D5B1]' : 'text-[#0F2557] hover:bg-white'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setStep('register');
                resetMessages();
              }}
              className={`py-2 text-xs font-bold uppercase tracking-widest transition ${
                step === 'register' ? 'bg-[#0F2557] text-[#F2D5B1]' : 'text-[#0F2557] hover:bg-white'
              }`}
            >
              Register
            </button>
          </div>
        )}

        <div className="p-5 sm:p-6 space-y-4">
          {noticeMessage && (
            <div className="bg-[#FBF6F0] border border-[#B8844E] p-3 text-xs font-semibold text-[#0F2557]">
              {noticeMessage}
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 p-3 text-xs font-semibold text-red-700">
              {error}
            </div>
          )}

          {info && (
            <div className="bg-emerald-50 border border-emerald-200 p-3 text-xs font-semibold text-emerald-800 space-y-1">
              <p>{info}</p>
            </div>
          )}

          {/* STEP 1: SIGN IN (Email & Password Only) */}
          {step === 'signin' && (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#0F2557] mb-1">
                  Email Address *
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-navy-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full border border-[#DBBB97] pl-9 pr-3 py-2.5 text-sm text-[#0F2557] focus:border-[#0F2557] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#0F2557] mb-1">
                  Password *
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-navy-400" />
                  <input
                    type={showPw ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full border border-[#DBBB97] pl-9 pr-10 py-2.5 text-sm text-[#0F2557] focus:border-[#0F2557] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-2.5 text-navy-400 hover:text-[#0F2557]"
                  >
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <div className="mt-1.5 text-right">
                  <button
                    type="button"
                    onClick={() => {
                      resetMessages();
                      setStep('forgot-email');
                    }}
                    className="text-xs font-semibold text-[#9A6B3B] hover:underline"
                  >
                    Forgot Password?
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#0F2557] py-3 text-xs font-extrabold uppercase tracking-[0.18em] text-[#F2D5B1] hover:bg-[#060F24] transition"
              >
                {loading ? 'Signing In...' : 'Sign In'}
              </button>
            </form>
          )}

          {/* STEP 2: REGISTER FORM */}
          {step === 'register' && (
            <form onSubmit={handleRequestRegisterOtp} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#0F2557] mb-1">
                  Full Name *
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-4 w-4 text-navy-400" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Your full name"
                    className="w-full border border-[#DBBB97] pl-9 pr-3 py-2 text-sm text-[#0F2557] focus:border-[#0F2557] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#0F2557] mb-1">
                  Email Address * (Will Be Verified)
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-navy-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@gmail.com"
                    className="w-full border border-[#DBBB97] pl-9 pr-3 py-2 text-sm text-[#0F2557] focus:border-[#0F2557] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#0F2557] mb-1">
                  Phone Number * (Unique per Account)
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-2.5 h-4 w-4 text-navy-400" />
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="01XXXXXXXXX"
                    className="w-full border border-[#DBBB97] pl-9 pr-3 py-2 text-sm text-[#0F2557] focus:border-[#0F2557] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#0F2557] mb-1">
                  Address *
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-navy-400" />
                  <textarea
                    rows={2}
                    required
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="House, Road, Area, City"
                    className="w-full border border-[#DBBB97] pl-9 pr-3 py-2 text-sm text-[#0F2557] focus:border-[#0F2557] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#0F2557] mb-1">
                  Strong Password *
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-navy-400" />
                  <input
                    type={showPw ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min 8 chars (A-Z, a-z, 0-9, !@)...)"
                    className="w-full border border-[#DBBB97] pl-9 pr-10 py-2 text-sm text-[#0F2557] focus:border-[#0F2557] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-2.5 text-navy-400 hover:text-[#0F2557]"
                  >
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                {/* Live Password Strength Checklist */}
                <div className="mt-2 grid grid-cols-2 gap-1 text-[10px] bg-[#FBF8F4] p-2 border border-[#DBBB97]/60">
                  <span className={pwRules.length ? 'text-emerald-700 font-bold' : 'text-navy-500'}>
                    {pwRules.length ? '✓' : '•'} At least 8 characters
                  </span>
                  <span className={pwRules.upper ? 'text-emerald-700 font-bold' : 'text-navy-500'}>
                    {pwRules.upper ? '✓' : '•'} Capital letter (A-Z)
                  </span>
                  <span className={pwRules.lower ? 'text-emerald-700 font-bold' : 'text-navy-500'}>
                    {pwRules.lower ? '✓' : '•'} Small letter (a-z)
                  </span>
                  <span className={pwRules.digit ? 'text-emerald-700 font-bold' : 'text-navy-500'}>
                    {pwRules.digit ? '✓' : '•'} Number (0-9)
                  </span>
                  <span className={`col-span-2 ${pwRules.special ? 'text-emerald-700 font-bold' : 'text-navy-500'}`}>
                    {pwRules.special ? '✓' : '•'} Special character (!, @, ), #, $, %, etc.)
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#0F2557] py-3 text-xs font-extrabold uppercase tracking-[0.18em] text-[#F2D5B1] hover:bg-[#060F24] transition"
              >
                {loading ? 'Verifying Email...' : 'Verify Email & Create Account'}
              </button>
            </form>
          )}

          {/* STEP 3: VERIFY REGISTRATION EMAIL OTP */}
          {step === 'verify-register' && (
            <form onSubmit={handleVerifyRegisterOtp} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#0F2557] mb-1">
                  6-Digit Email Verification Code *
                </label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  placeholder="Enter 6-digit code"
                  className="w-full border border-[#0F2557] px-4 py-3 text-center font-mono text-xl font-bold tracking-[0.4em] text-[#0F2557] focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#0F2557] py-3 text-xs font-extrabold uppercase tracking-[0.18em] text-[#F2D5B1] hover:bg-[#060F24] transition"
              >
                {loading ? 'Completing Registration...' : 'Confirm Code & Finish'}
              </button>
              <button
                type="button"
                onClick={() => {
                  resetMessages();
                  setStep('register');
                }}
                className="inline-flex items-center gap-1 text-xs font-semibold text-navy-600 hover:text-[#0F2557]"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back to Registration Form
              </button>
            </form>
          )}

          {/* ADMIN NEW-DEVICE SIGN-IN CODE */}
          {step === 'verify-login' && (
            <form onSubmit={handleVerifyLogin} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#0F2557] mb-1">
                  6-Digit Sign-In Code *
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="Enter 6-digit code"
                  className="w-full border border-[#0F2557] px-4 py-3 text-center font-mono text-xl font-bold tracking-[0.4em] text-[#0F2557] focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#0F2557] py-3 text-xs font-extrabold uppercase tracking-[0.18em] text-[#F2D5B1] hover:bg-[#060F24] transition"
              >
                {loading ? 'Checking Code...' : 'Verify & Sign In'}
              </button>
              <button
                type="button"
                onClick={() => {
                  resetMessages();
                  setStep('signin');
                }}
                className="inline-flex items-center gap-1 text-xs font-semibold text-navy-600 hover:text-[#0F2557]"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back to Sign In
              </button>
            </form>
          )}

          {/* STEP 4: FORGOT PASSWORD — ENTER EMAIL */}
          {step === 'forgot-email' && (
            <form onSubmit={handleRequestResetOtp} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#0F2557] mb-1">
                  Registered Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your account email"
                  className="w-full border border-[#DBBB97] px-3 py-2.5 text-sm text-[#0F2557] focus:border-[#0F2557] focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#0F2557] py-3 text-xs font-extrabold uppercase tracking-[0.18em] text-[#F2D5B1] hover:bg-[#060F24] transition"
              >
                {loading ? 'Sending Reset Code...' : 'Send Password Reset Code'}
              </button>
              <button
                type="button"
                onClick={() => {
                  resetMessages();
                  setStep('signin');
                }}
                className="inline-flex items-center gap-1 text-xs font-semibold text-navy-600 hover:text-[#0F2557]"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back to Sign In
              </button>
            </form>
          )}

          {/* STEP 5: FORGOT PASSWORD — VERIFY OTP & SET NEW PASSWORD */}
          {step === 'forgot-reset' && (
            <form onSubmit={handleConfirmResetPassword} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#0F2557] mb-1">
                  6-Digit Reset Code *
                </label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  placeholder="Enter 6-digit code"
                  className="w-full border border-[#DBBB97] px-3 py-2.5 text-center font-mono text-lg font-bold tracking-[0.3em] text-[#0F2557]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#0F2557] mb-1">
                  New Strong Password *
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-2.5 h-4 w-4 text-navy-400" />
                  <input
                    type={showPw ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 8 chars (A-Z, a-z, 0-9, !@)...)"
                    className="w-full border border-[#DBBB97] pl-9 pr-10 py-2.5 text-sm text-[#0F2557]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-2.5 text-navy-400"
                  >
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-1 text-[10px] bg-[#FBF8F4] p-2 border border-[#DBBB97]/60">
                  <span className={pwRules.length ? 'text-emerald-700 font-bold' : 'text-navy-500'}>
                    {pwRules.length ? '✓' : '•'} 8+ chars
                  </span>
                  <span className={pwRules.upper ? 'text-emerald-700 font-bold' : 'text-navy-500'}>
                    {pwRules.upper ? '✓' : '•'} Capital (A-Z)
                  </span>
                  <span className={pwRules.lower ? 'text-emerald-700 font-bold' : 'text-navy-500'}>
                    {pwRules.lower ? '✓' : '•'} Small (a-z)
                  </span>
                  <span className={pwRules.digit ? 'text-emerald-700 font-bold' : 'text-navy-500'}>
                    {pwRules.digit ? '✓' : '•'} Digit (0-9)
                  </span>
                  <span className={`col-span-2 ${pwRules.special ? 'text-emerald-700 font-bold' : 'text-navy-500'}`}>
                    {pwRules.special ? '✓' : '•'} Special char (!, @, ), etc.)
                  </span>
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#0F2557] py-3 text-xs font-extrabold uppercase tracking-[0.18em] text-[#F2D5B1] hover:bg-[#060F24] transition"
              >
                {loading ? 'Updating Password...' : 'Change Password'}
              </button>
            </form>
          )}

          <div className="flex items-center justify-center gap-1.5 text-[10px] text-navy-500 pt-2 border-t border-navy-100">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
            <span>Protected by verified email codes, Bcrypt password hashing & encrypted storage</span>
          </div>
        </div>
      </div>
    </div>
  );
}
