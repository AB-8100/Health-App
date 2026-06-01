import React from 'react';
function AuthScreen({ theme = 'light', onAuthSuccess }) {
  const accent = '#BE5A38';
  const bg     = theme === 'dark' ? '#111114' : '#F5F2ED';
  const card   = theme === 'dark' ? '#1C1C22' : '#FFFFFF';
  const text   = theme === 'dark' ? '#F0EDE8' : '#1C1917';
  const text2  = theme === 'dark' ? '#9A9398' : '#6B6560';

  const [status, setStatus] = React.useState('idle'); // idle | signing-in | loading-data | error
  const [error,  setError]  = React.useState('');
  const btnRef = React.useRef(null);

  // Render the official Google button once GIS has loaded
  React.useEffect(() => {
    if (!btnRef.current) return;
    const tryRender = () => {
      if (typeof google === 'undefined' || !google.accounts) {
        setTimeout(tryRender, 300);
        return;
      }
      if (GOOGLE_CLIENT_ID === 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com') return;
      google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredentialResponse,
        auto_select: false,
      });
      google.accounts.id.renderButton(btnRef.current, {
        theme: theme === 'dark' ? 'filled_black' : 'outline',
        size: 'large',
        width: 280,
        text: 'continue_with',
        logo_alignment: 'left',
      });
    };
    tryRender();
  }, [theme]);

  // Called by GIS with an ID token after the user picks their Google account
  const handleCredentialResponse = async (response) => {
    setStatus('signing-in');
    setError('');
    try {
      // Decode ID token to get identity (name, email, picture, sub)
      const payload = decodeJwtPayload(response.credential);
      const identity = {
        id:      payload.sub,
        email:   payload.email,
        name:    payload.name,
        picture: payload.picture,
      };
      setCachedIdentity(identity);

      // Now request an access token for Drive (may show consent screen on first use)
      setStatus('loading-data');
      const accessToken = await requestAccessToken();

      // Load existing Forma data from Drive (or null if first login)
      const driveData = await driveRead(accessToken);

      onAuthSuccess({ identity, accessToken, driveData });
    } catch (err) {
      console.error('Auth error', err);
      setError('Sign-in failed. Please try again.');
      setStatus('error');
    }
  };

  // Manual "Continue with Google" button — triggers the token client directly
  // (fallback if One Tap was dismissed or GIS button didn't render)
  const handleManualSignIn = async () => {
    setStatus('signing-in');
    setError('');
    try {
      const accessToken = await requestAccessToken();
      const identity = getCachedIdentity() || { id: 'unknown', email: '', name: 'User', picture: null };
      const driveData = await driveRead(accessToken);
      onAuthSuccess({ identity, accessToken, driveData });
    } catch (err) {
      setError('Sign-in failed. Make sure pop-ups are allowed for this page.');
      setStatus('error');
    }
  };

  const isLoading = status === 'signing-in' || status === 'loading-data';

  return (
    <div style={{
      width: '100%', height: '100%', background: bg,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '0 28px', boxSizing: 'border-box',
    }}>
      {/* Wordmark */}
      <div style={{ textAlign: 'center', marginBottom: 48 }}>
        <div style={{
          fontFamily: 'DM Serif Display, serif',
          fontSize: 52, color: accent, letterSpacing: '-0.02em', lineHeight: 1,
        }}>Forma</div>
        <div style={{
          fontSize: 12, color: text2, marginTop: 8,
          letterSpacing: '.12em', textTransform: 'uppercase',
        }}>
          Personal Health Tracker
        </div>
      </div>

      {/* Card */}
      <div style={{
        width: '100%', background: card, borderRadius: 24,
        padding: '32px 24px', boxSizing: 'border-box', textAlign: 'center',
        boxShadow: theme === 'dark'
          ? '0 8px 40px rgba(0,0,0,.5)'
          : '0 4px 32px rgba(0,0,0,.08)',
      }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: text, marginBottom: 6 }}>
          Welcome back
        </div>
        <div style={{ fontSize: 13, color: text2, marginBottom: 28, lineHeight: 1.5 }}>
          Sign in with your Google account to access your health data — stored privately in your own Google Drive.
        </div>

        {/* GIS renders its own button here */}
        {!isLoading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
            <div ref={btnRef} />

            {/* Fallback manual button */}
            <button onClick={handleManualSignIn} style={{
              padding: '11px 24px', borderRadius: 10,
              background: 'transparent',
              border: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,.15)' : 'rgba(0,0,0,.12)'}`,
              color: text2, fontSize: 13, cursor: 'pointer',
              fontFamily: 'DM Sans, sans-serif',
            }}>
              Continue with Google ↗
            </button>
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 28, height: 28, border: `2.5px solid ${accent}`,
              borderTopColor: 'transparent', borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <div style={{ fontSize: 13, color: text2 }}>
              {status === 'signing-in' ? 'Connecting to Google…' : 'Loading your data…'}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{
            marginTop: 16, padding: '10px 14px', borderRadius: 10,
            background: 'rgba(190,58,46,.1)', border: '1px solid rgba(190,58,46,.2)',
            color: '#BE3B2E', fontSize: 13, lineHeight: 1.4,
          }}>
            {error}
          </div>
        )}
      </div>

      {/* Config warning */}
      {GOOGLE_CLIENT_ID === 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com' && (
        <div style={{
          marginTop: 20, padding: '12px 16px', borderRadius: 12,
          background: 'rgba(190,90,56,.12)', border: '1px solid rgba(190,90,56,.25)',
          color: accent, fontSize: 12, lineHeight: 1.5, textAlign: 'center',
        }}>
          ⚠️ Replace <code>GOOGLE_CLIENT_ID</code> in index.html with your OAuth Client ID to enable sign-in.
        </div>
      )}

      {/* Privacy note */}
      <div style={{
        marginTop: 20, fontSize: 11, color: text2,
        textAlign: 'center', lineHeight: 1.6, maxWidth: 280,
      }}>
        Your data is saved to a private folder in your own Google Drive. Forma cannot see other files in your Drive.
      </div>
    </div>
  );
}


export { AuthScreen };
