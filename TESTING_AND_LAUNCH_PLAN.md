# Beanstalk Age-Verified Investment Contests - Phase 5 Testing & Launch Plan

## Executive Summary
Phase 5 encompasses comprehensive testing across all three platforms (API, Mobile, Web) and defines the launch strategy. The system enables age-verified users to participate in age-matched investment contests with virtual portfolios.

---

## 1. Testing Strategy

### 1.1 Test Scope
- **Unit Tests:** Individual functions and services
- **Integration Tests:** API endpoints with database
- **UI Tests:** Mobile and web component interactions
- **E2E Tests:** Complete user workflows
- **Performance Tests:** Load and stress testing
- **Security Tests:** Age verification, consent, data protection

### 1.2 Test Environments
1. **Local:** Developer machines with mock data
2. **Staging:** GCP staging environment (test database)
3. **UAT:** User acceptance testing with real data
4. **Production:** Live deployment

---

## 2. Backend (API) Testing

### 2.1 Age Verification Tests
**Test Cases:**
- Self-reported age calculation (valid DOB)
- Age boundary testing (13, 14, 18, 25, 26)
- Invalid DOB format rejection
- Future date rejection
- Age over 120 rejection
- Minimum age (13) enforcement
- Age group assignment (middle_school, high_school, college, adults)

**Test Data:**
```
Valid: 2010-03-15 (age 13-14 → middle_school)
Valid: 2006-06-20 (age 17-18 → high_school)
Valid: 2004-12-10 (age 19-20 → college)
Valid: 1998-01-05 (age 26+ → adults)
Invalid: 2015-03-20 (age < 13)
Invalid: 1900-01-01 (age > 120)
Invalid: 2025-12-31 (future date)
```

### 2.2 Parental Consent Tests
**Test Cases:**
- Email validation (valid format)
- Token generation and storage
- Token expiry (7 days)
- Email verification link delivery
- Parent confirmation acceptance
- Parent consent decline workflow
- Account activation on consent

**Test Data:**
```
Parent email: valid@example.com
Token expiry: Now + 7 days
Resend limit: 3 times within 24 hours
```

### 2.3 EULA & Consent Tests
**Test Cases:**
- Get current EULA version
- Accept EULA (save consent record)
- Version history retrieval
- Missing consent detection
- Age-group-specific EULA display
- Multiple consent types (ToS, Privacy, Contest Rules)

**Test Scenarios:**
```
GET /api/compliance/eula/terms_of_service/latest
  → Returns current ToS version

POST /api/compliance/accept-eula
  Request: { eula_id: "tos_v2.1", user_id: "123" }
  Response: { accepted_at, consent_record }
  → Verify DB record created

GET /api/compliance/user-consents/123
  → Returns array of all acceptances
```

### 2.4 Portfolio Tests
**Test Cases:**
- Portfolio creation with starting balance
- Buy trade execution
- Sell trade execution
- Position averaging on multiple buys
- Insufficient cash rejection
- Insufficient shares rejection on sell
- Portfolio value calculation
- Performance metrics calculation
- Price updates
- Transaction history retrieval

**Test Scenarios:**
```
Scenario 1: Buy AAPL
  Portfolio: $100,000 cash
  Trade: Buy 10 AAPL @ $150
  Expected: Cash = $98,500, Position = 10 AAPL @ $150

Scenario 2: Average Down
  Portfolio: 10 AAPL @ $150
  Trade: Buy 5 AAPL @ $145
  Expected: 15 AAPL @ $148.33 (weighted average)

Scenario 3: Sell with Gain
  Portfolio: 10 AAPL @ $150, Cash = $98,500
  Trade: Sell 5 AAPL @ $160
  Expected: 5 AAPL @ $150, Cash = $98,500 + $800

Scenario 4: Insufficient Balance
  Portfolio: $1,000 cash
  Trade: Buy 10 AAPL @ $150 ($1500 needed)
  Expected: Error "Insufficient cash balance"
```

