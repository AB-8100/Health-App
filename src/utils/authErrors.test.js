import { describe, it, expect } from 'vitest';
import { isDuplicateSignupResponse } from './authErrors';

describe('isDuplicateSignupResponse', () => {
  it('flags a signUp error whose message says the user is already registered', () => {
    expect(isDuplicateSignupResponse({ error: { message: 'User already registered' } })).toBe(true);
  });

  it('flags a signUp error phrased as "account already exists"', () => {
    expect(isDuplicateSignupResponse({ error: { message: 'An account already exists for this email' } })).toBe(true);
  });

  it('does not flag an unrelated signUp error', () => {
    expect(isDuplicateSignupResponse({ error: { message: 'Password should be at least 6 characters' } })).toBe(false);
  });

  // Regression case: with email confirmation enabled, Supabase deliberately
  // doesn't throw for a duplicate email — it resolves with a success shape
  // where `identities` is empty, so a genuinely new signup must NOT match.
  it('flags a success-shaped response for an already-registered email (empty identities, no session)', () => {
    const response = { data: { user: { id: 'u1', identities: [] }, session: null }, error: null };
    expect(isDuplicateSignupResponse(response)).toBe(true);
  });

  it('does not flag a genuinely new signup (has an identity, no session yet)', () => {
    const response = { data: { user: { id: 'u1', identities: [{ id: 'i1' }] }, session: null }, error: null };
    expect(isDuplicateSignupResponse(response)).toBe(false);
  });

  it('does not flag a genuinely new signup when confirmation is disabled (session returned immediately)', () => {
    const response = { data: { user: { id: 'u1', identities: [{ id: 'i1' }] }, session: { access_token: 'x' } }, error: null };
    expect(isDuplicateSignupResponse(response)).toBe(false);
  });

  it('handles a missing/empty argument without throwing', () => {
    expect(isDuplicateSignupResponse()).toBe(false);
    expect(isDuplicateSignupResponse({})).toBe(false);
  });
});
