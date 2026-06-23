# Aura Vive Server - Module Exploration

## Overview
This document contains a comprehensive analysis of key modules in the Aura Vive Server application, including Partner, Booking, Transaction, User, and FeedBack modules.

---

## 1. PARTNER MODULE

### Partner Model Schema
```javascript
{
  businessName: String,
  bankStatement: String,
  businessCertification: String,
  identityProof: String,
  certificate: String,
  aboutUs: String,
  amenities: [String],
  totalBookings: Number (default: 0),
  completeBookings: Number (default: 0),
  note: String,
  isVerified: Boolean (default: false),
  isCertified: Boolean (default: false),
  isBan: Boolean (default: false),
  address: String,
  rating: Number, // avg rating
  totalRating: Number (default: 0),
  ratingCount: Number (default: 0),
  review: String,
  isDeleted: Boolean (default: false),
  category: ObjectId (ref: Category),
  subcategory: [ObjectId] (ref: SubCategory),
  user: ObjectId (ref: User, required),
  timestamps: { createdAt, updatedAt }
}
```

### Partner Routes
| Method | Endpoint | Handler | Auth |
|--------|----------|---------|------|
| GET | `/admin/details/:id` | detailsForAdminController | None |
| GET | `/details/:id` | aPartnerDetailsController | Optional |
| GET | `/pending-forApproval` | pendingPartnerForApproval | None |
| GET | `/all` | allPartnerController | None |
| POST | `/feedback/:partnerId` | partnerFeedbackController | None |
| PATCH | `/suspend/:id` | suspendPartnerController | None |
| PATCH | `/active/:id` | activePartnerController | None |
| PATCH | `/approve/:id` | approvePartnerController | None |
| PATCH | `/give-flag/:id` | giveFlagController | None |
| PATCH | `/give-note/:id` | giveNoteController | None |
| PATCH | `/reject/:id` | rejectProviderController | None |

### Key Partner Services
- **pendingPartnerForApprovalService**: Fetches unverified partners with search, pagination
- **allPartnerService**: Fetches all partners with optional ban filter
- **approvePartnerService**: Approves partner (transaction with user verification)
- **suspendPartnerService**: Bans partner and associated user
- **activePartnerService**: Reactivates suspended partner
- **aPartnerDetailsService**: Detailed partner profile with services, user data, distance calculation
- **partnerFeedbackService**: Adds feedback for partner

---

## 2. USER MODULE

### User Model Schema
```javascript
{
  fullName: String,
  email: String (trimmed),
  phoneNumber: String,
  image: String (default: '/uploads/users/user.jpg'),
  role: String (enum: ['user', 'hr', 'partner', 'admin'], default: 'user'),
  isLoginToken: Boolean (default: true),
  isVerified: Boolean (default: false),
  isBan: Boolean (default: false),
  bookingCompleted: Number (default: 0),
  reportCount: Number (default: 0),
  flagCount: Number (default: 0),
  note: String (default: ""),
  isDeleted: Boolean (default: false),
  password: String (hashed with bcrypt),
  wallet: Number (default: 0),
  digitalWallet: Number (default: 0, rounded to 2 decimals),
  totalRevenue: Number (default: 0, for partners),
  usages: Number (default: 0),
  location: {
    type: Point (GeoJSON),
    coordinates: [Number, Number],
    index: 2dsphere
  },
  address: String,
  timestamps: { createdAt, updatedAt }
}
```

### User Routes
| Method | Endpoint | Handler | Auth |
|--------|----------|---------|------|
| PATCH | `/ban/:id` | suspendUserController | None |
| PATCH | `/active/:id` | activeUserController | None |
| PATCH | `/flag/:id` | addFlagController | None |
| PATCH | `/note/:id` | addNoteController | None |
| PATCH | `/add-credit/:id` | addCreditController | None |

### User Services
- **suspendUserService**: Bans user
- **activeUserService**: Unbans user
- **giveFlagService**: Increments flagCount
- **giveNoteService**: Adds admin note
- **giveCreditService**: Sets digitalWallet credit

---

