import { API, buildApp, registerUser, type App } from '../helpers';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

describe('Auth', () => {
  let app: App;

  beforeAll(async () => {
    app = await buildApp();
  });

  it('registers a user and returns a token', async () => {
    const { response } = await registerUser(app);

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.token).toEqual(expect.any(String));
    expect(response.body.data.user).toMatchObject({ name: 'Test User' });
    // The hash must never travel back to the client.
    expect(response.body.data.user).not.toHaveProperty('password');
  });

  it('rejects a duplicate email', async () => {
    const { payload } = await registerUser(app);

    const response = await request(app).post(`${API}/auth/register`).send(payload);

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('EMAIL_ALREADY_REGISTERED');
  });

  it('rejects a weak password with field-level messages', async () => {
    const response = await request(app)
      .post(`${API}/auth/register`)
      .send({ name: 'Weak', email: 'weak@toolbeam.dev', password: 'short' });

    expect(response.status).toBe(422);
    expect(response.body.errors).toHaveProperty('password');
  });

  it('logs in with valid credentials', async () => {
    const { payload } = await registerUser(app);

    const response = await request(app)
      .post(`${API}/auth/login`)
      .send({ email: payload.email, password: payload.password });

    expect(response.status).toBe(200);
    expect(response.body.data.token).toEqual(expect.any(String));
  });

  it('gives the same answer for a wrong password and an unknown account', async () => {
    const { payload } = await registerUser(app);

    const wrongPassword = await request(app)
      .post(`${API}/auth/login`)
      .send({ email: payload.email, password: 'Wrongpass123' });

    const unknownAccount = await request(app)
      .post(`${API}/auth/login`)
      .send({ email: 'nobody@toolbeam.dev', password: 'Wrongpass123' });

    // Identical responses — otherwise login becomes an account-enumeration oracle.
    expect(wrongPassword.status).toBe(401);
    expect(unknownAccount.status).toBe(401);
    expect(wrongPassword.body.error.message).toBe(unknownAccount.body.error.message);
  });

  it('returns the current user for a valid token', async () => {
    const { token, payload } = await registerUser(app);

    const response = await request(app)
      .get(`${API}/auth/me`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.email).toBe(payload.email);
  });

  it('rejects a missing or malformed token', async () => {
    const missing = await request(app).get(`${API}/auth/me`);
    const malformed = await request(app)
      .get(`${API}/auth/me`)
      .set('Authorization', 'Bearer not-a-real-token');

    expect(missing.status).toBe(401);
    expect(missing.body.error.code).toBe('NO_TOKEN_PROVIDED');
    expect(malformed.status).toBe(401);
    expect(malformed.body.error.code).toBe('INVALID_EXPIRED_TOKEN');
  });
});