### 2.5 Contest Tests
**Test Cases:**
- Contest creation with valid parameters
- Age group eligibility verification
- User joins contest (separate portfolio created)
- Contests with registration deadline
- Leaderboard calculation and ranking
- Prize assignment based on rank
- Contest conclusion workflow

**Test Scenarios:**
```
Scenario 1: Create Contest for High School
  Input: age_groups=['high_school'], start_balance=50000
  Verify: Contest created, status='draft'

Scenario 2: User Joins Contest (Age Group Check)
  User: age_group='high_school'
  Contest: eligible age_groups=['high_school','college']
  Expected: User joins successfully, contest_portfolio created

Scenario 3: Ineligible User Attempts to Join
  User: age_group='middle_school'
  Contest: eligible age_groups=['high_school','college']
  Expected: Error "Age group not eligible"

Scenario 4: Leaderboard Ranking
  Participants: 5 users with portfolios
  Calculate: Rankings by return_percent
  Verify: Top users ranked 1,2,3... correctly
```

### 2.6 Admin Endpoints Tests
**Test Cases:**
- Get users with filters (age_group, status, verification)
- Verify user age
- Approve parental consent
- Suspend account
- Dashboard metrics
- Analytics queries

---

## 3. Mobile (Flutter) Testing

### 3.1 Onboarding Flow Tests
**Test Scenarios:**
1. **Age Verification Screen**
   - User enters DOB
   - Age group displays immediately
   - Date picker validation
   - Next button enabled on valid age

2. **Parental Consent Screen** (if age < 18)
   - Parent name input
   - Parent email input
   - Resend email button
   - Pending verification state

3. **Demographics Form**
   - Education level dropdown
   - Income bracket dropdown
   - Interest selection
   - Risk tolerance selection

4. **EULA & Acceptance**
   - Scrollable EULA text
   - Multiple consent checkboxes
   - Accept button enabled when all checked
   - Navigation to dashboard on accept

### 3.2 Portfolio Dashboard Tests
**Test Scenarios:**
1. **Data Display**
   - Portfolio value displays correctly
   - Starting balance accurate
   - Total return calculated correctly
   - Return percentage accurate

2. **Positions List**
   - All positions display
   - Gain/loss color coded (green/red)
   - Current price updates
   - Click on position shows details

3. **Action Buttons**
   - Trade button navigates to trading
   - History button shows transaction list

### 3.3 Trading Screen Tests
**Test Scenarios:**
1. **Buy Tab**
   - Symbol input (no validation yet)
   - Quantity input (numeric only)
   - Price input (numeric only)
   - Total cost calculates in real-time
   - Confirm button triggers dialog
   - Dialog shows order summary
   - Confirm executes trade

2. **Sell Tab**
   - Same as buy
   - Verifies sufficient shares available
   - Updates portfolio on confirm

3. **Validation**
   - Empty fields show error
   - Sells more than owned: rejected
   - Buys with insufficient cash: rejected

### 3.4 Contest Screens Tests
**Test Scenarios:**
1. **Contest Discovery**
   - Contests load and display
   - Difficulty filter works
   - Contest cards show all details
   - Join button opens confirmation
   - Join creates participant record

2. **Leaderboard**
   - Age group filter works
   - Podium displays top 3 correctly
   - Full rankings list scrollable
   - Rankings sorted by return %
   - Best position displayed

### 3.5 Transaction History
**Test Scenarios:**
- All transactions display
- Filter by type works
- Icons and colors correct
- Dates format correctly
- Amount calculations correct

---

## 4. Web Portal (Angular) Testing

### 4.1 Admin Authentication Tests
**Test Scenarios:**
1. **Login Flow**
   - Admin enters email/password
   - API call to /api/admin/auth/login
   - Session stored in localStorage
   - Redirect to dashboard
   - Logout clears session

2. **Route Guards**
   - Unauthenticated user → redirect to login
   - Authenticated user can access
   - Wrong role → unauthorized page

