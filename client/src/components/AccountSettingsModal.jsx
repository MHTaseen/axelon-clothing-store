import React, { useState } from 'react';
import { X, KeyRound, Mail, Lock, Eye, EyeOff, ArrowLeft } from 'lucide-react';

function passwordRules(pw = '') {
  return {
    'At least 8 characters': pw.length >= 8,
    'Uppercase letter (A-Z)': /[A-Z]/.test(pw),
    'Lowercase letter (a-z)': /[a-z]/.test(pw),
    'Number (0-9)': /[0-9]/.test(pw),
    'Symbol (e.g. ! @ # $)': /[^A-Za-z0-9]/.test(pw)
  };
}

const inputCls =
  'w-full border border-[#DBBB97] pl-9 pr-3 py-2.5 text-sm text-[#0F2557] focus:border-[#0F2557] focus:outline-none';
const labelCls = 'block text-[11px] font-bold uppercase tracking-wider text-[#0F2557] mb-1';
const btnCls =
  'w-full bg-[#0F2557] py-3 text-xs font-extrabold uppercase tracking-[0.18em] text-[#F2D5B1] hover:bg-[#060F24] transition disabled:opacity-60';

async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

export default function AccountSettingsModal({ isOpen, onClose, currentUser, onUserUpdated }) {
  const [tab, setTab] = useState('password'); // 'password' | 'email'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [showPw, setShowPw] = useState(false);

  // Change password
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');

  // Change email
  const [newEmail, setNewEmail] = useState('');
  const [emailPw, setEmailPw] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [emailStep, setEmailStep] = useState('form'); // 'form' | 'code'

  if (!isOpen || !currentUser) return null;

  const rules = passwordRules(newPw);
  const strong = Object.values(rules).every(Boolean);

  const reset = () => {
    setError('');
    setInfo('');
  };

  const close = () => {
    reset();
    setCurrentPw('');
    setNewPw('');
    setConfirmPw('');
    setNewEmail('');
    setEmailPw('');
    setEmailCode('');
    setEmailStep('form');
    onClose();
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    reset();
    if (!strong) return setError('Your new password does not meet all the rules below.');
    if (newPw !== confirmPw) return setError('The two new passwords do not match.');
    setLoading(true);
    try {
      const { ok, data } = await postJson('/api/auth/change-password', { currentPassword: currentPw, newPassword: newPw });
      if (!ok) return setError(data.error || 'Could not change password.');
      setInfo(data.message || 'Password changed.');
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
      if (data.user) onUserUpdated(data.user);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestEmailCode = async (e) => {
    e.preventDefault();
    reset();
    setLoading(true);
    try {
      const { ok, data } = await postJson('/api/auth/change-email/request', { newEmail, currentPassword: emailPw });
      if (!ok) return setError(data.error || 'Could not start the email change.');
      setInfo(data.message);
      setEmailPw('');
      setEmailCode('');
      setEmailStep('code');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyEmailCode = async (e) => {
    e.preventDefault();
    reset();
    setLoading(true);
    try {
      const { ok, data } = await postJson('/api/auth/change-email/verify', { newEmail, code: emailCode });
      if (!ok) return setError(data.error || 'Invalid or expired code.');
      setInfo(data.message || 'Email changed.');
      setEmailStep('form');
      setNewEmail('');
      setEmailCode('');
      if (data.user) onUserUpdated(data.user);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const PwToggle = (
    <button
      type="button"
      onClick={() => setShowPw((s) => !s)}
      className="absolute right-3 top-2.5 text-navy-400 hover:text-[#0F2557]"
      aria-label={showPw ? 'Hide passwords' : 'Show passwords'}
    >
      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#060F24]/75 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md max-h-[92vh] overflow-y-auto bg-white shadow-2xl border border-[#B8844E]/60">
        <div className="flex items-center justify-between bg-[#0F2557] px-6 py-4 text-white border-b border-[#B8844E]/40">
          <div>
            <h3 className="font-serif text-2xl font-bold text-[#F2D5B1]">Account Settings</h3>
            <p className="text-[11px] text-white/75 truncate">Signed in as {currentUser.email}</p>
          </div>
          <button type="button" onClick={close} className="p-1.5 rounded-full text-white/80 hover:bg-white/10 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 bg-[#FBF6F0] p-1.5 m-5 mb-0 border border-[#DBBB97]">
          {[
            ['password', 'Change Password'],
            ['email', 'Change Email']
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setTab(key);
                reset();
              }}
              className={`py-2 text-[11px] font-bold uppercase tracking-widest transition ${
                tab === key ? 'bg-[#0F2557] text-[#F2D5B1]' : 'text-[#0F2557] hover:bg-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="p-5 sm:p-6 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 p-3 text-xs font-semibold text-red-700">{error}</div>}
          {info && <div className="bg-emerald-50 border border-emerald-200 p-3 text-xs font-semibold text-emerald-800">{info}</div>}

          {tab === 'password' && (
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className={labelCls}>Current Password *</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-navy-400" />
                  <input
                    type={showPw ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={currentPw}
                    onChange={(e) => setCurrentPw(e.target.value)}
                    className={inputCls}
                  />
                  {PwToggle}
                </div>
              </div>
              <div>
                <label className={labelCls}>New Password *</label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-2.5 h-4 w-4 text-navy-400" />
                  <input
                    type={showPw ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                    className={inputCls}
                  />
                </div>
                <ul className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-0.5 text-[11px]">
                  {Object.entries(rules).map(([label, okRule]) => (
                    <li key={label} className={okRule ? 'text-emerald-700 font-semibold' : 'text-navy-400'}>
                      {okRule ? '✓' : '•'} {label}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <label className={labelCls}>Confirm New Password *</label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-2.5 h-4 w-4 text-navy-400" />
                  <input
                    type={showPw ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    value={confirmPw}
                    onChange={(e) => setConfirmPw(e.target.value)}
                    className={inputCls}
                  />
                </div>
              </div>
              <button type="submit" disabled={loading} className={btnCls}>
                {loading ? 'Saving...' : 'Change Password'}
              </button>
              <p className="text-[11px] text-navy-500">For safety, all your other devices will be signed out.</p>
            </form>
          )}

          {tab === 'email' && emailStep === 'form' && (
            <form onSubmit={handleRequestEmailCode} className="space-y-4">
              <div>
                <label className={labelCls}>New Email Address *</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-navy-400" />
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="new@example.com"
                    className={inputCls}
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>Current Password *</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-navy-400" />
                  <input
                    type={showPw ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={emailPw}
                    onChange={(e) => setEmailPw(e.target.value)}
                    className={inputCls}
                  />
                  {PwToggle}
                </div>
              </div>
              <button type="submit" disabled={loading} className={btnCls}>
                {loading ? 'Sending Code...' : 'Send Code to New Email'}
              </button>
              <p className="text-[11px] text-navy-500">
                We'll email a 6-digit code to the new address to make sure it's really yours.
              </p>
            </form>
          )}

          {tab === 'email' && emailStep === 'code' && (
            <form onSubmit={handleVerifyEmailCode} className="space-y-4">
              <div>
                <label className={labelCls}>6-Digit Code sent to {newEmail} *</label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  maxLength={6}
                  value={emailCode}
                  onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="Enter 6-digit code"
                  className="w-full border border-[#0F2557] px-4 py-3 text-center font-mono text-xl font-bold tracking-[0.4em] text-[#0F2557] focus:outline-none"
                />
              </div>
              <button type="submit" disabled={loading} className={btnCls}>
                {loading ? 'Confirming...' : 'Confirm New Email'}
              </button>
              <button
                type="button"
                onClick={() => {
                  reset();
                  setEmailStep('form');
                }}
                className="inline-flex items-center gap-1 text-xs font-semibold text-navy-600 hover:text-[#0F2557]"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
