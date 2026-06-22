import React from 'react';
import themes from '../data/themes';
import { supabase } from '../utils/supabase';

export function LoginScreen({ width = 390, height = 820, theme = 'light', onLogin, onSignUp }) {
  const t = themes[theme];
  const [mode, setMode] = React.useState('login');
  const [form, setForm] = React.useState({ name: '', email: '', password: '', confirm: '' });
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [googleLoading, setGoogleLoading] = React.useState(false);

  const update = (patch) => { setForm(f => ({ ...f, ...patch })); setError(''); };

  const handleSubmit = async () => {
    if (loading) return;
    setLoading(true);
    setError('');
    try {
      if (mode === 'signup') {
        if (!form.name.trim()) { setError('Please enter your name.'); return; }
        if (!form.email.includes('@')) { setError('Please enter a valid email.'); return; }
        if (form.password.length < 6) { setError('Password must be at least 6 characters.'); return; }
        if (form.password !== form.confirm) { setError('Passwords do not match.'); return; }
        await onSignUp(form.name.trim(), form.email.toLowerCase().trim(), form.password);
      } else {
        if (!form.email.trim()) { setError('Please enter your email.'); return; }
        if (!form.password) { setError('Please enter your password.'); return; }
        await onLogin(form.email.toLowerCase().trim(), form.password);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (m) => { setMode(m); setError(''); setForm({ name: '', email: '', password: '', confirm: '' }); };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    setError('');
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin + window.location.pathname },
      });
      if (error) throw error;
    } catch (e) {
      setError(e.message);
      setGoogleLoading(false);
    }
  };

  return (
    <div style={{
      width, height, background: t.bg, fontFamily: t.sans, color: t.text,
      display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative',
    }}>
      {/* Ambient glows */}
      <div style={{
        position: 'absolute', top: -80, right: -60, width: 280, height: 280, borderRadius: '50%',
        background: `radial-gradient(circle, ${t.accent}28, transparent 65%)`, pointerEvents: 'none',
      }}/>
      <div style={{
        position: 'absolute', bottom: -100, left: -80, width: 300, height: 300, borderRadius: '50%',
        background: `radial-gradient(circle, ${theme === 'dark' ? '#6D4AAF' : '#6D4AAF'}18, transparent 65%)`,
        pointerEvents: 'none',
      }}/>

      {/* Status bar */}
      <div style={{
        height: 44, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        padding: '0 22px 8px', fontSize: 14, fontWeight: 600, position: 'relative',
      }}>
        <span>9:41</span>
        <div style={{ display: 'flex', gap: 5, alignItems: 'center', fontSize: 11 }}>
          <span>●●●</span><span>📶</span><span>🔋</span>
        </div>
      </div>

      {/* Logo area */}
      <div style={{ padding: '28px 24px 20px', textAlign: 'center' }}>
        <div style={{
          width: 64, height: 64, borderRadius: 18,
          background: `linear-gradient(135deg, ${t.accent}, #6D4AAF)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: t.serif, fontSize: 34, color: '#fff',
          margin: '0 auto 14px',
          boxShadow: `0 14px 40px ${t.accent}30`,
        }}>F</div>
        <div style={{ fontFamily: t.serif, fontSize: 34, color: t.text, letterSpacing: '-0.02em' }}>
          <span style={{ color: t.accent }}>Forma</span>
        </div>
        <div style={{ fontSize: 12.5, color: t.text2, marginTop: 5, lineHeight: 1.4 }}>
          Your personal health tracker
        </div>
      </div>

      {/* Mode toggle */}
      <div style={{
        margin: '0 24px 18px', display: 'flex',
        background: t.surface, borderRadius: 12, padding: 3,
        border: `1px solid ${t.border}`,
      }}>
        {[['login', 'Sign in'], ['signup', 'Create account']].map(([m, label]) => (
          <button key={m} onClick={() => switchMode(m)} style={{
            flex: 1, padding: '9px 6px', borderRadius: 10,
            background: mode === m ? t.bg : 'transparent',
            border: mode === m ? `1px solid ${t.border}` : '1px solid transparent',
            color: mode === m ? t.text : t.text2,
            fontFamily: t.sans, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
            boxShadow: mode === m ? '0 1px 4px rgba(0,0,0,0.07)' : 'none',
            transition: 'all .15s',
          }}>
            {label}
          </button>
        ))}
      </div>

      {/* Form */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 24px' }} className="phone-scroll">
        {mode === 'signup' && (
          <FormField label="Your name">
            <input
              value={form.name}
              onChange={e => update({ name: e.target.value })}
              placeholder="e.g. Alex"
              autoComplete="name"
              style={inputStyle(t)}
            />
          </FormField>
        )}

        <FormField label="Email">
          <input
            value={form.email}
            onChange={e => update({ email: e.target.value })}
            placeholder="you@example.com"
            type="email"
            autoComplete="email"
            style={inputStyle(t)}
          />
        </FormField>

        <FormField label="Password">
          <input
            value={form.password}
            onChange={e => update({ password: e.target.value })}
            placeholder={mode === 'signup' ? 'At least 6 characters' : 'Your password'}
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            style={inputStyle(t)}
            onKeyDown={e => { if (e.key === 'Enter' && mode === 'login') handleSubmit(); }}
          />
        </FormField>

        {mode === 'signup' && (
          <FormField label="Confirm password">
            <input
              value={form.confirm}
              onChange={e => update({ confirm: e.target.value })}
              placeholder="Repeat your password"
              type="password"
              autoComplete="new-password"
              style={inputStyle(t)}
              onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
            />
          </FormField>
        )}

        {error && (
          <div style={{
            padding: '11px 14px', borderRadius: 10, marginBottom: 14,
            background: '#EF444418', border: '1px solid #EF444438', color: '#DC2626',
            fontSize: 12.5, lineHeight: 1.4,
          }}>
            {error}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{
            width: '100%', padding: '14px', borderRadius: 13, marginTop: 4,
            background: loading ? t.surface2 : t.accent,
            color: loading ? t.text3 : t.accentText,
            border: 'none', fontFamily: t.sans, fontSize: 14, fontWeight: 600,
            cursor: loading ? 'default' : 'pointer',
          }}
        >
          {loading ? 'Please wait…' : mode === 'login' ? 'Sign in →' : 'Create account →'}
        </button>

        {mode === 'login' && (
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <span style={{ fontSize: 12, color: t.text3 }}>Don't have an account? </span>
            <button onClick={() => switchMode('signup')} style={{
              background: 'none', border: 'none', color: t.accent,
              fontFamily: t.sans, fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0,
            }}>Sign up</button>
          </div>
        )}

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '20px 0 0' }}>
          <div style={{ flex: 1, height: 1, background: t.border }} />
          <span style={{ fontSize: 11, color: t.text3 }}>or</span>
          <div style={{ flex: 1, height: 1, background: t.border }} />
        </div>

        {/* Google sign-in */}
        <button
          onClick={handleGoogle}
          disabled={googleLoading || loading}
          style={{
            width: '100%', padding: '13px', borderRadius: 13, marginTop: 12,
            background: t.surface, border: `1px solid ${t.border}`,
            fontFamily: t.sans, fontSize: 13.5, fontWeight: 600, color: t.text,
            cursor: (googleLoading || loading) ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            opacity: (googleLoading || loading) ? 0.6 : 1,
          }}
        >
          <GoogleIcon />
          {googleLoading ? 'Redirecting…' : 'Continue with Google'}
        </button>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908C16.658 14.12 17.64 11.84 17.64 9.2z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
      <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 6.293C4.672 4.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}

function FormField({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{
        fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase',
        color: '#A8A39C', fontWeight: 500, marginBottom: 6,
      }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function inputStyle(t) {
  return {
    width: '100%', padding: '12px 14px', borderRadius: 11,
    border: `1px solid ${t.border2 || t.border}`, background: t.surface,
    fontFamily: t.sans, fontSize: 14, color: t.text, outline: 'none',
    boxSizing: 'border-box',
  };
}