### 4.2 Dashboard Tests
**Test Scenarios:**
- Metrics load correctly
- Total users count accurate
- Verified users percentage correct
- Active contests count
- Participant count
- Portfolio value sum

### 4.3 User Management Tests
**Test Scenarios:**
1. **User List**
   - All users load
   - Filters work (status, age_group, verified)
   - Search by email works
   - Pagination works

2. **Verify Age Button**
   - Opens confirmation modal
   - Submit updates user_age_verified
   - List refreshes

3. **Approve Consent Button**
   - Opens confirmation modal
   - Submit updates parent_email_verified
   - Account activated

4. **Suspend Account Button**
   - Opens confirmation modal
   - Changes status to suspended
   - User cannot login

### 4.4 EULA Management Tests
**Test Scenarios:**
- Display all EULA versions
- Filter by type
- Show current version badge
- View full text button
- Activate older version button

### 4.5 Contest Manager Tests
**Test Scenarios:**
- List all contests
- Filter by status
- Show participant progress
- View contest details
- Manage contest button

### 4.6 Analytics Tests
**Test Scenarios:**
- Metrics load
- Users by age group display
- Contest performance data
- Portfolio metrics show

---

## 5. End-to-End User Workflows

### 5.1 Complete User Journey (Age 15, High School)
```
1. Download & Install Mobile App
2. Sign Up with email/password
3. Enter DOB (2009-06-15) → age_group = high_school
4. System asks for parental consent
5. Enter parent email
6. Parent receives email → clicks verification link
7. System marks parent_consent approved
8. Accept ToS, Privacy, Contest Rules
9. Fill demographics (education: high_school, etc.)
10. View portfolio dashboard ($100,000 starting balance)
11. Browse contests → find "High School Trading Challenge"
12. Join contest → new portfolio created with $50,000
13. Execute buy trade (10 AAPL @ $150)
14. View leaderboard (age_group filter shows high_school users)
15. Check transaction history
16. Admin (web portal) verifies age manually
17. User now fully verified
```

### 5.2 Admin Verification Workflow
```
1. Admin logs in to web portal
2. Navigate to User Management
3. Filter: status=pending_verification
4. See user "John Doe" (age 15) pending consent
5. Click "Approve Parental Consent" button
6. Confirm in modal
7. User's parent_email_verified = true
8. System sends response email to parent
9. John Doe's account activated
10. Navigate to user's profile → see verification status updated
```

### 5.3 Contest Participation Workflow
```
1. User in high_school age group logs in
2. Navigates to Contests
3. Sees 3 contests (all filtered by age_group)
4. Clicks "Join Contest" on "High School Trading Challenge"
5. New contest_portfolio created with starting_balance
6. Executes buy trades within contest
7. Contest leaderboard updates in real-time
8. On contest end date, admin "Concludes Contest"
9. Winners ranked and prizes assigned
10. User views final ranking (2nd place)
11. Prize badge awarded to user profile
```

---

## 6. Performance & Load Testing

### 6.1 Load Test Scenarios
**Scenario 1: 1000 Concurrent Signups**
- Expected Response Time: < 2 seconds
- Success Rate: > 99%

**Scenario 2: 500 Concurrent Portfolio Updates**
- Expected Response Time: < 1 second
- Success Rate: > 99%

**Scenario 3: Leaderboard Calculation (10,000 users)**
- Expected Calculation Time: < 30 seconds
- Database Query Time: < 5 seconds

### 6.2 Load Test Tools
- Apache JMeter for API load testing
- Firebase Test Lab for mobile
- Lighthouse for web performance

---

## 7. Security Testing

### 7.1 Age Verification Security
- **Test:** Bypass age check by modifying DOB in client
  - Expected: Server validates DOB range (13-120 years)
  - Pass if: Request rejected

- **Test:** Access contest API without age verification
  - Expected: 403 Forbidden response
  - Pass if: requireAgeVerified middleware blocks

