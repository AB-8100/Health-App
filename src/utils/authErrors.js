// Supabase's auth.signUp() doesn't throw for an email that's already
// registered — by design, to avoid leaking which emails exist. Instead it
// resolves in one of two shapes depending on the project's email-confirmation
// setting:
//   - Confirmation required: a success-shaped response with `data.user` set,
//     no `data.session`, and `data.user.identities` as an EMPTY array (a
//     genuinely new signup has at least one identity here).
//   - Confirmation disabled: a real `error` with a message like
//     "User already registered".
// This helper detects both so the caller can surface a clear message instead
// of silently treating it like a normal signup.
export function isDuplicateSignupResponse({ data, error } = {}) {
  if (error) {
    return /already registered|already exists/i.test(error.message || '');
  }
  const identities = data?.user?.identities;
  return !!data?.user && !data?.session && Array.isArray(identities) && identities.length === 0;
}