## 3. BOOKING MODULE

### Booking Model Schema
```javascript
{
  user: ObjectId (ref: User, required),
  service: ObjectId (ref: Service, required),
  provider: ObjectId (ref: User),
  assignedTo: ObjectId (ref: User),
  date: Date,
  startTime: Date,
  endTime: Date,
  servicePrice: Number,
  totalPrice: Number,
  addons: [{
    serviceName: String,
    price: Number
  }],
  pass: {
    passName: String,
    price: Number,
    noOfSessions: Number,
    validity: Number // days
  },
  paymentMethod: String (enum: ['card','banktransfer', 'cash', 'wallet']),
  transaction: ObjectId (ref: Transaction),
  status: String (enum: ['pending', 'approved', 'cancelled', 'completed'], default: 'pending'),
  paymentStatus: String (enum: ['pending', 'paid', 'failed', 'refunded'], default: 'pending'),
  reason: String,
  pin: String (4-digit verification PIN),
  checkin: Date,
  isOneTime: Boolean (default: false),
  sessionLeft: Number,
  expireDate: Date,
  timestamps: { createdAt, updatedAt }
}
```

### Session Management Logic
- **Pass-based Bookings**: Sessions = service.pass.noOfSessions, expiry = date + service.pass.validity days
- **One-time Bookings**: Sessions = 1, expiry = date + 1 day
- **Check-in**: Uses pin verification, decrements sessionLeft, marks as completed when sessions = 0

### Booking Routes
| Method | Endpoint | Handler | Auth |
|--------|----------|---------|------|
| POST | `/add` | bookingController | user |
| PUT | `/edit/:bookingId` | modifyBookingController | user |
| GET | `/partner/upcoming` | allPendingBookingController | partner |
| GET | `/admin/all-booking` | allBookingController | admin |
| GET | `/partner/active` | allActiveBookingController | partner |
| GET | `/partner/completed` | allCompletedBookingController | partner |
| GET | `/partner/cancelled` | allCancelledBookingController | partner |
| GET | `/partner/details/:id` | bookingDetailsAdminEndController | partner |
| GET | `/upcoming-userend` | pendingBookingController | user |
| GET | `/active-userend` | activeBookingController | user |
| GET | `/past-userend` | pastBookingController | user |
| GET | `/details-userend/:id` | bookingDetailsController | user |
| GET | `/details/:id` | bookingDetailsController | user |
| PATCH | `/mark-completed/:id` | markAsCompletedController | partner |
| POST | `/feedback/:id` | serviceFeedbackController | user/partner |
| PATCH | `/partner/approve/:id` | approveBookingController | partner |
| PATCH | `/partner/complete/:id` | completeBookingController | partner |
| PATCH | `/assign-stuff/:id` | assignStuffController | partner |

### Key Booking Services
- **bookingService**: Creates booking with session/expiry logic
  - Handles 3 payment methods: cash, wallet, card, banktransfer
  - Creates transaction on wallet payment
  - Applies 10% commission rate
- **modifyBookingService**: Modifies pending bookings (user only)
- **markAsCompletedService**: Check-in with pin verification, decrements sessions
- **serviceFeedbackService**: Adds feedback after booking, updates service ratings
- **approveBookingService**: Approves pending booking
- **assignStuffService**: Assigns staff to booking
- **completeBookingService**: Marks booking as completed

### Payment Flow
**Wallet Payment**:
1. Validates wallet balance
2. Deducts from user wallet
3. Creates booking with paymentStatus = 'paid'
4. Creates transaction with commission split (gross, commission, net_amount)
5. Links booking to transaction

**Digital Payment** (Flutterwave):
1. Creates transaction record with pending status
2. Generates payment link
3. Client completes payment
4. Webhook updates transaction and booking

**Cash Payment**:
1. Creates booking with paymentStatus = 'pending'
2. Partner can mark as paid later

---

## 4. TRANSACTION MODULE

