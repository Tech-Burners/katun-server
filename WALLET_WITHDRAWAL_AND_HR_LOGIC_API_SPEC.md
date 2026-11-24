# AuraVive — Wallet, Credit Breakdown, Withdrawal & HR Logic Integration Specification

> **Target Audience:** Mobile App Developers (Flutter / React Native / iOS / Android), Frontend Web Developers, and AI coding assistants.
> **Scope:** Complete guide for implementing Customer Wallet screens, Credit Withdrawal flows, Balance breakdowns, and Admin/HR credit reclamation.
> **Currency:** Nigerian Naira (₦ / NGN)

---

## 1. Executive Summary & Core Business Rules

AuraVive operates a hybrid wallet system distinguishing between **company-funded credits** and **customer-funded credits**:

| Credit Type | Database Field | Definition | Withdrawable? |
|---|---|---|---|
| **Total Credit / Wallet Balance** | `digitalWallet` / `totalCredit` / `balance` | Total spendable balance available for booking services. | Partial (only self-funded portion) |
| **Withdrawable Credit** | `withdrawableCredit` / `rechargedCredit` | Funds deposited/topped up directly by the customer. | **YES** (up to available balance) |
| **Allocated Credit** | `allocatedCredit` / `nonWithdrawableCredit` | Credits gifted or allocated to the user by a Corporate HR/Company employer. | **NO** (Locked for bookings only) |

### Key Business Logic
1. **Non-Withdrawable HR Credits:** Any credit allocated by an employer HR to an employee cannot be cashed out or withdrawn to a bank account. It can only be spent on AuraVive services.
2. **Withdrawable Self Top-ups:** When a customer adds money to their wallet (via Flutterwave), 100% of that top-up is withdrawable.
3. **Smart Spending Priority:** When a customer books a service and pays with wallet credit:
   - The server **burns HR-allocated credit first**.
   - It only burns self-topped-up credit after all allocated credit has been depleted.
   - *Result:* The customer preserves their withdrawable cash balance for as long as possible!
4. **Admin Manual Reclaim to HR:** If an employee has unused HR credit after a period of time, an Admin can manually reclaim the unused portion from the employee's wallet and return it to the company's credit balance.

---

## 2. Authentication, Request Headers & Role Rules (MANDATORY)

Every wallet and transaction endpoint requires proper authentication headers and the correct user role. Failure to supply the exact headers will result in `401 Unauthorized` or `401 You are not authorized`.

### 2.1 Standard Request Headers

Every request from the mobile application (Flutter / React Native / iOS / Android) or frontend web MUST include:

| Header Key | Header Value | Description |
|---|---|---|
| `Authorization` | `Bearer <JWT_ACCESS_TOKEN>` | **Mandatory.** The access token returned upon login. |
| `Content-Type` | `application/json` | **Mandatory** for POST, PATCH, PUT requests. |
| `Accept` | `application/json` | Recommended for all requests. |

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
Accept: application/json
```

---

### 2.2 Crucial: User Role Matrix & Avoiding `401 "You are not authorized"`

The server strictly verifies the **`role`** encoded inside the JWT payload against allowed roles for that route:

```javascript
// Server middleware: src/middlewares/auth.js
if (userRoles && !userRoles.includes(decodedData.role)) {
  throw new ApiError(status.UNAUTHORIZED, "You are not authorized");
}
```

> [!WARNING]
> If the client sends a token belonging to a **Partner (`role: "partner"`)**, **Admin**, or **HR** to a Customer User endpoint (or vice versa), the server immediately returns:
> ```json
> {
>   "status": "Error",
>   "statusCode": 401,
>   "message": "You are not authorized",
>   "data": { "type": "Error" },
>   "errors": []
> }
> ```

#### Endpoint vs Allowed Role Reference Table

| Endpoint | Method | Allowed JWT Roles | Can Partner Call? | Can Customer User Call? |
|---|---|---|:---:|:---:|
| `/api/v1/overview/user/wallet-transactions` | `GET` | `['user']` | ❌ **No** (`401`) | ✅ **Yes** |
| `/api/v1/auth/my-profile` | `GET` | `['user', 'partner', 'hr', 'admin']` | ✅ Yes | ✅ Yes |
| `/api/v1/transaction/withdraw-credit` | `PATCH` | `['user', 'partner']` | ✅ Yes | ✅ Yes |
| `/api/v1/transaction/purchase-credit` | `POST` | `['user', 'partner', 'hr']` | ✅ Yes | ✅ Yes |
| `/api/v1/overview/partner/earning-overview` | `GET` | `['partner']` | ✅ **Yes** | ❌ **No** (`401`) |
| `/api/v1/allocate/reclaim-to-hr` | `PATCH` / `POST` | `['admin', 'sub_admin']` | ❌ No | ❌ No |

#### How to Check Token Role
Paste your token into [jwt.io](https://jwt.io) and verify the payload:
```json
{
  "_id": "673f1234567890abcdef1234",
  "fullName": "Jane Doe",
  "email": "jane@example.com",
  "role": "user",        <--- MUST BE "user" for customer wallet endpoints!
  "tokenVersion": 0
}
```

---

## 3. Customer Mobile App Integration

### 3.1 Screen: Wallet & Balance Overview

#### API Endpoint
- **URL:** `{{BASE_URL}}/api/v1/overview/user/wallet-transactions`
- **Method:** `GET`
- **Required Headers:**
  - `Authorization: Bearer <USER_JWT_TOKEN>` *(Must have `role: "user"`)*
  - `Content-Type: application/json`
  - `Accept: application/json`
- **Query Parameters:**
  - `page`: (optional, integer, default: `1`)
  - `limit`: (optional, integer, default: `10`)

#### Example cURL Request:
```bash
curl -X GET "https://api.auravive.com/api/v1/overview/user/wallet-transactions?page=1&limit=10" \
  -H "Authorization: Bearer YOUR_USER_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json"
