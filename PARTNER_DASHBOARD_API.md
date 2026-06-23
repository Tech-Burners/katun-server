# Partner Dashboard API Documentation

## Overview
This API provides comprehensive dashboard statistics for partners, showing key metrics about their bookings, earnings, and performance.

## Endpoints

### GET `/overview/partner/count`

**Authentication**: Required (Partner role)

**Headers**:
```
Authorization: Bearer <token>
Content-Type: application/json
```

### GET `/overview/partner/booking-trend`

**Authentication**: Required (Partner role)

**Query Parameters**:
- `year` (optional) - numeric year to fetch trend for, defaults to current year.

**Headers**:
```
Authorization: Bearer <token>
Content-Type: application/json
```

### GET `/overview/partner/earning-overview`

**Authentication**: Required (Partner role)

**Query Parameters**:
- `year` (optional) - numeric year to fetch earnings for, defaults to current year.

**Headers**:
```
Authorization: Bearer <token>
Content-Type: application/json
```

### Legacy partner dashboard endpoint

The legacy endpoint still exists at:

### GET `/api/partner/dashboard`

**Authentication**: Required (Partner role)

**Headers**:
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Query Parameters**:
- `year` (optional) - numeric year to fetch the booking trend for. Defaults to the current year.

## Response

### Success Response (200 OK)

```json
{
  "status": "success",
  "statusCode": 200,
  "type": "partner-dashboard",
  "message": "Partner dashboard data fetched successfully",
  "data": {
    "upcomingBookings": 5,
    "completedBookings": 42,
    "bookingTrend": [
      { "month": "Jan", "bookings": 2 },
      { "month": "Feb", "bookings": 5 },
      { "month": "Mar", "bookings": 3 },
      { "month": "Apr", "bookings": 4 },
      { "month": "May", "bookings": 6 },
      { "month": "Jun", "bookings": 1 },
      { "month": "Jul", "bookings": 0 },
      { "month": "Aug", "bookings": 0 },
      { "month": "Sep", "bookings": 2 },
      { "month": "Oct", "bookings": 3 },
      { "month": "Nov", "bookings": 1 },
      { "month": "Dec", "bookings": 0 }
    ],
    "earningTrend": [
      { "month": "Jan", "earnings": 1500.00 },
      { "month": "Feb", "earnings": 1800.25 },
      { "month": "Mar", "earnings": 1320.00 },
      { "month": "Apr", "earnings": 1800.50 },
      { "month": "May", "earnings": 2100.00 },
      { "month": "Jun", "earnings": 950.75 },
      { "month": "Jul", "earnings": 0 },
      { "month": "Aug", "earnings": 0 },
      { "month": "Sep", "earnings": 1200.00 },
      { "month": "Oct", "earnings": 1400.00 },
      { "month": "Nov", "earnings": 1100.00 },
      { "month": "Dec", "earnings": 0 }
    ],
    "avgRating": 4.8,
    "totalRating": 48,
    "totalEarning": 15250.50,
    "pendingPayoutCount": 3,
    "pendingPayoutAmount": 2100.75,
    "digitalWallet": 500.00
  }
}
```

## Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `upcomingBookings` | Number | Count of pending and approved bookings |
| `completedBookings` | Number | Total number of completed bookings |
| `avgRating` | Number | Average rating of the partner (0-5) |
| `totalRating` | Number | Total rating count |
| `totalEarning` | Number | Total earnings from successful transactions (partner's net amount) |
| `pendingPayoutCount` | Number | Number of transactions pending payout |
| `pendingPayoutAmount` | Number | Total amount pending payout |
| `digitalWallet` | Number | Current digital wallet balance |
| `earningTrend` | Array | Monthly earnings overview for the selected year |

## Data Aggregation

The dashboard aggregates data from multiple sources:

1. **Upcoming Bookings**: From `Booking` collection where:
   - `provider` = authenticated partner's user ID
   - `status` = 'pending' OR 'approved'

2. **Completed Bookings**: From `Booking` collection where:
   - `provider` = authenticated partner's user ID
   - `status` = 'completed'

3. **Average Rating**: From `Partner` model's `rating` field

4. **Total Earning**: Sum of `net_amount` from `Transaction` collection where:
   - `partner` = partner's user ID
   - `payment_status` = 'successful'

5. **Pending Payouts**: From `Transaction` collection where:
   - `partner` = partner's user ID
   - `payout_status` = 'pending'
   - `payment_status` = 'successful'

6. **Digital Wallet**: From `User` model's `digitalWallet` field

## Example Usage

### Using cURL
```bash
curl -X GET http://localhost:3000/api/partner/dashboard \
  -H "Authorization: Bearer your_jwt_token" \
  -H "Content-Type: application/json"
```

### Using JavaScript/Fetch
```javascript
const response = await fetch('http://localhost:3000/api/partner/dashboard', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});

const data = await response.json();
console.log(data);
```

### Using Axios
```javascript
const axios = require('axios');

const response = await axios.get('http://localhost:3000/api/partner/dashboard', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});

console.log(response.data);
```

## Files Modified

1. **[partner.service.js](src/modules/Partner/partner.service.js)**
   - Added `bookingModel` and `transactionModel` imports
   - Created `partnerDashboardService()` function
   - Added service to module exports

2. **[partner.controller.js](src/modules/Partner/partner.controller.js)**
   - Added `partnerDashboardService` to imports
   - Created `partnerDashboardController()` function
   - Added controller to module exports

3. **[partner.route.js](src/modules/Partner/partner.route.js)**
   - Added `partnerDashboardController` to imports
   - Added GET route: `router.get('/dashboard', auth(['partner']), partnerDashboardController)`

## Error Handling

The API uses the existing error handling middleware. Common errors:

| Error | Status | Message |
|-------|--------|---------|
| Unauthorized | 401 | No valid authentication token |
| Forbidden | 403 | User is not a partner |
| Not Found | 404 | Partner not found for user |
| Server Error | 500 | Internal server error |

## Notes

- All monetary values are rounded to 2 decimal places
- The `avgRating` is calculated from the partner's cumulative ratings
- `pendingPayoutAmount` only includes amounts from successful transactions
- The digital wallet represents the partner's available balance for withdrawals