### 7.2 Parental Consent Security
- **Test:** Forge parental consent token
  - Expected: Invalid token rejected
  - Pass if: JWT validation fails

- **Test:** Reuse expired consent token
  - Expected: Token expired error
  - Pass if: Timestamp validation works

### 7.3 Data Protection
- **Test:** SQL injection in email field
  - Expected: Parameterized queries prevent injection
  - Pass if: No data leaked

- **Test:** XSS in user profile
  - Expected: HTML escaped in display
  - Pass if: Script tags rendered as text

### 7.4 Permission Testing
- **Test:** Contest Manager tries to suspend user
  - Expected: 403 Forbidden
  - Pass if: Permission check blocks

- **Test:** Moderator tries to approve parental consent
  - Expected: 200 OK
  - Pass if: Permission check allows

---

## 8. Test Case Documentation Template

### Format: API Endpoint Test
```
TEST: POST /api/onboarding/age-verify/self-report
ENDPOINT: Age Verification

Preconditions:
- User logged in
- Fresh user account

Test Case 1: Valid DOB (Age 15)
  Request Body: { date_of_birth: "2009-06-15" }
  Expected Response:
    {
      verified: true,
      age_group: "high_school",
      age: 15,
      requires_parental_consent: true
    }
  Expected Status: 200
  Pass Criteria: Response matches expected

Test Case 2: Age < 13
  Request Body: { date_of_birth: "2015-06-15" }
  Expected Response: { error: "Too young" }
  Expected Status: 400
  Pass Criteria: Error returned

Test Case 3: Invalid Date Format
  Request Body: { date_of_birth: "06/15/2009" }
  Expected Response: { error: "Invalid format" }
  Expected Status: 400
  Pass Criteria: Validation error
```

---

## 9. Manual Testing Checklist

### Mobile App
- [ ] Signup flow completes
- [ ] Age verification calculates correctly
- [ ] Parental consent email sends
- [ ] EULA pages scroll and display properly
- [ ] Portfolio dashboard shows correct values
- [ ] Buy/sell trades confirm properly
- [ ] Leaderboard displays all users
- [ ] Navigation between screens works
- [ ] Handles no internet gracefully
- [ ] App doesn't crash during trades

### Web Portal
- [ ] Admin login works
- [ ] Sidebar navigation works
- [ ] User filter dropdowns work
- [ ] Verify age modal opens/closes
- [ ] User list updates after verification
- [ ] Dashboard metrics load
- [ ] EULA cards display correctly
- [ ] Contest list loads
- [ ] Analytics numbers display
- [ ] Logout clears session

### API
- [ ] All endpoints respond with correct status codes
- [ ] Response formats match specifications
- [ ] Timestamps are ISO 8601
- [ ] Error messages are descriptive
- [ ] Rate limiting works
- [ ] CORS headers present
- [ ] Request validation tight
- [ ] Database transactions roll back on error

---

## 10. Deployment & Launch Plan

### 10.1 Pre-Launch Checklist
- [ ] All tests passing (API, Mobile, Web)
- [ ] Load testing completed and thresholds met
- [ ] Security audit completed
- [ ] Production database migrations tested
- [ ] Backup and recovery plan documented
- [ ] Monitoring and alerting configured
- [ ] Support documentation written
- [ ] Admin onboarding completed

### 10.2 Deployment Steps

**1. Database Migration (Production)**
```bash
# Run BigQuery migrations in order
001_add_age_verification.sql
002_add_demographics.sql
003_add_parental_consent.sql
004_add_eula_tracking.sql
005_add_portfolio_tables.sql
006_add_contest_tables.sql

# Verify tables created
SELECT table_name FROM `project.dataset.__TABLES__`
```

**2. API Deployment**
```bash
cd /Users/mehtafam/Downloads/api
npm install --production
npm run build
npm run migrate:prod
npm start
# Verify endpoints: GET /health → 200 OK
```

