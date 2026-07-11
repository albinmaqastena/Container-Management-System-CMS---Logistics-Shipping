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
  let testUserId: string;

  beforeAll(async () => {
    app = getApp();
    superAdminToken =
      await getAuthToken(
        'admin@example.com',
        'Admin@123',
      );

    adminToken =
      superAdminToken;

    userToken =
      await getAuthToken(
        'testuser@example.com',
        'Password@123',
      );
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
      testUserId = response.body.id;
    });

    it('should register an admin as super admin', async () => {
      const uniqueEmail = `e2eadmin_${Date.now()}@example.com`;
      const response = await request(app.getHttpServer())
        .post('/v1/auth/register')
        .set(
          'Authorization',
          `Bearer ${superAdminToken}`,
        )
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
    it('should login with valid credentials (admin)', async () => {
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
          expect(res.body.message).toBe('Invalid credentials');
        });
    });

    it('should fail with non-existent email', async () => {
      await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email: 'nonexistent@example.com', password: 'password' })
        .expect(401);
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

    const rateLimitIt =
      process.env.E2E_RATE_LIMIT === 'true' ? it : it.skip;

    rateLimitIt('should rate limit after 5 failed attempts', async () => {
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

      await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email, password: 'wrong' })
        .expect((res) => {
          expect([400, 429]).toContain(res.status);
        });
    }, 15000);
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

      expect(response.body).toHaveProperty(
        'accessToken',
      );
      expect(response.body).toHaveProperty(
        'refreshToken',
      );

      expect(
        response.body.refreshToken,
      ).not.toBe(refreshToken);

      refreshToken =
        response.body.refreshToken;
    });

    it('should fail with invalid refresh token', async () => {
      await request(app.getHttpServer())
        .post('/v1/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);
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
  // LOGOUT
  // ================================================================
  describe('POST /v1/auth/logout', () => {
    it('should logout successfully with refresh token in body', async () => {
      const loginResponse = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email: 'admin@example.com', password: 'Admin@123' })
        .expect(200);

      const token = loginResponse.body.accessToken;
      const rt = loginResponse.body.refreshToken;

      await request(app.getHttpServer())
        .post('/v1/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .send({ refreshToken: rt })
        .expect(200)
        .expect((res) => {
          expect(res.body.message).toBe('Logged out successfully');
        });
    });

    it('should fail without refresh token in body', async () => {
      const token = await getAuthToken('admin@example.com', 'Admin@123');

      await request(app.getHttpServer())
        .post('/v1/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect((res) => {
          expect(res.status).toBe(400);
        });
    });

    it('should fail without access token', async () => {
      await request(app.getHttpServer())
        .post('/v1/auth/logout')
        .send({ refreshToken: 'some-token' })
        .expect(401);
    });

    it('should fail with invalid access token', async () => {
      await request(app.getHttpServer())
        .post('/v1/auth/logout')
        .set('Authorization', 'Bearer invalidtoken')
        .send({ refreshToken: 'some-token' })
        .expect(401);
    });
  });

  // ================================================================
  // LOGOUT ALL
  // ================================================================
  describe('POST /v1/auth/logout-all', () => {
    it('should logout from all devices', async () => {
      const loginResponse = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email: 'admin@example.com', password: 'Admin@123' })
        .expect(200);

      const token = loginResponse.body.accessToken;

      await request(app.getHttpServer())
        .post('/v1/auth/logout-all')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.message).toBe('Logged out from all devices');
        });
    });

    it('should fail without access token', async () => {
      await request(app.getHttpServer())
        .post('/v1/auth/logout-all')
        .expect(401);
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

      if (response.body.sessions.length > 0) {
        const session = response.body.sessions[0];
        expect(session).toHaveProperty('id');
        expect(session).toHaveProperty('userId');
        expect(session).toHaveProperty('createdAt');
        expect(session).toHaveProperty('expiresAt');
        expect(session).toHaveProperty('isActive');
      }
    });

    it('should fail without token', async () => {
      await request(app.getHttpServer())
        .get('/v1/auth/sessions')
        .expect(401);
    });
  });

  // ================================================================
  // GET PROFILE (ME)
  // ================================================================
  describe('GET /v1/auth/me', () => {
    it('should get current user profile', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/auth/me')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('email', 'admin@example.com');
      expect(response.body).toHaveProperty('role', 'super_admin');
      expect(response.body).not.toHaveProperty('password');
      expect(response.body).not.toHaveProperty('resetPasswordToken');
      expect(response.body).not.toHaveProperty('resetPasswordExpires');
    });

    it('should fail without token', async () => {
      await request(app.getHttpServer())
        .get('/v1/auth/me')
        .expect(401);
    });
  });

  // ================================================================
  // CHANGE PASSWORD
  // ================================================================
  describe('POST /v1/auth/change-password', () => {
    let testUserToken: string;
    let testUserEmail: string;
    const testPassword = 'Password@123';

    beforeAll(async () => {
      const uniqueEmail = `changepw_${Date.now()}@example.com`;
      await request(app.getHttpServer())
        .post('/v1/auth/register')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          username: `changepw_${Date.now()}`,
          email: uniqueEmail,
          password: testPassword,
          role: 'user',
        })
        .expect(201);

      testUserEmail = uniqueEmail;
      testUserToken = await getAuthToken(testUserEmail, testPassword);
    });

    it('should change password successfully', async () => {
      const newPassword = 'NewPassword456!';
      await request(app.getHttpServer())
        .post('/v1/auth/change-password')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({
          currentPassword: testPassword,
          newPassword: newPassword,
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.message).toBe('Password changed successfully');
        });

      await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email: testUserEmail, password: newPassword })
        .expect(200);
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
          currentPassword: testPassword,
          newPassword: '123',
        })
        .expect(400);
    });

    it('should fail without token', async () => {
      await request(app.getHttpServer())
        .post('/v1/auth/change-password')
        .send({
          currentPassword: testPassword,
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

      const sessionId = sessionsResponse.body.sessions[0].id;

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

        expect(
          Array.isArray(
            response.body.data,
          ),
        ).toBe(true);
        expect(
          response.body,
        ).toEqual(
          expect.objectContaining({
            total:
              expect.any(Number),
            limit: 100,
            offset: 0,
            totalPages:
              expect.any(Number),
            currentPage: 1,
            hasMore:
              expect.any(Boolean),
          }),
        );

        const found =
          response.body.data.some(
            (user: {
              id: string;
            }) =>
              user.id ===
              deleteUserId,
          );
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

        await request(app.getHttpServer())
          .put(`/v1/auth/users/${response.body.id}/restore`)
          .set('Authorization', `Bearer ${superAdminToken}`)
          .expect(200);
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
      });

      it('should fail for non-super-admin', async () => {
        await request(app.getHttpServer())
          .delete(`/v1/auth/users/${deleteUserId}/permanent`)
          .set('Authorization', `Bearer ${userToken}`)
          .expect(403);
      });
    });
  });
});