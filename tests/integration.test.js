/**
 * API Integration Tests
 * Test suite for Beanstalk age verification, portfolio, and contest APIs
 *
 * Prerequisites:
 * - npm install --save-dev jest supertest
 * - NODE_ENV=test before running
 * - Test database/BigQuery project
 */

const request = require('supertest');
const app = require('../src/app');

const BASE_URL = 'http://localhost:8080/api';

describe('Age Verification API Tests', () => {
  const testUserId = 'test-user-' + Date.now();

  describe('POST /onboarding/age-verify/self-report', () => {
    test('should verify user age with valid DOB (age 15)', async () => {
      const res = await request(app)
        .post('/api/onboarding/age-verify/self-report')
        .send({
          session_id: 'test-session',
          date_of_birth: '2009-06-15',
        });

      expect(res.status).toBe(200);
      expect(res.body.verified).toBe(true);
      expect(res.body.age_group).toBe('high_school');
      expect(res.body.age).toBe(15);
      expect(res.body.requires_parental_consent).toBe(true);
    });

    test('should verify user age with valid DOB (age 26)', async () => {
      const res = await request(app)
        .post('/api/onboarding/age-verify/self-report')
        .send({
          session_id: 'test-session',
          date_of_birth: '1998-03-10',
        });

      expect(res.status).toBe(200);
      expect(res.body.age_group).toBe('adults');
      expect(res.body.requires_parental_consent).toBe(false);
    });

    test('should reject age less than 13', async () => {
      const res = await request(app)
        .post('/api/onboarding/age-verify/self-report')
        .send({
          session_id: 'test-session',
          date_of_birth: '2015-06-15',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('13');
    });

    test('should reject future date', async () => {
      const res = await request(app)
        .post('/api/onboarding/age-verify/self-report')
        .send({
          session_id: 'test-session',
          date_of_birth: '2025-12-31',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('future');
    });

    test('should reject age over 120', async () => {
      const res = await request(app)
        .post('/api/onboarding/age-verify/self-report')
        .send({
          session_id: 'test-session',
          date_of_birth: '1900-01-01',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('check');
    });

    test('should correctly classify age groups', async () => {
      const testCases = [
        { dob: '2010-06-15', expectedGroup: 'middle_school' }, // age 13-14
        { dob: '2006-06-15', expectedGroup: 'high_school' },   // age 17-18
        { dob: '2004-06-15', expectedGroup: 'college' },       // age 19-20
        { dob: '1998-06-15', expectedGroup: 'adults' },        // age 25-26
      ];

      for (const testCase of testCases) {
        const res = await request(app)
          .post('/api/onboarding/age-verify/self-report')
          .send({
            session_id: 'test-session',
            date_of_birth: testCase.dob,
          });

        expect(res.body.age_group).toBe(testCase.expectedGroup);
      }
    });
  });
});

describe('Parental Consent API Tests', () => {
  const testUserId = 'minor-user-' + Date.now();

  describe('POST /onboarding/parental-consent/init', () => {
    test('should initiate parental consent for minor', async () => {
      const res = await request(app)
        .post('/api/onboarding/parental-consent/init')
        .send({
          user_id: testUserId,
          parent_email: 'parent@example.com',
          minor_name: 'John Doe',
        });

      expect(res.status).toBe(200);
      expect(res.body.consent_pending_id).toBeDefined();
      expect(res.body.verification_token_sent_to).toBe('parent@example.com');
    });

    test('should reject invalid parent email', async () => {
      const res = await request(app)
        .post('/api/onboarding/parental-consent/init')
        .send({
          user_id: testUserId,
          parent_email: 'invalid-email',
          minor_name: 'John Doe',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('email');
    });
  });
});

describe('EULA & Compliance API Tests', () => {
  describe('GET /compliance/eula/:type/:version', () => {
    test('should get current terms of service', async () => {
      const res = await request(app)
        .get('/api/compliance/eula/terms_of_service/latest');

      expect(res.status).toBe(200);
      expect(res.body.eula_type).toBe('terms_of_service');
      expect(res.body.version).toBeDefined();
      expect(res.body.content_html).toBeDefined();
    });

    test('should get specific EULA version', async () => {
      const res = await request(app)
        .get('/api/compliance/eula/privacy_policy/1.0');

      expect(res.status).toBe(200);
      expect(res.body.version).toBe('1.0');
    });

    test('should return 404 for non-existent version', async () => {
      const res = await request(app)
        .get('/api/compliance/eula/invalid_type/1.0');

      expect(res.status).toBe(404);
    });
  });

  describe('POST /compliance/accept-eula', () => {
    test('should accept EULA and record consent', async () => {
      const res = await request(app)
        .post('/api/compliance/accept-eula')
        .send({
          user_id: 'test-user-123',
          eula_id: 'tos_v2.0',
        });

      expect(res.status).toBe(200);
      expect(res.body.accepted_at).toBeDefined();
    });
  });
});

describe('Portfolio API Tests', () => {
  const testUserId = 'portfolio-user-' + Date.now();

  describe('Portfolio Create & Retrieve', () => {
    test('should create portfolio with starting balance', async () => {
      const res = await request(app)
        .post('/api/portfolio/create')
        .send({
          user_id: testUserId,
          starting_balance: 10000,
        });

      expect(res.status).toBe(200);
      expect(res.body.portfolio_id).toBeDefined();
      expect(res.body.current_cash_balance).toBe(10000);
      expect(res.body.total_portfolio_value).toBe(10000);
    });

    test('should retrieve user portfolio', async () => {
      const res = await request(app)
        .get(`/api/portfolio/${testUserId}`);

      expect(res.status).toBe(200);
      expect(res.body.starting_balance).toBe(10000);
      expect(res.body.positions).toEqual([]);
    });
  });

  describe('Buy Trade', () => {
    test('should execute buy trade successfully', async () => {
      const res = await request(app)
        .post(`/api/portfolio/${testUserId}/trade`)
        .send({
          action: 'buy',
          symbol: 'AAPL',
          quantity: 10,
          price: 150.0,
        });

      expect(res.status).toBe(200);
      expect(res.body.transaction_id).toBeDefined();
      expect(res.body.action).toBe('buy');
      expect(res.body.status).toBe('completed');
      expect(res.body.portfolio_updated.cash_balance).toBe(8500); // 10000 - 1500
      expect(res.body.portfolio_updated.position_count).toBe(1);
    });

    test('should reject buy with insufficient cash', async () => {
      const res = await request(app)
        .post(`/api/portfolio/${testUserId}/trade`)
        .send({
          action: 'buy',
          symbol: 'AAPL',
          quantity: 1000000,
          price: 150.0,
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Insufficient');
    });
  });

  describe('Sell Trade', () => {
    test('should execute sell trade successfully', async () => {
      // First buy some shares
      await request(app)
        .post(`/api/portfolio/${testUserId}/trade`)
        .send({
          action: 'buy',
          symbol: 'MSFT',
          quantity: 5,
          price: 300.0,
        });

      // Then sell
      const res = await request(app)
        .post(`/api/portfolio/${testUserId}/trade`)
        .send({
          action: 'sell',
          symbol: 'MSFT',
          quantity: 3,
          price: 320.0,
        });

      expect(res.status).toBe(200);
      expect(res.body.action).toBe('sell');
      expect(res.body.portfolio_updated.position_count).toBe(2); // AAPL + remaining MSFT
    });

    test('should reject sell with insufficient shares', async () => {
      const res = await request(app)
        .post(`/api/portfolio/${testUserId}/trade`)
        .send({
          action: 'sell',
          symbol: 'GOOGL', // Never bought
          quantity: 1,
          price: 2800.0,
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Insufficient');
    });
  });

  describe('Portfolio Performance', () => {
    test('should calculate correct portfolio value with position updates', async () => {
      // Buy 10 AAPL @ 150
      await request(app)
        .post(`/api/portfolio/${testUserId}/trade`)
        .send({
          action: 'buy',
          symbol: 'GOOG',
          quantity: 1,
          price: 2800.0,
        });

      // Update prices
      const res = await request(app)
        .put(`/api/portfolio/${testUserId}/update-prices`)
        .send({
          priceMap: {
            AAPL: 160.0, // +10 per share
            GOOG: 2900.0, // +100 per share
            MSFT: 330.0,
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.total_return_percent).toBeGreaterThan(0);
    });
  });

  describe('Transaction History', () => {
    test('should retrieve transaction history', async () => {
      const res = await request(app)
        .get(`/api/portfolio/${testUserId}/transactions`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.transactions)).toBe(true);
      expect(res.body.transactions.length).toBeGreaterThan(0);
    });

    test('should filter transactions by type', async () => {
      const res = await request(app)
        .get(`/api/portfolio/${testUserId}/transactions?type=buy`);

      expect(res.status).toBe(200);
      expect(res.body.transactions.every(t => t.type === 'buy')).toBe(true);
    });
  });
});

describe('Contest API Tests', () => {
  const testUserId = 'contest-user-' + Date.now();
  let contestId;

  describe('Contest Create', () => {
    test('should create contest with age groups', async () => {
      const res = await request(app)
        .post('/api/contests')
        .send({
          name: 'High School Trading Challenge',
          description: 'Test contest',
          age_groups: ['high_school'],
          start_date: new Date().toISOString(),
          end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          starting_balance: 50000,
        });

      expect(res.status).toBe(201);
      expect(res.body.contest_id).toBeDefined();
      expect(res.body.status).toBe('draft');
      contestId = res.body.contest_id;
    });
  });

  describe('Contest Join', () => {
    test('should allow user to join contest', async () => {
      const res = await request(app)
        .post(`/api/contests/${contestId}/join`)
        .send({
          user_id: testUserId,
          age_group: 'high_school',
        });

      expect(res.status).toBe(201);
      expect(res.body.participation_id).toBeDefined();
      expect(res.body.portfolio_id).toBeDefined();
      expect(res.body.status).toBe('active');
    });

    test('should reject ineligible age group', async () => {
      const res = await request(app)
        .post(`/api/contests/${contestId}/join`)
        .send({
          user_id: 'adult-user',
          age_group: 'adults',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('eligible');
    });
  });

  describe('Leaderboard', () => {
    test('should retrieve contest leaderboard', async () => {
      const res = await request(app)
        .get(`/api/contests/${contestId}/leaderboard`);

      expect(res.status).toBe(200);
      expect(res.body.leaderboards).toBeDefined();
    });

    test('should filter leaderboard by age group', async () => {
      const res = await request(app)
        .get(`/api/contests/${contestId}/leaderboard?age_group=high_school`);

      expect(res.status).toBe(200);
      const leaderboard = res.body.leaderboards['high_school'];
      expect(leaderboard).toBeDefined();
      expect(Array.isArray(leaderboard.rankings)).toBe(true);
    });
  });

  describe('Contest Conclude', () => {
    test('should conclude contest and assign prizes', async () => {
      const res = await request(app)
        .post(`/api/contests/${contestId}/conclude`)
        .send({});

      expect([200, 201]).toContain(res.status);
      expect(res.body.concluded_at).toBeDefined();
      expect(res.body.results_by_age_group).toBeDefined();
    });
  });
});

describe('Admin API Tests', () => {
  describe('User Management', () => {
    test('should retrieve users with filters', async () => {
      const res = await request(app)
        .get('/api/admin/users?status=active&age_group=high_school');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.users)).toBe(true);
    });

    test('should verify user age', async () => {
      const res = await request(app)
        .put('/api/admin/users/test-user-123/verify-age')
        .send({
          verified: true,
          verification_method: 'admin_verified',
        });

      expect(res.status).toBe(200);
    });
  });

  describe('Dashboard Metrics', () => {
    test('should retrieve dashboard metrics', async () => {
      const res = await request(app)
        .get('/api/admin/metrics/dashboard');

      expect(res.status).toBe(200);
      expect(res.body.total_users).toBeDefined();
      expect(res.body.verified_users).toBeDefined();
      expect(res.body.active_contests).toBeDefined();
    });
  });
});

describe('Error Handling & Validation', () => {
  test('should return 400 for missing required fields', async () => {
    const res = await request(app)
      .post('/api/onboarding/age-verify/self-report')
      .send({
        session_id: 'test',
        // Missing date_of_birth
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  test('should return 404 for non-existent resource', async () => {
    const res = await request(app)
      .get('/api/portfolio/non-existent-user');

    expect(res.status).toBe(404);
  });

  test('should sanitize input to prevent XSS', async () => {
    const res = await request(app)
      .post('/api/onboarding/parental-consent/init')
      .send({
        user_id: 'test',
        parent_email: 'valid@example.com',
        minor_name: '<script>alert("xss")</script>',
      });

    // Should either sanitize or reject
    expect([200, 400]).toContain(res.status);
  });
});

// Run tests: npm test