### Transaction Model Schema
```javascript
{
  tx_ref: String (unique), // e.g., "txn_{timestamp}_{userId}"
  transaction_id: String, // From payment gateway
  user: ObjectId (ref: User), // Service buyer
  user_email: String,
  currency: String (default: USD),
  bank_name: String,
  booking: ObjectId (ref: Booking),
  booking_data: Object,
  meta: Object,
  partner: ObjectId (ref: User), // Service provider
  service: ObjectId (ref: Service),
  gross_amount: Number, // Total paid amount
  commission: Number, // Platform commission (10%)
  net_amount: Number, // Partner receives (90%)
  payment_status: String (enum: ['pending', 'successful', 'failed', 'refunded', 'paid', 'cancellation-fee']),
  payment_method: String (enum: ['card', 'wallet', 'transfer', 'cash'], default: 'card'),
  payout_status: String (enum: ['pending', 'hold', 'completed', 'refund'], default: 'hold'),
  paymentType: String (enum: ['credit']),
  payout_completed_at: Date,
  timestamps: { createdAt, updatedAt }
}
```

### Commission Structure
- **Rate**: 10% platform commission
- **Calculation**: 
  - commission = grossAmount × 0.10
  - netAmount = grossAmount - commission (what partner receives)

### Transaction Routes
| Method | Endpoint | Handler | Auth |
|--------|----------|---------|------|
| PATCH | `/cancel/:bookingId` | cancelBooking | user |
| PATCH | `/hold` | holdPayoutController | None |
| PATCH | `/complete` | doCompletePayoutController | None |
| POST | `/book` | bookController | user |
| POST | `/purchase-credit` | purchaseCreditController | user/partner |
| POST | `/` | initializePayment | None |
| GET | `/partner/all-payout` | allPayoutOfAPartnerController | partner |
| GET | `/all-transaction` | allTransactionController | None |
| GET | `/earning` | earningController | None |
| GET | `/all-payout` | allPayoutController | None |
| GET | `/pending-payout` | partnerMonthlySummaryController | None |
| GET | `/complete-payout` | partnerMonthlyCompletedPayoutController | None |

### Key Transaction Services
- **getAllTransactions**: Aggregates transactions by month/year with filters
- **allPayoutOfAPartnerService**: Gets partner payouts with pagination
- **getPlatformEarningTransactionsService**: Gets platform commissions
- Returns gross_amount, commission, net_amount, transaction_id

---

## 5. FEEDBACK MODULE

### Feedback Model Schema
```javascript
{
  sender: ObjectId (ref: User), // Person giving feedback
  targetUser: ObjectId (ref: User), // Person receiving feedback (partner)
  service: ObjectId (ref: Service, optional),
  isAppFeedback: Boolean (default: false),
  rating: Number (1-5),
  text: String, // Review text
  timestamps: { createdAt, updatedAt }
}
```

### Feedback Routes
| Method | Endpoint | Handler | Auth |
|--------|----------|---------|------|
| POST | `/add` | addFeedbackController | user |
| GET | `/my-feedback` | getMyFeedbackController | partner |
| GET | `/service/:serviceId` | serviceFeedbackController | None |
| GET | `/partner/:partnerId` | partnerFeedbackController | None |
| POST | `/reply` | replyController | partner |

### Key Feedback Services

#### serviceFeedbackService (for Service reviews)
- Filters by rating and sort (newest/oldest)
- Returns:
  - List of feedback with sender name/image
  - Rating statistics (count per rating: 1-5)
  - Average rating calculation

#### partnerFeedbackService (for Partner reviews)
- Similar structure, matches `targetUser` instead of `service`
- Returns feedback data with rating distribution

#### addFeedback
- Creates new feedback record
- Updates service ratings:
  - Increments totalRating, ratingCount
  - Calculates avgRating = totalRating / ratingCount

#### getMyFeedbackService
- Fetches feedback received by partner
- Supports filters: rating, date
- Pagination support

---

## 6. DATA RELATIONSHIPS & FLOWS