```

#### Response Structure (`200 OK`)
```json
{
  "status": "ok",
  "statusCode": 200,
  "message": "user-wallet-and-transactions",
  "data": {
    "totalCredit": 15000.00,
    "digitalWallet": 15000.00,
    "balance": 15000.00,
    "withdrawableCredit": 5000.00,
    "withdrawableAmount": 5000.00,
    "allocatedCredit": 10000.00,
    "nonWithdrawableCredit": 10000.00,
    "rechargedCredit": 5000.00,
    "isCompanyEmployee": true,
    "transactions": [
      {
        "_id": "6640abc...",
        "gross_amount": 3500.00,
        "createdAt": "2026-11-20T10:15:30.000Z",
        "payment_status": "successful",
        "payment_method": "wallet",
        "paymentType": "booking",
        "serviceName": "Swedish Massage",
        "tx_ref": "txn_1795063884950_8787caa1..."
      }
    ],
    "pagination": {
      "totalResults": 25,
      "totalPages": 3,
      "currentPage": 1,
      "limit": 10
    }
  }
}
```

#### Client UI Guidelines
- **Main Balance Card:** Show `data.totalCredit` (or `data.digitalWallet`) formatted as `₦15,000.00`.
- **Sub-Breakdown Card:**
  - **Withdrawable Balance:** `₦5,000.00` (`data.withdrawableCredit`). Add a helper label: *"Available for bank transfer withdrawal"*.
  - **HR / Corporate Credit:** `₦10,000.00` (`data.allocatedCredit`). Add an info badge or tooltip: *"Provided by your employer. Non-withdrawable; valid for booking any service on AuraVive"*.
- **"Withdraw" Button:**
  - Disable or show an alert if `data.withdrawableCredit <= 0`.
  - Display the maximum withdrawable limit dynamically on the withdrawal modal: `Max: ₦${data.withdrawableCredit}`.

---

### 3.2 Screen: Profile Details

#### API Endpoint
- **URL:** `{{BASE_URL}}/api/v1/auth/my-profile`
- **Method:** `GET`
- **Required Headers:**
  - `Authorization: Bearer <JWT_ACCESS_TOKEN>` *(Allowed roles: `user`, `partner`, `hr`, `admin`)*
  - `Accept: application/json`

#### Example cURL Request:
```bash
curl -X GET "https://api.auravive.com/api/v1/auth/my-profile" \
  -H "Authorization: Bearer YOUR_USER_ACCESS_TOKEN" \
  -H "Accept: application/json"
