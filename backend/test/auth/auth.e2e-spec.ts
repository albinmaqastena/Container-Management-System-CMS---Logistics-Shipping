// test/auth/auth.e2e-spec.ts
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { getApp, getAuthToken } from '../setup';

describe('Auth E2E', () => {
  let app: INestApplication;
  let adminToken: string;
  let userToken: string;
  let superAdminToken: string;
  let refreshToken: string;

  beforeAll(async () => {
    app = getApp();
    superAdminToken = await getAuthToken('admin@example.com', 'Admin@123');

    adminToken = await getAuthToken('superadmin@example.com', 'Password@123');

    userToken = await getAuthToken('testuser@example.com', 'Password@123');
  });

  // ================================================================
  // REGISTER
  // ================================================================
  describe('POST /v1/auth/register', () => {
    it('should register a new user (admin only)', async () => {
      const uniqueEmail = `e2euser_${Date.now()}@example.com`;
      const response = await request(app.getHttpServer())
        .post('/v1/auth/register')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          username: `e2euser_${Date.now()}`,
          email: uniqueEmail,
          password: 'Password@123',
          role: 'user',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.email).toBe(uniqueEmail);
      expect(response.body.role).toBe('user');
      expect(response.body).not.toHaveProperty('password');
      expect(response.body).not.toHaveProperty('resetPasswordToken');
      expect(response.body).not.toHaveProperty('resetPasswordExpires');
    });

    it('should allow an admin to register a normal user', async () => {
      const suffix = Date.now();
      const response = await request(app.getHttpServer())
        .post('/v1/auth/register')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          username: `admin_created_${suffix}`,
          email: `admin_created_${suffix}@example.com`,
          password: 'Password@123',
          role: 'user',
        })
        .expect(201);

      expect(response.body.role).toBe('user');
    });

    it('should reject an admin creating a super admin', async () => {
      const suffix = Date.now();
      await request(app.getHttpServer())
        .post('/v1/auth/register')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          username: `forbidden_super_${suffix}`,
          email: `forbidden_super_${suffix}@example.com`,
          password: 'Password@123',
          role: 'super_admin',
        })
        .expect(401);
    });

    it('should allow super admin to create admin', async () => {
      const uniqueEmail = `e2eadmin_${Date.now()}@example.com`;
      const response = await request(app.getHttpServer())
        .post('/v1/auth/register')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          username: `e2eadmin_${Date.now()}`,
          email: uniqueEmail,
          password: 'Password@123',
          role: 'admin',
        })
        .expect(201);

      expect(response.body.role).toBe('admin');
    });

    it('should fail without token', async () => {
      await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({
          username: 'unauthorized',
          email: 'unauth@example.com',
          password: 'Password@123',
          role: 'user',
        })
        .expect(401);
    });

    it('should fail with user token (not admin)', async () => {
      await request(app.getHttpServer())
        .post('/v1/auth/register')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          username: 'userregister',
          email: 'userregister@example.com',
          password: 'Password@123',
          role: 'user',
        })
        .expect(403);
    });

    it('should fail with duplicate email', async () => {
      await request(app.getHttpServer())
        .post('/v1/auth/register')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          username: 'duplicate',
          email: 'admin@example.com',
          password: 'Password@123',
          role: 'user',
        })
        .expect(409);
    });

    it('should fail with duplicate username', async () => {
      await request(app.getHttpServer())
        .post('/v1/auth/register')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          username: 'admin',
          email: 'unique@example.com',
          password: 'Password@123',
          role: 'user',
        })
        .expect(409);
    });

    it('should fail with invalid email', async () => {
      await request(app.getHttpServer())
        .post('/v1/auth/register')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          username: 'invalidemail',
          email: 'invalid-email',
          password: 'Password@123',
          role: 'user',
        })
        .expect(400);
    });

    it('should fail with short password', async () => {
      await request(app.getHttpServer())
        .post('/v1/auth/register')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          username: 'shortpass',
          email: 'short@example.com',
          password: '123',
          role: 'user',
        })
        .expect(400);
    });
  });

  // ================================================================
  // LOGIN
  // ================================================================
  describe('POST /v1/auth/login', () => {
    it('should login with valid credentials (super admin)', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email: 'admin@example.com', password: 'Admin@123' })
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body.user).toHaveProperty('email', 'admin@example.com');
      expect(response.body.user.role).toBe('super_admin');
      expect(response.body.user).not.toHaveProperty('password');
      expect(response.body.user).not.toHaveProperty('resetPasswordToken');
      expect(response.body.user).not.toHaveProperty('resetPasswordExpires');
      refreshToken = response.body.refreshToken;
    });

    it('should normalize email before login', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({
          email: '  ADMIN@EXAMPLE.COM  ',
          password: 'Admin@123',
        })
        .expect(200);

      expect(response.body.user.email).toBe('admin@example.com');
    });

    it('should login with valid credentials (user)', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email: 'testuser@example.com', password: 'Password@123' })
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body.user).toHaveProperty('email', 'testuser@example.com');
      expect(response.body.user.role).toBe('user');
    });

    it('should fail with invalid password', async () => {
      await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email: 'admin@example.com', password: 'wrongpassword' })
        .expect(401)
        .expect((res) => {
          expect(res.body.message).toBe('Invalid credentials or account unavailable');
        });
    });

    it('should fail with non-existent email without revealing account existence', async () => {
      await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email: 'nonexistent@example.com', password: 'Password@123' })
        .expect(401)
        .expect((res) => {
          expect(res.body.message).toBe('Invalid credentials or account unavailable');
        });
    });

    it('should fail with missing email', async () => {
      await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ password: 'password123' })
        .expect(400);
    });

    it('should fail with missing password', async () => {
      await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email: 'admin@example.com' })
        .expect(400);
    });

    const rateLimitIt = process.env.E2E_RATE_LIMIT === 'true' ? it : it.skip;

    rateLimitIt(
      'should lock account after 5 failed attempts',
      async () => {
        const email = `ratelimit_${Date.now()}@example.com`;
        const password = 'Password@123';

        await request(app.getHttpServer())
          .post('/v1/auth/register')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            username: `ratelimit_${Date.now()}`,
            email,
            password,
            role: 'user',
          })
          .expect(201);

        for (let i = 0; i < 5; i++) {
          await request(app.getHttpServer())
            .post('/v1/auth/login')
            .send({ email, password: 'WrongPassword@123' })
            .expect(401);
        }

        // The 6th attempt should also be 401 (account locked)
        await request(app.getHttpServer())
          .post('/v1/auth/login')
          .send({
            email,
            password: 'WrongPassword@123',
          })
          .expect(401)
          .expect((res) => {
            expect(res.body.message).toBe('Invalid credentials or account unavailable');
          });
      },
      15000,
    );
  });

  // ================================================================
  // REFRESH TOKEN
  // ================================================================
  describe('POST /v1/auth/refresh', () => {
    it('should refresh access token', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');

      expect(response.body.refreshToken).not.toBe(refreshToken);

      refreshToken = response.body.refreshToken;
    });

    it('should reject reuse of a rotated refresh token', async () => {
      const loginResponse = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({
          email: 'admin@example.com',
          password: 'Admin@123',
        })
        .expect(200);

      const oldRefreshToken = loginResponse.body.refreshToken;

      const firstRefresh = await request(app.getHttpServer())
        .post('/v1/auth/refresh')
        .send({
          refreshToken: oldRefreshToken,
        })
        .expect(200);

      // Verify that the new refresh token is different from the old one
      expect(firstRefresh.body.refreshToken).not.toBe(oldRefreshToken);

      // Second attempt with same token should fail
      await request(app.getHttpServer())
        .post('/v1/auth/refresh')
        .send({
          refreshToken: oldRefreshToken,
        })
        .expect(401);
    });

    it('should fail with invalid refresh token', async () => {
      await request(app.getHttpServer())
        .post('/v1/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(400);
    });

    it('should fail with missing refresh token', async () => {
      await request(app.getHttpServer())
        .post('/v1/auth/refresh')
        .send({})
        .expect((res) => {
          expect(res.status).toBe(400);
        });
    });
  });

  // ================================================================
  // GET SESSIONS
  // ================================================================
  describe('GET /v1/auth/sessions', () => {
    it('should get active sessions (SessionDto[])', async () => {
      const token = await getAuthToken('admin@example.com', 'Admin@123');
      const response = await request(app.getHttpServer())
        .get('/v1/auth/sessions')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toHaveProperty('sessions');
      expect(Array.isArray(response.body.sessions)).toBe(true);
      expect(response.body.sessions.length).toBeGreaterThan(0);

      const currentSession = response.body.sessions.find(
        (session: { isCurrent: boolean }) => session.isCurrent,
      );

      expect(currentSession).toBeDefined();
      expect(currentSession).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          userId: expect.any(String),
          createdAt: expect.any(String),
          expiresAt: expect.any(String),
          isActive: true,
          isCurrent: true,
        }),
      );
    });

    it('should fail without token', async () => {
      await request(app.getHttpServer()).get('/v1/auth/sessions').expect(401);
    });

    it('should reject an invalid session UUID', async () => {
      await request(app.getHttpServer())
        .delete('/v1/auth/sessions/not-a-uuid')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('should revoke a session and verify it is removed', async () => {
      // Create two sessions by logging in twice
      const token1 = await getAuthToken('admin@example.com', 'Admin@123');

      const sessionsResponse = await request(app.getHttpServer())
        .get('/v1/auth/sessions')
        .set('Authorization', `Bearer ${token1}`)
        .expect(200);

      expect(sessionsResponse.body.sessions.length).toBeGreaterThan(0);

      // Find a session that is NOT the current one (if exists)
      let sessionToRevoke = sessionsResponse.body.sessions.find(
        (s: { isCurrent: boolean }) => !s.isCurrent,
      );

      // If all sessions are current, we can't test without a second login.
      // We'll log in again to create a second session.
      if (!sessionToRevoke) {
        const token2 = await getAuthToken('admin@example.com', 'Admin@123');

        const sessionsAfterSecond = await request(app.getHttpServer())
          .get('/v1/auth/sessions')
          .set('Authorization', `Bearer ${token2}`)
          .expect(200);

        sessionToRevoke =
          sessionsAfterSecond.body.sessions.find((s: { isCurrent: boolean }) => !s.isCurrent) ||
          sessionsAfterSecond.body.sessions[0];
      }

      expect(sessionToRevoke).toBeDefined();
      const sessionId = sessionToRevoke.id;

      // Revoke the session
      await request(app.getHttpServer())
        .delete(`/v1/auth/sessions/${sessionId}`)
        .set('Authorization', `Bearer ${token1}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.message).toBe('Session revoked successfully');
        });

      // Verify it's no longer in the list
      const afterRevoke = await request(app.getHttpServer())
        .get('/v1/auth/sessions')
        .set('Authorization', `Bearer ${token1}`)
        .expect(200);

      expect(afterRevoke.body.sessions.some((s: { id: string }) => s.id === sessionId)).toBe(false);
    });
  });

  // ================================================================
  // GET PROFILE (ME)
  // ================================================================
  describe('GET /v1/auth/me', () => {
    it('should get current user profile', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/auth/me')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('email', 'admin@example.com');
      expect(response.body).toHaveProperty('role', 'super_admin');
      expect(response.body).not.toHaveProperty('password');
      expect(response.body).not.toHaveProperty('resetPasswordToken');
      expect(response.body).not.toHaveProperty('resetPasswordExpires');
    });

    it('should fail without token', async () => {
      await request(app.getHttpServer()).get('/v1/auth/me').expect(401);
    });
  });

  // ================================================================
  // CHANGE PASSWORD
  // ================================================================
  describe('POST /v1/auth/change-password', () => {
    let testUserToken: string;
    let testUserEmail: string;
    let currentPassword = 'Password@123';

    beforeAll(async () => {
      const uniqueEmail = `changepw_${Date.now()}@example.com`;
      await request(app.getHttpServer())
        .post('/v1/auth/register')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          username: `changepw_${Date.now()}`,
          email: uniqueEmail,
          password: currentPassword,
          role: 'user',
        })
        .expect(201);

      testUserEmail = uniqueEmail;
      testUserToken = await getAuthToken(testUserEmail, currentPassword);
    });

    it('should reject using the current password as the new password', async () => {
      await request(app.getHttpServer())
        .post('/v1/auth/change-password')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({
          currentPassword,
          newPassword: currentPassword,
        })
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toBe('New password must be different from the current password');
        });
    });

    it('should change password successfully', async () => {
      const newPassword = 'NewPassword456!';
      await request(app.getHttpServer())
        .post('/v1/auth/change-password')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({
          currentPassword,
          newPassword,
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.message).toBe('Password changed successfully');
        });

      // Update state
      currentPassword = newPassword;
      testUserToken = await getAuthToken(testUserEmail, currentPassword);
    });

    it('should revoke previous refresh tokens after password change', async () => {
      const suffix = Date.now();
      const email = `password_revoke_${suffix}@example.com`;
      const oldPassword = 'Password@123';
      const newPassword = 'NewPassword456!';

      await request(app.getHttpServer())
        .post('/v1/auth/register')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          username: `password_revoke_${suffix}`,
          email,
          password: oldPassword,
          role: 'user',
        })
        .expect(201);

      const loginResponse = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({
          email,
          password: oldPassword,
        })
        .expect(200);

      await request(app.getHttpServer())
        .post('/v1/auth/change-password')
        .set('Authorization', `Bearer ${loginResponse.body.accessToken}`)
        .send({
          currentPassword: oldPassword,
          newPassword,
        })
        .expect(200);

      await request(app.getHttpServer())
        .post('/v1/auth/refresh')
        .send({
          refreshToken: loginResponse.body.refreshToken,
        })
        .expect(401);
    });

    it('should fail with incorrect current password', async () => {
      await request(app.getHttpServer())
        .post('/v1/auth/change-password')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({
          currentPassword: 'wrongpassword',
          newPassword: 'NewPassword456!',
        })
        .expect(401);
    });

    it('should fail with short new password', async () => {
      await request(app.getHttpServer())
        .post('/v1/auth/change-password')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({
          currentPassword,
          newPassword: '123',
        })
        .expect(400);
    });

    it('should fail without token', async () => {
      await request(app.getHttpServer())
        .post('/v1/auth/change-password')
        .send({
          currentPassword,
          newPassword: 'NewPassword456!',
        })
        .expect(401);
    });
  });

  // ================================================================
  // FORGOT & RESET PASSWORD
  // ================================================================
  describe('POST /v1/auth/forgot-password', () => {
    it('should send reset link (success message)', async () => {
      await request(app.getHttpServer())
        .post('/v1/auth/forgot-password')
        .send({ email: 'admin@example.com' })
        .expect((res) => {
          expect(res.status).toBe(200);
          expect(res.body.message).toContain('If this email exists');
        });
    });

    it('should return same message for non-existent email', async () => {
      await request(app.getHttpServer())
        .post('/v1/auth/forgot-password')
        .send({ email: 'nonexistent@example.com' })
        .expect((res) => {
          expect(res.status).toBe(200);
          expect(res.body.message).toContain('If this email exists');
        });
    });

    it('should fail with invalid email', async () => {
      await request(app.getHttpServer())
        .post('/v1/auth/forgot-password')
        .send({ email: 'invalid-email' })
        .expect(400);
    });
  });

  describe('POST /v1/auth/reset-password', () => {
    it('should fail with invalid token', async () => {
      await request(app.getHttpServer())
        .post('/v1/auth/reset-password')
        .send({
          token: 'invalid-token',
          newPassword: 'NewPassword456!',
        })
        .expect(401);
    });

    it('should fail with short password', async () => {
      await request(app.getHttpServer())
        .post('/v1/auth/reset-password')
        .send({
          token: 'some-token',
          newPassword: '123',
        })
        .expect(400);
    });
  });

  // ================================================================
  // GET /v1/auth/users/:id
  // ================================================================
  describe('GET /v1/auth/users/:id', () => {
    let createdUserId: string;
    const uniqueEmail = `getuser_${Date.now()}@example.com`;

    beforeAll(async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/auth/register')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          username: `getuser_${Date.now()}`,
          email: uniqueEmail,
          password: 'Password@123',
          role: 'user',
        })
        .expect(201);
      createdUserId = response.body.id;
    });

    it('should get an existing user', async () => {
      const response = await request(app.getHttpServer())
        .get(`/v1/auth/users/${createdUserId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.id).toBe(createdUserId);
      expect(response.body.email).toBe(uniqueEmail);
      expect(response.body).not.toHaveProperty('password');
      expect(response.body).not.toHaveProperty('resetPasswordToken');
    });

    it('should return 404 for non-existent user', async () => {
      await request(app.getHttpServer())
        .get('/v1/auth/users/00000000-0000-4000-8000-000000000000')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(404);
    });

    it('should return 400 for invalid UUID', async () => {
      await request(app.getHttpServer())
        .get('/v1/auth/users/not-a-uuid')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(400);
    });

    it('should fail for non-super-admin', async () => {
      await request(app.getHttpServer())
        .get(`/v1/auth/users/${createdUserId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });
  });

  // ================================================================
  // DELETED USER LOOKUP
  // ================================================================
  describe('GET /v1/auth/users/:id with deleted users', () => {
    let deletedUserId: string;
    const uniqueEmail = `deleted_lookup_${Date.now()}@example.com`;

    beforeAll(async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/auth/register')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          username: `deleted_lookup_${Date.now()}`,
          email: uniqueEmail,
          password: 'Password@123',
          role: 'user',
        })
        .expect(201);
      deletedUserId = response.body.id;

      // Soft delete the user
      await request(app.getHttpServer())
        .delete(`/v1/auth/users/${deletedUserId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(204);
    });

    it('should include deleted user when includeDeleted=true', async () => {
      const response = await request(app.getHttpServer())
        .get(`/v1/auth/users/${deletedUserId}?includeDeleted=true`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.id).toBe(deletedUserId);
      expect(response.body.deletedAt).not.toBeNull();
    });

    it('should return 404 for deleted user when includeDeleted=false (default)', async () => {
      await request(app.getHttpServer())
        .get(`/v1/auth/users/${deletedUserId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(404);
    });
  });

  // ================================================================
  // REVOKE SESSION
  // ================================================================
  describe('DELETE /v1/auth/sessions/:sessionId', () => {
    it('should revoke a session', async () => {
      const token = await getAuthToken('admin@example.com', 'Admin@123');

      const sessionsResponse = await request(app.getHttpServer())
        .get('/v1/auth/sessions')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(sessionsResponse.body.sessions)).toBe(true);
      expect(sessionsResponse.body.sessions.length).toBeGreaterThan(0);

      // Find the current session for this token
      const currentSession = sessionsResponse.body.sessions.find(
        (session: { isCurrent: boolean }) => session.isCurrent,
      );
      expect(currentSession).toBeDefined();

      const sessionId = currentSession.id;

      await request(app.getHttpServer())
        .delete(`/v1/auth/sessions/${sessionId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.message).toBe('Session revoked successfully');
        });
    });

    it('should fail to revoke non-existent session', async () => {
      await request(app.getHttpServer())
        .delete('/v1/auth/sessions/00000000-0000-4000-8000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });

  // ================================================================
  // USER MANAGEMENT (Super Admin only)
  // ================================================================
  describe('User Management', () => {
    let deleteUserId: string;

    beforeAll(async () => {
      const uniqueEmail = `deleteme_${Date.now()}@example.com`;
      const response = await request(app.getHttpServer())
        .post('/v1/auth/register')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          username: `deleteme_${Date.now()}`,
          email: uniqueEmail,
          password: 'Password@123',
          role: 'user',
        })
        .expect(201);
      deleteUserId = response.body.id;
    });

    describe('GET /v1/auth/users/deleted', () => {
      it('should return deleted users (super admin)', async () => {
        await request(app.getHttpServer())
          .delete(`/v1/auth/users/${deleteUserId}`)
          .set('Authorization', `Bearer ${superAdminToken}`)
          .expect(204);

        const deletedUserResponse = await request(app.getHttpServer())
          .get(`/v1/auth/users/${deleteUserId}?includeDeleted=true`)
          .set('Authorization', `Bearer ${superAdminToken}`)
          .expect(200);
        expect(deletedUserResponse.body.deletedAt).not.toBeNull();

        const response = await request(app.getHttpServer())
          .get('/v1/auth/users/deleted?limit=100&sort=deletedAt:DESC')
          .set('Authorization', `Bearer ${superAdminToken}`)
          .expect(200);

        expect(Array.isArray(response.body.data)).toBe(true);
        expect(response.body).toEqual(
          expect.objectContaining({
            total: expect.any(Number),
            limit: 100,
            offset: 0,
            totalPages: expect.any(Number),
            currentPage: 1,
            hasMore: expect.any(Boolean),
          }),
        );

        const found = response.body.data.some((user: { id: string }) => user.id === deleteUserId);
        expect(found).toBe(true);
      });

      it('should fail for non-super-admin', async () => {
        await request(app.getHttpServer())
          .get('/v1/auth/users/deleted')
          .set('Authorization', `Bearer ${userToken}`)
          .expect(403);
      });
    });

    describe('DELETE /v1/auth/users/:id', () => {
      it('should soft delete a user (super admin)', async () => {
        const uniqueEmail = `softdelete_${Date.now()}@example.com`;
        const response = await request(app.getHttpServer())
          .post('/v1/auth/register')
          .set('Authorization', `Bearer ${superAdminToken}`)
          .send({
            username: `softdelete_${Date.now()}`,
            email: uniqueEmail,
            password: 'Password@123',
            role: 'user',
          })
          .expect(201);

        await request(app.getHttpServer())
          .delete(`/v1/auth/users/${response.body.id}`)
          .set('Authorization', `Bearer ${superAdminToken}`)
          .expect(204);
      });

      it('should fail to delete non-existent user', async () => {
        await request(app.getHttpServer())
          .delete('/v1/auth/users/00000000-0000-4000-8000-000000000000')
          .set('Authorization', `Bearer ${superAdminToken}`)
          .expect(404);
      });

      it('should fail for non-super-admin', async () => {
        await request(app.getHttpServer())
          .delete(`/v1/auth/users/${deleteUserId}`)
          .set('Authorization', `Bearer ${userToken}`)
          .expect(403);
      });

      it('should fail to delete super admin', async () => {
        const superAdmin = await request(app.getHttpServer())
          .get('/v1/auth/me')
          .set('Authorization', `Bearer ${superAdminToken}`)
          .expect(200);

        await request(app.getHttpServer())
          .delete(`/v1/auth/users/${superAdmin.body.id}`)
          .set('Authorization', `Bearer ${superAdminToken}`)
          .expect(400);
      });

      it('should reject an invalid user UUID', async () => {
        await request(app.getHttpServer())
          .delete('/v1/auth/users/not-a-uuid')
          .set('Authorization', `Bearer ${superAdminToken}`)
          .expect(400);
      });
    });

    describe('PUT /v1/auth/users/:id/restore', () => {
      it('should restore a soft-deleted user', async () => {
        const uniqueEmail = `restore_${Date.now()}@example.com`;
        const response = await request(app.getHttpServer())
          .post('/v1/auth/register')
          .set('Authorization', `Bearer ${superAdminToken}`)
          .send({
            username: `restore_${Date.now()}`,
            email: uniqueEmail,
            password: 'Password@123',
            role: 'user',
          })
          .expect(201);

        await request(app.getHttpServer())
          .delete(`/v1/auth/users/${response.body.id}`)
          .set('Authorization', `Bearer ${superAdminToken}`)
          .expect(204);

        const restoreResponse = await request(app.getHttpServer())
          .put(`/v1/auth/users/${response.body.id}/restore`)
          .set('Authorization', `Bearer ${superAdminToken}`)
          .expect(200);

        expect(restoreResponse.body.id).toBe(response.body.id);
        expect(restoreResponse.body.deletedAt).toBeNull();
        expect(restoreResponse.body.isActive).toBe(true);
      });

      it('should fail to restore non-deleted user', async () => {
        const uniqueEmail = `notdeleted_${Date.now()}@example.com`;
        const response = await request(app.getHttpServer())
          .post('/v1/auth/register')
          .set('Authorization', `Bearer ${superAdminToken}`)
          .send({
            username: `notdeleted_${Date.now()}`,
            email: uniqueEmail,
            password: 'Password@123',
            role: 'user',
          })
          .expect(201);

        await request(app.getHttpServer())
          .put(`/v1/auth/users/${response.body.id}/restore`)
          .set('Authorization', `Bearer ${superAdminToken}`)
          .expect(400);
      });

      it('should fail for non-super-admin', async () => {
        await request(app.getHttpServer())
          .put(`/v1/auth/users/${deleteUserId}/restore`)
          .set('Authorization', `Bearer ${userToken}`)
          .expect(403);
      });
    });

    describe('DELETE /v1/auth/users/:id/permanent', () => {
      it('should reject permanent deletion of an active user', async () => {
        const suffix = Date.now();
        const created = await request(app.getHttpServer())
          .post('/v1/auth/register')
          .set('Authorization', `Bearer ${superAdminToken}`)
          .send({
            username: `active_permanent_${suffix}`,
            email: `active_permanent_${suffix}@example.com`,
            password: 'Password@123',
            role: 'user',
          })
          .expect(201);

        await request(app.getHttpServer())
          .delete(`/v1/auth/users/${created.body.id}/permanent`)
          .set('Authorization', `Bearer ${superAdminToken}`)
          .expect(400);
      });

      it('should permanently delete a user', async () => {
        const uniqueEmail = `permanent_${Date.now()}@example.com`;
        const response = await request(app.getHttpServer())
          .post('/v1/auth/register')
          .set('Authorization', `Bearer ${superAdminToken}`)
          .send({
            username: `permanent_${Date.now()}`,
            email: uniqueEmail,
            password: 'Password@123',
            role: 'user',
          })
          .expect(201);

        await request(app.getHttpServer())
          .delete(`/v1/auth/users/${response.body.id}`)
          .set('Authorization', `Bearer ${superAdminToken}`)
          .expect(204);

        await request(app.getHttpServer())
          .delete(`/v1/auth/users/${response.body.id}/permanent`)
          .set('Authorization', `Bearer ${superAdminToken}`)
          .expect(204);

        // Verify the user is completely gone (404)
        await request(app.getHttpServer())
          .get(`/v1/auth/users/${response.body.id}?includeDeleted=true`)
          .set('Authorization', `Bearer ${superAdminToken}`)
          .expect(404);
      });

      it('should fail for non-super-admin', async () => {
        await request(app.getHttpServer())
          .delete(`/v1/auth/users/${deleteUserId}/permanent`)
          .set('Authorization', `Bearer ${userToken}`)
          .expect(403);
      });
    });

    // Self-delete test: super admin trying to delete own account
    it('should prevent super admin from deleting their own account', async () => {
      const me = await request(app.getHttpServer())
        .get('/v1/auth/me')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .delete(`/v1/auth/users/${me.body.id}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(400);
    });
  });

  // ================================================================
  // LOGOUT
  // ================================================================
  describe('POST /v1/auth/logout', () => {
    it('should logout the current session', async () => {
      const loginResponse = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({
          email: 'admin@example.com',
          password: 'Admin@123',
        })
        .expect(200);

      const token = loginResponse.body.accessToken;

      await request(app.getHttpServer())
        .post('/v1/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.message).toBe('Logged out successfully');
        });
    });

    it('should reject logout when the current session is already inactive', async () => {
      const loginResponse = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({
          email: 'admin@example.com',
          password: 'Admin@123',
        })
        .expect(200);

      const token = loginResponse.body.accessToken;

      await request(app.getHttpServer())
        .post('/v1/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      await request(app.getHttpServer())
        .post('/v1/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);
    });

    it('should fail without access token', async () => {
      await request(app.getHttpServer()).post('/v1/auth/logout').send({}).expect(401);
    });

    it('should fail with invalid access token', async () => {
      await request(app.getHttpServer())
        .post('/v1/auth/logout')
        .set('Authorization', 'Bearer invalidtoken')
        .send({})
        .expect(401);
    });
  });

  // ================================================================
  // LOGOUT ALL
  // ================================================================
  describe('POST /v1/auth/logout-all', () => {
    it('should logout from all devices and invalidate refresh tokens', async () => {
      const loginResponse = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email: 'admin@example.com', password: 'Admin@123' })
        .expect(200);

      const token = loginResponse.body.accessToken;
      const rt = loginResponse.body.refreshToken;

      await request(app.getHttpServer())
        .post('/v1/auth/logout-all')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.message).toBe('Logged out from all devices');
        });

      // Verify that the old refresh token is no longer valid
      await request(app.getHttpServer())
        .post('/v1/auth/refresh')
        .send({ refreshToken: rt })
        .expect(401);
    });

    it('should fail without access token', async () => {
      await request(app.getHttpServer()).post('/v1/auth/logout-all').expect(401);
    });
  });
});