**3. Mobile App Deployment**
```bash
cd /Users/mehtafam/Downloads/mobile
flutter clean
flutter pub get
flutter build apk --release  # For Android
flutter build ios --release  # For iOS
# Upload to App Store / Google Play
```

**4. Web Portal Deployment**
```bash
cd /Users/mehtafam/Downloads/web
npm install --production
npm run build --prod
# Deploy to GCP (Cloud Run / App Engine)
gcloud app deploy
# Verify: https://beanstalk-web.appspot.com
```

### 10.3 Launch Communication
- [ ] Announce to user base (email, in-app)
- [ ] Share feature documentation
- [ ] Provide support contact information
- [ ] Set up FAQ page
- [ ] Configure monitoring dashboards

### 10.4 Post-Launch Monitoring (First 48 Hours)
- [ ] API error rates < 0.5%
- [ ] Mobile app crash rate < 0.1%
- [ ] Web portal response time < 2s
- [ ] Monitor signup completion rate > 80%
- [ ] Age verification success rate > 95%
- [ ] No data loss or corruption
- [ ] Parental consent emails delivering
- [ ] Portfolio calculations accurate

---

## 11. Rollback Plan

### Immediate Rollback (If Critical Issue)
1. Disable API in load balancer
2. Serve old API version from backup
3. Notify users via push notification
4. Investigate issue in playground environment

### Database Rollback
- BigQuery: Snapshots available for last 7 days
- Procedure: Restore from snapshot, re-migrate

### Mobile App Rollback
- Disable new app version on app stores
- Force users to adopt previous version

---

## 12. Success Criteria

### Metrics to Track
- **User Signup Rate:** > 100 users/day post-launch
- **Age Verification Success:** > 95%
- **Parental Consent Approval:** > 80% (for under 18)
- **Portfolio Trading Active:** > 50% of verified users
- **Contest Participation:** > 10 users per contest
- **API Uptime:** > 99.9%
- **Mobile App Crashes:** < 0.1% of sessions
- **Admin Task Completion:** < 1 minute per verification

---

## 13. Documentation & Support

### User Documentation
- [ ] Signup & age verification guide
- [ ] Portfolio trading tutorial
- [ ] Contest participation guide
- [ ] FAQ page
- [ ] Parental consent information

### Admin Documentation
- [ ] Admin dashboard guide
- [ ] User verification procedures
- [ ] Contest management guide
- [ ] Troubleshooting guide
- [ ] API documentation

### Developer Documentation
- [ ] API endpoint specs
- [ ] Database schema docs
- [ ] Deployment procedures
- [ ] Monitoring setup
- [ ] Incident response procedures

---

## 14. Known Limitations & Future Enhancements

### Phase 1 Limitations (MVP)
- No real stock market data (hardcoded prices)
- No Alpaca integration yet
- No real prize payout system
- No SMS notifications
- No OAuth/SSO

### Phase 2 Roadmap
- [ ] Connect to Alpaca API for real prices
- [ ] Real money contest support
- [ ] Mobile push notifications
- [ ] OAuth2 integration (Google, Apple)
- [ ] Advanced analytics dashboards
- [ ] Referral program
- [ ] Achievement badges/rewards

---

## 15. Sign-Off

**Testing Lead Approval:** _______________  Date: _______

**Product Manager Approval:** _______________  Date: _______

**Deployment Lead Approval:** _______________  Date: _______

**Launch Date:** May 1, 2024

---

## Appendix: Test Data CSV

### Users
```
email,password,dob,age_group,status
teen@example.com,Test123!,2009-06-15,high_school,pending_verification
college@example.com,Test123!,2003-12-20,college,active
adult@example.com,Test123!,1998-03-10,adults,active
```

### Test Contests
```
name,difficulty,age_groups,start_balance
High School Challenge,beginner,high_school,50000
College Investor,intermediate,college,100000
Elite Trading,advanced,adults,250000
```

---