```

#### Response Data for `role === 'user'`
```json
{
  "statusCode": 200,
  "status": "OK",
  "type": "user",
  "message": "User details",
  "data": {
    "name": "Jane Doe",
    "email": "jane@example.com",
    "image": "/uploads/users/user.jpg",
    "number": "08012345678",
    "countryCode": "+234",
    "address": "Victoria Island, Lagos",
    "location": {
      "type": "Point",
      "coordinates": [3.4219, 6.4281]
    },
    "digitalWallet": 15000.00,
    "totalCredit": 15000.00,
    "balance": 15000.00,
    "withdrawableCredit": 5000.00,
    "withdrawableAmount": 5000.00,
    "allocatedCredit": 10000.00,
    "rechargedCredit": 5000.00,
    "isCompanyEmployee": true
  }
}
```

---

### 3.3 Screen: Withdraw Credit (Cash-Out)

Allows customers or partners to withdraw their self-funded balance to their verified bank account.

#### API Endpoint
- **URL:** `{{BASE_URL}}/api/v1/transaction/withdraw-credit`
- **Method:** `PATCH`
- **Required Headers:**
  - `Authorization: Bearer <JWT_ACCESS_TOKEN>` *(Allowed roles: `user`, `partner`)*
  - `Content-Type: application/json`
  - `Accept: application/json`

#### Example cURL Request:
```bash
curl -X PATCH "https://api.auravive.com/api/v1/transaction/withdraw-credit" \
  -H "Authorization: Bearer YOUR_USER_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"amount": 5000}'
```

#### Request Payload
```json
{
  "amount": 5000
}
```

#### Field Validation Rules
| Field | Type | Validation Rules |
|---|---|---|
| `amount` | `Number` | Required, $> 0$, must not exceed `withdrawableCredit`. |

#### Success Response (`200 OK`)
```json
{
  "status": "success",
  "statusCode": 200,
  "type": "Transaction",
  "message": "withdraw successfully",
  "data": {
    "_id": "673f1234...",
    "tx_ref": "withdraw_1795064000000_664...",
    "user": "6640abc...",
    "currency": "NGN",
    "gross_amount": 5000,
    "net_amount": 5000,
    "payment_method": "wallet",
    "paymentType": "withdraw",
    "status": "successful",
    "payment_status": "successful",
    "payout_status": "pending",
    "createdAt": "2026-11-23T10:00:00.000Z"
  }
}
```

---

### 3.4 Screen: Top-Up / Purchase Credit (Self Deposit)

Allows customers to fund their wallet via card or mobile money using Flutterwave. 100% of these funds are withdrawable.

#### API Endpoint
- **URL:** `{{BASE_URL}}/api/v1/transaction/purchase-credit`
- **Method:** `POST`
- **Required Headers:**
  - `Authorization: Bearer <JWT_ACCESS_TOKEN>` *(Allowed roles: `user`, `partner`, `hr`)*
  - `Content-Type: application/json`
  - `Accept: application/json`

#### Example cURL Request:
```bash
curl -X POST "https://api.auravive.com/api/v1/transaction/purchase-credit" \
  -H "Authorization: Bearer YOUR_USER_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "amount": 10000,
    "paymentMethod": "flutterwave"
  }'
```

#### Request Payload
```json
{
  "amount": 10000,
  "paymentMethod": "flutterwave"
}
```

#### Response Structure (`200 OK`)
Returns the Flutterwave payment gateway checkout URL for the mobile app webview:
```json
{
  "statusCode": 200,
  "status": "OK",
  "message": "Payment initiated successfully",
  "data": {
    "paymentUrl": "https://checkout.flutterwave.com/v3/hosted/pay/...",
    "tx_ref": "txn_1795064112233_a9b8c7d6..."
  }
}
```
    "payout_status": "pending",
    "createdAt": "2026-11-23T10:00:00.000Z"
  }
}
```

#### Error Handling for the App
1. **User only has HR credit (Withdrawable is 0):**
   - **HTTP Status:** `400 Bad Request`
   - **Response Body:**
     ```json
     {
       "statusCode": 400,
       "message": "Credits allocated by HR/company cannot be withdrawn. Only self-topped-up credits can be withdrawn."
     }
     ```
   - **Client action:** Display popup: *"Corporate credits cannot be withdrawn. They can only be used to book wellness services."*