### Booking Lifecycle
```
1. User creates booking (bookingService)
   ├─ Sets session/expiry based on pass type
   ├─ Generates 4-digit PIN
   └─ Processes payment (cash/wallet/digital)

2. Partner approves booking (approveBookingService)
   └─ Changes status: pending → approved

3. Service execution
   ├─ Partner marks sessions as completed (markAsCompletedService)
   │  └─ Verifies PIN, decrements sessionLeft
   │  └─ When sessionLeft = 0, marks as completed
   └─ User provides feedback (serviceFeedbackService)
      └─ Updates service.avgRating, ratingCount, totalRating
```

### Revenue Flow
```
User Payment (wallet)
  ↓
Booking created (paymentStatus: paid)
  ↓
Transaction created
  ├─ gross_amount = totalPrice
  ├─ commission = gross_amount × 0.10 (platform)
  └─ net_amount = gross_amount - commission (partner)
  ↓
Payout Status: hold → pending → completed
```

### Rating System
```
Service Ratings (Feedback → Service)
├─ sender: User
├─ targetUser: Service provider (partner)
├─ service: ObjectId
├─ rating: 1-5
└─ Updates Service:
   ├─ totalRating += newRating
   ├─ ratingCount += 1
   └─ avgRating = totalRating / ratingCount

Partner Ratings (Feedback → Partner)
├─ sender: User
├─ targetUser: Partner user
├─ rating: 1-5
└─ Updates Partner model:
   ├─ totalRating += newRating
   ├─ ratingCount += 1
   └─ rating (avg) = totalRating / ratingCount
```

---

## 7. KEY ENDPOINTS SUMMARY

### Partner Discovery
- `GET /partner/all` - List all partners with filters
- `GET /partner/details/:id` - Full partner profile with services
- `GET /partner/:partnerId/feedback` - Partner reviews and ratings

### Booking Management
- `POST /booking/add` - Create booking (supports all payment methods)
- `GET /booking/upcoming-userend` - User's upcoming bookings
- `GET /booking/partner/upcoming` - Partner's pending approvals
- `PATCH /booking/mark-completed/:id` - Check-in with PIN
- `POST /booking/feedback/:id` - Leave service review

### Transactions & Payouts
- `GET /transaction/partner/all-payout` - Partner earnings
- `GET /transaction/all-transaction` - Admin transaction view
- `POST /transaction/book` - Initialize payment flow

### Reviews & Ratings
- `GET /feedback/service/:serviceId` - Service reviews with stats
- `GET /feedback/partner/:partnerId` - Partner reviews with stats
- `POST /feedback/add` - Submit review

---

## 8. AUTHENTICATION & AUTHORIZATION

### Auth Middleware
Uses role-based access control:
- `auth(['user'])` - User-only endpoints
- `auth(['partner'])` - Partner-only endpoints
- `auth(['admin'])` - Admin-only endpoints
- `auth(['user', 'partner'])` - Multiple roles allowed
- `auth(..., { optional: true })` - Optional authentication

### Key Protected Operations
- Booking creation: user role
- Booking approval: partner role
- Feedback submission: user/partner roles
- Transaction/payout access: partner role
- Admin operations: admin role

---

## 9. IMPORTANT NOTES

### Session & Expiry Management
- Sessions are per-booking, not per-pass
- Each booking tracks `sessionLeft` and `expireDate`
- User must complete sessions before expiry date
- PIN verification is required for each session completion

### Commission & Revenue
- Fixed 10% commission on all bookings
- Commission calculated at transaction creation
- Partner sees `net_amount` in payouts
- Platform sees `commission` in earnings

### Wallet System
- Users have `digitalWallet` field (rounded to 2 decimals)
- Wallet deduction is immediate on booking creation
- No refund on cancelled paid bookings shown in current code
- Can add credit via admin endpoint

### Ratings & Feedback
- Service has separate rating system from Partner rating
- Both are calculated as averages
- Ratings are 1-5 scale
- Can filter and sort feedback by rating and date

---

## 10. FILES REFERENCE

- Partner Module: `src/modules/Partner/`
- User Module: `src/modules/User/`
- Booking Module: `src/modules/Booking/`
- Transaction Module: `src/modules/Transaction/`
- FeedBack Module: `src/modules/FeedBack/`