2. **User requests more than their withdrawable credit:**
   - **HTTP Status:** `412 Precondition Failed`
   - **Response Body:**
     ```json
     {
       "statusCode": 412,
       "message": "Insufficient withdrawable balance. You can only withdraw up to your topped-up amount (5000.00 NGN). HR-allocated credits cannot be withdrawn."
     }
     ```
   - **Client action:** Highlight the input field in red: *"Amount exceeds your withdrawable balance of ₦5,000.00"*.

3. **User requests more than their total wallet balance:**
   - **HTTP Status:** `412 Precondition Failed`
   - **Response Body:**
     ```json
     {
       "statusCode": 412,
       "message": "Insufficient balance"
     }
     ```

---

## 3. Admin & HR Management Integration

### 3.1 Screen: Admin View All Employees
Admin needs to see which employees have unused allocated credits to decide on reclamation.

#### API Endpoint
- **URL:** `{{BASE_URL}}/api/v1/employee/admin/all`
- **Method:** `GET`
- **Headers:**
  - `Authorization: Bearer <admin_jwt_token>`
- **Response Item Projection:**
```json
{
  "employeeId": "6641def...",
  "userId": "6640abc...",
  "employeeName": "John Doe",
  "email": "john.doe@company.com",
  "number": "08099887766",
  "companyName": "Acme Global",
  "companyId": "6630111...",
  "wallet": 12000.00,
  "digitalWallet": 12000.00,
  "allocatedCredit": 10000.00,
  "rechargedCredit": 2000.00,
  "credit": 10000.00,
  "status": "active"
}
```

---

### 3.2 Screen: Admin Manual Reclaim to HR (Single Employee)
Sends back unused HR-allocated credit from an employee's wallet directly into the employer's company credit balance.

#### API Endpoint
- **URL:** `{{BASE_URL}}/api/v1/employee/reclaim-credit/:employeeId`
- **Method:** `PATCH` or `POST`
- **Headers:**
  - `Authorization: Bearer <admin_jwt_token>`
  - `Content-Type: application/json`

#### Request Payload
```json
{
  "amount": 5000
}
```
> **Tip:** If `amount` is omitted or passed as `"all"`, the server automatically reclaims **all** unused HR-allocated credit (`Math.min(user.allocatedCredit, user.digitalWallet)`).

#### Success Response (`200 OK`)
```json
{
  "status": "success",
  "statusCode": 200,
  "type": "Employee",
  "message": "Unused credit reclaimed to HR successfully",
  "data": {
    "employeeId": "6641def...",
    "employeeName": "John Doe",
    "companyId": "6630111...",
    "companyName": "Acme Global",
    "reclaimedAmount": 5000.00,
    "userDigitalWallet": 7000.00,
    "userAllocatedCredit": 5000.00,
    "userRechargedCredit": 2000.00,
    "companyCreditBalance": 255000.00
  }
}
```

#### Error Responses
- **If employee has 0 unused allocated credit:**
  `HTTP 400`: `"This employee has no unused allocated credit to return to HR."`
- **If requested amount exceeds available unused credit:**
  `HTTP 400`: `"Requested amount (12000 NGN) exceeds available unused allocated credit (10000 NGN)."`

---

### 3.3 Screen: Admin Bulk Reclaim
Allows admin to reclaim unused credits from multiple employees simultaneously (e.g., at the end of a quarterly validity period).

#### API Endpoint
- **URL:** `{{BASE_URL}}/api/v1/employee/bulk-reclaim-credit`
- **Method:** `PATCH` or `POST`
- **Headers:**
  - `Authorization: Bearer <admin_jwt_token>`
  - `Content-Type: application/json`

#### Request Payload
```json
{
  "employeeIds": [
    "6641def123...",
    "6641def456...",
    "6641def789..."
  ],
  "amount": "all"
}
```

#### Success Response (`200 OK`)
```json
{
  "status": "success",
  "statusCode": 200,
  "type": "Employee",
  "message": "Bulk reclaim of unused credit to HR processed successfully",
  "data": {
    "totalReclaimed": 28500.00,
    "processedCount": 3,
    "details": [
      {
        "employeeId": "6641def123...",
        "employeeName": "John Doe",
        "reclaimedAmount": 10000.00,
        "remainingWallet": 2000.00
      },
      {
        "employeeId": "6641def456...",
        "employeeName": "Jane Smith",
        "reclaimedAmount": 8500.00,
        "remainingWallet": 0.00
      },
      {
        "employeeId": "6641def789...",
        "employeeName": "Mark Williams",
        "reclaimedAmount": 10000.00,
        "remainingWallet": 5000.00
      }
    ]
  }
}
```

---

### 3.4 Unified Allocate Module Endpoint
For systems integrating via the `/api/v1/allocate` path:
- **URL:** `{{BASE_URL}}/api/v1/allocate/reclaim-to-hr`
- **Method:** `POST` or `PATCH`
- **Headers:** `Authorization: Bearer <admin_jwt_token>`
- **Payload Options:**
  - Option A: `{ "employeeId": "664...", "amount": 5000 }`
  - Option B: `{ "employeeIds": ["664...", "665..."], "amount": "all" }`
  - Option C: `{ "userId": "663...", "companyId": "662...", "amount": 5000 }`

---

## 4. Worked Scenario Walkthrough

Let us trace a real customer journey:

```
Step 1: HR Allocation
- HR allocates ₦20,000 to Employee "Tola".
- Tola's Wallet:
    totalCredit:        ₦20,000
    allocatedCredit:    ₦20,000
    rechargedCredit:    ₦0
    withdrawableCredit: ₦0
- Tola tries to withdraw ₦5,000:
    -> REJECTED (HTTP 400: Credits allocated by HR cannot be withdrawn).

Step 2: Customer Self Top-Up
- Tola tops up ₦10,000 of her own money using card via Flutterwave.
- Tola's Wallet:
    totalCredit:        ₦30,000
    allocatedCredit:    ₦20,000
    rechargedCredit:    ₦10,000
    withdrawableCredit: ₦10,000

Step 3: Service Booking (Smart Spending)
- Tola books a Facial Spa service costing ₦15,000 using wallet payment.
- Server automatically burns allocated credit first:
    allocatedCredit decreases by ₦15,000 -> ₦5,000 remaining.
    rechargedCredit stays untouched! -> ₦10,000 remaining.
- Tola's Wallet after booking:
    totalCredit:        ₦15,000
    allocatedCredit:    ₦5,000
    rechargedCredit:    ₦10,000
    withdrawableCredit: ₦10,000 (still has her full topped-up cash available!)

Step 4: Customer Withdrawal
- Tola withdraws ₦7,000 to her GTBank account.
- Server verifies: ₦7,000 <= withdrawableCredit (₦10,000) -> APPROVED!
- Tola's Wallet after withdrawal:
    totalCredit:        ₦8,000
    allocatedCredit:    ₦5,000
    rechargedCredit:    ₦3,000
    withdrawableCredit: ₦3,000

Step 5: Admin Period-End Reclaim
- 60 days pass. The company policy requires reclaiming unused HR credit.
- Admin checks Tola:
    unusedAllocatedCredit = min(allocatedCredit: ₦5,000, totalCredit: ₦8,000) = ₦5,000.
- Admin calls reclaim with "all":
    - ₦5,000 is sent back into the Company's creditBalance.
    - Tola's allocatedCredit becomes ₦0.
    - Tola's totalCredit becomes ₦3,000.
    - Tola's withdrawableCredit remains ₦3,000 (her remaining personal deposit).
```

---

## 5. Mobile App (Flutter / Dart) Complete Integration Code

Here is ready-to-use production Flutter code using `dio` and `http` handling tokens, headers, and error parsing.

### 5.1 Dio Implementation with Auth Interceptor

```dart
import 'package:dio/dio.dart';

class WalletApiClient {
  final Dio _dio;
  final String baseUrl;
  final Future<String?> Function() getUserToken;

  WalletApiClient({
    required this.baseUrl,
    required this.getUserToken,
  }) : _dio = Dio(BaseOptions(
          baseUrl: baseUrl,
          connectTimeout: const Duration(seconds: 15),
          receiveTimeout: const Duration(seconds: 15),
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
        )) {
    // Attach JWT Bearer Token automatically
    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final token = await getUserToken();
          if (token != null && token.isNotEmpty) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          return handler.next(options);
        },
        onError: (DioException error, handler) {
          if (error.response?.statusCode == 401) {
            final message = error.response?.data?['message'] ?? '';
            if (message == 'You are not authorized') {
              // CAUTION: Logged in with wrong role (e.g. Partner token used on User API)
              print('CRITICAL: Token role does not match endpoint role requirement!');
            } else if (message == 'Session expired. Please login again.') {
              // Token expired or invalidated -> redirect to login screen
              print('Session expired. Redirecting to login...');
            }
          }
          return handler.next(error);
        },
      ),
    );
  }

  /// 1. Fetch Wallet Balance & Transaction History
  Future<Map<String, dynamic>> getWalletOverview({int page = 1, int limit = 10}) async {
    final response = await _dio.get(
      '/api/v1/overview/user/wallet-transactions',
      queryParameters: {'page': page, 'limit': limit},
    );
    return response.data['data'];
  }

  /// 2. Withdraw Withdrawable Credit
  Future<Map<String, dynamic>> withdrawCredit({required double amount}) async {
    final response = await _dio.patch(
      '/api/v1/transaction/withdraw-credit',
      data: {'amount': amount},
    );
    return response.data['data'];
  }

  /// 3. Top-Up Wallet Balance via Flutterwave
  Future<String> purchaseCredit({required double amount}) async {
    final response = await _dio.post(
      '/api/v1/transaction/purchase-credit',
      data: {
        'amount': amount,
        'paymentMethod': 'flutterwave',
      },
    );
    // Returns checkout URL to open in WebView or external browser
    return response.data['data']['paymentUrl'];
  }
}
```

### 5.2 Native `http` Package Implementation

```dart
import 'dart:convert';
import 'package:http/http.dart' as http;

class WalletHttpService {
  final String baseUrl;
  final String userToken; // MUST be token with role: 'user'

  WalletHttpService({required this.baseUrl, required this.userToken});

  Map<String, String> get _headers => {
        'Authorization': 'Bearer $userToken',
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      };

  Future<Map<String, dynamic>> fetchWallet({int page = 1, int limit = 10}) async {
    final url = Uri.parse('$baseUrl/api/v1/overview/user/wallet-transactions?page=$page&limit=$limit');
    final res = await http.get(url, headers: _headers);

    if (res.statusCode == 200) {
      final jsonBody = jsonDecode(res.body);
      return jsonBody['data'];
    } else if (res.statusCode == 401) {
      throw Exception('Unauthorized: Ensure your token has role "user"');
    } else {
      throw Exception('Failed to load wallet: ${res.body}');
    }
  }

  Future<void> requestWithdrawal(double amount) async {
    final url = Uri.parse('$baseUrl/api/v1/transaction/withdraw-credit');
    final res = await http.patch(
      url,
      headers: _headers,
      body: jsonEncode({'amount': amount}),
    );

    if (res.statusCode == 200) {
      return; // Success!
    } else {
      final errorJson = jsonDecode(res.body);
      throw Exception(errorJson['message'] ?? 'Withdrawal failed');
    }
  }
}
```

---

## 6. Client Implementation Checklist for AI Agents

When prompting an AI (or writing client code) to update the User App or Admin Panel, follow this checklist:

```markdown
- [ ] In the User Mobile App:
      - [ ] Bind `totalCredit` to the main Wallet balance card.
      - [ ] Add breakdown display: "Withdrawable Cash" (`withdrawableCredit`) and "Company Credits" (`allocatedCredit`).
      - [ ] In the Withdraw Modal:
            - Set the max withdrawal limit to `withdrawableCredit`.
            - Validate input `amount <= withdrawableCredit` before calling API.
            - Handle HTTP 400 and HTTP 412 errors with user-friendly error banners.
      - [ ] Call `GET /api/v1/overview/user/wallet-transactions` on screen pull-to-refresh.

- [ ] In the Admin Web Panel:
      - [ ] In the Employee Table, display columns: "Total Wallet", "Company Credit", "Self Top-Up".
      - [ ] Add an action button: "Reclaim HR Credit" on employee rows having `allocatedCredit > 0`.
      - [ ] Open modal asking for amount (default "All Unused: ₦X").
      - [ ] On submit, call `PATCH /api/v1/employee/reclaim-credit/:employeeId` and refresh table.
      - [ ] Add bulk selection checkbox to trigger `PATCH /api/v1/employee/bulk-reclaim-credit`.
```
