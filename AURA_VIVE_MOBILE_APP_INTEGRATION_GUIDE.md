# AuraVive — Mobile App Integration Guide (User App & Provider App)

> **Audience:** Mobile App Developers (Flutter / React Native / iOS / Android) & AI Coding Assistants.  
> **Backend Base URL:** `https://api.auravive.ng` (Production) / `http://localhost:8047` (Local/Dev)  
> **Currency:** Nigerian Naira (₦ / NGN)  
> **Auth Header:** `Authorization: Bearer <JWT_ACCESS_TOKEN>` on all protected endpoints.

---

## Table of Contents
1. [Architecture & System Overview](#1-architecture--system-overview)
2. [PART 1: Customer / User App (`user` role)](#2-part-1-customer--user-app-user-role)
   - [2.1 Wallet Architecture & 3-Balance Rule](#21-wallet-architecture--3-balance-rule)
   - [2.2 Wallet Overview API (`GET /api/v1/auth/me` or `/api/v1/overview/user-overview`)](#22-wallet-overview-api)
   - [2.3 Top-Up Credit API (`POST /api/v1/transaction/purchase-credit`)](#23-top-up-credit-api)
   - [2.4 Withdrawal API & Validation (`PATCH /api/v1/transaction/withdraw-credit`)](#24-withdrawal-api--validation)
   - [2.5 Smart Spending Priority (Booking with Wallet)](#25-smart-spending-priority)
   - [2.6 Displaying Provider Badges (`isVerified` & `isCertified`)](#26-displaying-provider-badges)
3. [PART 2: Provider / Partner App (`partner` role)](#3-part-2-provider--partner-app-partner-role)
   - [3.1 Earnings & Payout System (No HR Restrictions)](#31-earnings--payout-system)
   - [3.2 Verification & Certification Badges Management](#32-verification--certification-badges-management)
   - [3.3 Document Upload APIs for Badges](#33-document-upload-apis-for-badges)
   - [3.4 Provider Earnings & Cashout Endpoints](#34-provider-earnings--cashout-endpoints)
4. [PART 3: Production Flutter / Dart Code Snippets](#4-part-3-production-flutter--dart-code-snippets)
   - [4.1 Dart Models (`WalletOverview` & `PartnerBadges`)](#41-dart-models)
   - [4.2 Provider Badge Flutter Widgets](#42-provider-badge-flutter-widgets)
   - [4.3 Customer Wallet Screen Flutter Widget](#43-customer-wallet-screen-flutter-widget)
   - [4.4 Withdrawal Bottom Sheet with Validation](#44-withdrawal-bottom-sheet-with-validation)
5. [PART 4: Error Handling & Status Codes Reference](#5-part-4-error-handling--status-codes-reference)

---

## 1. Architecture & System Overview

AuraVive operates two primary mobile app experiences:

```
┌───────────────────────────────────────────────┐
│              AuraVive Ecosystem               │
├───────────────────────┬───────────────────────┤
│    USER / CUSTOMER    │   PROVIDER / PARTNER  │
│         APP           │          APP          │
├───────────────────────┼───────────────────────┤
│ • Hybrid Wallet       │ • Earnings & Payouts  │
│   (HR vs Self-funded) │ • 100% Withdrawable   │
│ • Service Booking     │ • Badge Verification  │
│ • Provider Badges     │ • Document Management │
└───────────────────────┴───────────────────────┘
```

---

## 2. PART 1: Customer / User App (`user` role)

### 2.1 Wallet Architecture & 3-Balance Rule

The Customer wallet has a hybrid structure separating **Company-allocated wellness benefits** from **Self-topped-up personal funds**:

| Balance Field | Label in UI | Can Withdraw? | Description |
|:---|:---|:---:|:---|
| `digitalWallet` / `totalCredit` | **Total Balance** | **Partial** | Total spendable credits for booking wellness services on AuraVive. |
| `withdrawableCredit` / `rechargedCredit` | **Withdrawable Balance** | **YES ✅** | Funds the user topped up using their own card or bank. Can be cashed out anytime. |
| `nonWithdrawableCredit` / `allocatedCredit` | **HR / Company Credit** | **NO ❌** | Credits gifted by an employer HR. Valid only for booking services. |

---

### 2.2 Wallet Overview API

Fetch customer profile and wallet details:

```http
GET /api/v1/auth/me
Authorization: Bearer <ACCESS_TOKEN>
```
*Alternative Endpoint:* `GET /api/v1/overview/user-overview`

#### Response (`200 OK`):
```json
{
  "statusCode": 200,
  "status": "success",
  "message": "User fetched successfully",
  "data": {
    "_id": "6a71ab5354967feecb22cf40",
    "fullName": "Jane Doe",
    "email": "jane@auravive.com",
    "role": "user",
    "digitalWallet": 25000,
    "totalCredit": 25000,
    "balance": 25000,
    "withdrawableCredit": 10000,
    "withdrawableAmount": 10000,
    "allocatedCredit": 15000,
    "nonWithdrawableCredit": 15000,
    "rechargedCredit": 10000,
    "isCompanyEmployee": true
  }
}
```

#### UI Rules for Mobile Dev:
1. Show **Total Balance (`digitalWallet`)** as the primary hero card (`₦25,000`).
2. Show a 2-column or horizontal pill breakdown:
   - 💳 **Withdrawable:** `₦10,000` (Self Top-up)
   - 🏢 **Company Credit:** `₦15,000` (Non-withdrawable)

---

### 2.3 Top-Up Credit API

When a customer wants to add money to their wallet:

```http
POST /api/v1/transaction/purchase-credit
Authorization: Bearer <ACCESS_TOKEN>
Content-Type: application/json

{
  "amount": 5000
}
```

#### Response (`200 OK`):
```json
{
  "status": "success",
  "statusCode": 200,
  "type": "Transaction",
  "message": "Payment link generated successfully",
  "data": {
    "paymentLink": "https://api.auravive.ng/api/v1/transaction/pay/FLWP-69e1ab30f40",
    "tx_ref": "auravive-topup-1732440000000"
  }
}
```

#### Mobile App Implementation:
1. Open `data.paymentLink` in an in-app `WebView` (or external browser).
2. The user completes payment via card, bank transfer, or USSD.
3. Listen for redirect URL or poll `GET /api/v1/auth/me` upon returning to the app to refresh the wallet balance.

---

### 2.4 Withdrawal API & Validation

A customer can only withdraw funds up to their `withdrawableCredit`.

```http
PATCH /api/v1/transaction/withdraw-credit
Authorization: Bearer <ACCESS_TOKEN>
Content-Type: application/json

{
  "amount": 5000
}
```

#### Frontend / Mobile Validation Rules:
1. **Button Disabled Check:** If `withdrawableCredit <= 0`, disable the "Withdraw" button.
2. **Input Max Limit:** Maximum input allowed is `withdrawableCredit`. If user types `15000` while `withdrawableCredit` is `10000`, show error:
   > *"You can only withdraw up to ₦10,000. ₦15,000 is company-allocated credit and can only be used for bookings."*
3. **Info Banner:** Display this note below the withdrawal input:
   > ℹ️ *"Corporate wellness credits allocated by your employer cannot be cashed out to a bank account. You can use them to book any service."*

#### Backend Error Responses to Handle:
- **HTTP 400 (Bad Request - Withdrawing HR Credit):**
  ```json
  {
    "statusCode": 400,
    "status": "error",
    "message": "Credits allocated by HR/company cannot be withdrawn. Only self-topped-up credits can be withdrawn."
  }
  ```
- **HTTP 412 (Precondition Failed - Insufficient Balance):**
  ```json
  {
    "statusCode": 412,
    "status": "error",
    "message": "Insufficient balance"
  }
  ```

---

### 2.5 Smart Spending Priority

When a customer books a wellness service:
```
Total Bill: ₦12,000
Customer Wallet:
  • HR Credit (allocatedCredit): ₦15,000
  • Self-topped-up (rechargedCredit): ₦10,000

Result after booking:
  • HR Credit remaining: ₦3,000 (15,000 - 12,000)
  • Self-topped-up remaining: ₦10,000 (UNTOUCHED!)
  • Total Balance: ₦13,000
  • Withdrawable Balance: STILL ₦10,000!
```
> **UI Tip:** Inform users on the booking confirmation screen: *"Your company credit of ₦12,000 will be used first, keeping your personal withdrawable balance safe."*

---

### 2.6 Displaying Provider Badges

When customers browse services or view a provider profile (`/service/all`, `/service/details/:id`, `/partner/all`), the backend provides two distinct verification badges:

| Field Name | Type | Badge Name | Visual Design | Condition |
|:---|:---:|:---|:---|:---|
| `isVerified` | `Boolean` | **Verified Provider** | 🛡️ Blue Shield / Checkmark | Admin has officially approved the user / partner account. |
| `isCertified` | `Boolean` | **Certified Professional** | 🎓 Green Diploma / Badge | Provider has uploaded **ALL 4** credentials: `certificate`, `identityProof`, `businessCertification`, and `bankStatement`. |

#### Example Response from `/api/v1/service/all`:
```json
{
  "_id": "6a80b1...",
  "serviceName": "Swedish Deep Tissue Massage",
  "price": 15000,
  "partner": {
    "_id": "6a80a2...",
    "companyName": "Serene Spa",
    "isVerified": true,
    "isCertified": true,
    "rating": 4.9
  }
}
```

---

## 3. PART 2: Provider / Partner App (`partner` role)

### 3.1 Earnings & Payout System

Unlike customers, **Service Providers do NOT have HR credit restrictions**:
- All funds in a Provider's balance are earned revenues from completed service bookings and customer tips.
- `withdrawableCredit` for a provider is always **100% of their available balance**.
- Providers can withdraw instantly or according to their payout cycle (`weekly`, `monthly`, `instant`).

---

### 3.2 Verification & Certification Badges Management

Providers need to know their current badge status:

```http
GET /api/v1/auth/me
Authorization: Bearer <PARTNER_TOKEN>
```

#### Response (`200 OK`):
```json
{
  "data": {
    "fullName": "Dr. Sarah Wellness",
    "role": "partner",
    "partner": {
      "_id": "6a80a2...",
      "isVerified": false,
      "isCertified": true,
      "certificate": "/uploads/partners/cert-123.pdf",
      "businessCertification": "/uploads/partners/biz-456.pdf"
    }
  }
}
```

#### Badge States in Provider Profile:
1. **Identity Verification (`isVerified`):**
   - If `true` -> Show "Verified Provider" (Green check icon).
   - If `false` -> Show "Pending Admin Verification" (Yellow clock icon).
2. **Professional Certification (`isCertified`):**
   - If `true` -> Show "Certified Professional" (Green certificate icon).
   - If `false` -> Show "Upload Certificate to get Certified Badge" (Upload button).

---

### 3.3 Document Upload APIs for Badges

If a provider has not yet received `isCertified: true`, they can upload their certification documents.

```http
PATCH /api/v1/auth/update-documents
Authorization: Bearer <PARTNER_TOKEN>
Content-Type: multipart/form-data

certificate: <FILE_BLOB (PDF/PNG/JPG)>
businessCertification: <FILE_BLOB (Optional)>
```

> **Backend Behavior:** As soon as a provider uploads a non-empty `certificate` or `businessCertification`, the backend automatically sets `isCertified: true`!

---

### 3.4 Provider Earnings & Cashout Endpoints

#### 1. Fetch Earning Summary:
```http
GET /api/v1/transaction/earning
Authorization: Bearer <PARTNER_TOKEN>
```
Returns total earnings, tips, platform commission deductions, and pending payouts.

#### 2. Get Bank List for Withdrawal:
```http
GET /api/v1/transaction/getBanks/NG
Authorization: Bearer <PARTNER_TOKEN>
```
Returns supported Nigerian commercial banks and fintechs (Access, GTBank, Zenith, Kuda, OPay, etc.) with their bank codes.

#### 3. Request Cashout:
```http
PATCH /api/v1/transaction/withdraw-credit
Authorization: Bearer <PARTNER_TOKEN>
Content-Type: application/json

{
  "amount": 50000
}
```

---

## 4. PART 3: Production Flutter / Dart Code Snippets

### 4.1 Dart Models

Create `lib/models/wallet_overview.dart`:

```dart
class WalletOverview {
  final double totalCredit;
  final double withdrawableCredit;
  final double allocatedCredit;
  final double rechargedCredit;
  final bool isCompanyEmployee;

  WalletOverview({
    required this.totalCredit,
    required this.withdrawableCredit,
    required this.allocatedCredit,
    required this.rechargedCredit,
    required this.isCompanyEmployee,
  });

  factory WalletOverview.fromJson(Map<String, dynamic> json) {
    return WalletOverview(
      totalCredit: (json['digitalWallet'] ?? json['totalCredit'] ?? 0).toDouble(),
      withdrawableCredit: (json['withdrawableCredit'] ?? json['rechargedCredit'] ?? 0).toDouble(),
      allocatedCredit: (json['allocatedCredit'] ?? json['nonWithdrawableCredit'] ?? 0).toDouble(),
      rechargedCredit: (json['rechargedCredit'] ?? 0).toDouble(),
      isCompanyEmployee: json['isCompanyEmployee'] ?? (json['allocatedCredit'] != null && json['allocatedCredit'] > 0),
    );
  }
}
```

---

### 4.2 Provider Badge Flutter Widgets

Create `lib/widgets/provider_badges.dart`:

```dart
import 'package:flutter/material.dart';

class VerifiedBadge extends StatelessWidget {
  final double size;
  const VerifiedBadge({Key? key, this.size = 18}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: const Color(0xFFE0F2FE),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFF0284C7), width: 1),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.verified, size: size, color: const Color(0xFF0284C7)),
          const SizedBox(width: 4),
          const Text(
            'Verified',
            style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF0369A1)),
          ),
        ],
      ),
    );
  }
}

class CertifiedBadge extends StatelessWidget {
  final double size;
  const CertifiedBadge({Key? key, this.size = 18}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: const Color(0xFFDCFCE7),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFF16A34A), width: 1),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.workspace_premium, size: size, color: const Color(0xFF16A34A)),
          const SizedBox(width: 4),
          const Text(
            'Certified',
            style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF15803D)),
          ),
        ],
      ),
    );
  }
}
```

---

### 4.3 Customer Wallet Screen Flutter Widget

Create `lib/screens/customer_wallet_screen.dart`:

```dart
import 'package:flutter/material.dart';
import '../models/wallet_overview.dart';
import '../widgets/withdrawal_bottom_sheet.dart';

class CustomerWalletScreen extends StatelessWidget {
  final WalletOverview wallet;
  final VoidCallback onTopUpPressed;
  final VoidCallback onRefresh;

  const CustomerWalletScreen({
    Key? key,
    required this.wallet,
    required this.onTopUpPressed,
    required this.onRefresh,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('My AuraVive Wallet')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // 1. Primary Total Balance Hero Card
            Card(
              elevation: 4,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              color: const Color(0xFF0F172A),
              child: Padding(
                padding: const EdgeInsets.all(24.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Total AuraVive Balance', style: TextStyle(color: Colors.white70, fontSize: 14)),
                    const SizedBox(height: 8),
                    Text(
                      '₦${wallet.totalCredit.toStringAsFixed(2)}',
                      style: const TextStyle(color: Colors.white, fontSize: 32, fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 20),
                    Row(
                      children: [
                        Expanded(
                          child: ElevatedButton.icon(
                            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF0284C7)),
                            icon: const Icon(Icons.add, color: Colors.white),
                            label: const Text('Top Up', style: TextStyle(color: Colors.white)),
                            onPressed: onTopUpPressed,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: OutlinedButton.icon(
                            style: OutlinedButton.styleFrom(
                              side: BorderSide(
                                color: wallet.withdrawableCredit > 0 ? Colors.white : Colors.white24,
                              ),
                            ),
                            icon: Icon(Icons.arrow_upward, color: wallet.withdrawableCredit > 0 ? Colors.white : Colors.white24),
                            label: Text(
                              'Withdraw',
                              style: TextStyle(color: wallet.withdrawableCredit > 0 ? Colors.white : Colors.white24),
                            ),
                            onPressed: wallet.withdrawableCredit > 0
                                ? () => showModalBottomSheet(
                                      context: context,
                                      isScrollControlled: true,
                                      builder: (_) => WithdrawalBottomSheet(maxWithdrawable: wallet.withdrawableCredit),
                                    )
                                : null,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),

            // 2. Breakdown Cards Row
            Row(
              children: [
                // Withdrawable Card
                Expanded(
                  child: Card(
                    color: const Color(0xFFF0FDF4),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    child: Padding(
                      padding: const EdgeInsets.all(16.0),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Withdrawable', style: TextStyle(color: Color(0xFF15803D), fontSize: 12)),
                          const SizedBox(height: 6),
                          Text(
                            '₦${wallet.withdrawableCredit.toStringAsFixed(2)}',
                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: Color(0xFF166534)),
                          ),
                          const SizedBox(height: 4),
                          const Text('From your top-ups', style: TextStyle(fontSize: 10, color: Colors.black54)),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 12),

                // HR / Company Card
                Expanded(
                  child: Card(
                    color: const Color(0xFFF8FAFC),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    child: Padding(
                      padding: const EdgeInsets.all(16.0),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Company Credit', style: TextStyle(color: Color(0xFF475569), fontSize: 12)),
                          const SizedBox(height: 6),
                          Text(
                            '₦${wallet.allocatedCredit.toStringAsFixed(2)}',
                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: Color(0xFF1E293B)),
                          ),
                          const SizedBox(height: 4),
                          const Text('Services only (locked)', style: TextStyle(fontSize: 10, color: Colors.black54)),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),

            // 3. Information Banner
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFFEF3C7),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0xFFF59E0B)),
              ),
              child: const Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(Icons.info_outline, color: Color(0xFFB45309), size: 20),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Credits provided by your company or HR can only be used to book wellness services and cannot be withdrawn as cash. When you book, company credits are spent first.',
                      style: TextStyle(color: Color(0xFF92400E), fontSize: 12),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
```

---

### 4.4 Withdrawal Bottom Sheet with Validation

Create `lib/widgets/withdrawal_bottom_sheet.dart`:

```dart
import 'package:flutter/material.dart';

class WithdrawalBottomSheet extends StatefulWidget {
  final double maxWithdrawable;
  const WithdrawalBottomSheet({Key? key, required this.maxWithdrawable}) : super(key: key);

  @override
  _WithdrawalBottomSheetState createState() => _WithdrawalBottomSheetState();
}

class _WithdrawalBottomSheetState extends State<WithdrawalBottomSheet> {
  final TextEditingController _amountController = TextEditingController();
  String? _errorText;
  bool _isLoading = false;

  void _validateAndSubmit() async {
    final amount = double.tryParse(_amountController.text.trim());
    if (amount == null || amount <= 0) {
      setState(() => _errorText = 'Enter a valid amount');
      return;
    }
    if (amount > widget.maxWithdrawable) {
      setState(() => _errorText = 'Max withdrawable amount is ₦${widget.maxWithdrawable.toStringAsFixed(2)}');
      return;
    }

    setState(() {
      _isLoading = true;
      _errorText = null;
    });

    // Call API: PATCH /api/v1/transaction/withdraw-credit with {"amount": amount}
    Navigator.pop(context);
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Withdrawal request submitted successfully!')),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom + 16,
        top: 24,
        left: 20,
        right: 20,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text('Withdraw Funds', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          Text(
            'Available to withdraw: ₦${widget.maxWithdrawable.toStringAsFixed(2)}',
            style: const TextStyle(color: Color(0xFF16A34A), fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _amountController,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: InputDecoration(
              prefixText: '₦ ',
              hintText: 'Enter amount',
              errorText: _errorText,
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
            ),
          ),
          const SizedBox(height: 20),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              padding: const EdgeInsets.symmetric(vertical: 14),
              backgroundColor: const Color(0xFF0F172A),
            ),
            onPressed: _isLoading ? null : _validateAndSubmit,
            child: _isLoading
                ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : const Text('Confirm Cashout', style: TextStyle(fontSize: 16, color: Colors.white)),
          ),
        ],
      ),
    );
  }
}
```

---

## 5. PART 4: Error Handling & Status Codes Reference

| HTTP Code | Condition | Developer Action in Mobile App |
|:---:|:---|:---|
| **200 OK** | Success | Update local state, show success snackbar/toast, refresh wallet overview. |
| **400 Bad Request** | Attempting to withdraw HR credit | Show alert dialog: *"Company-allocated credit cannot be withdrawn. You can only withdraw self-funded credits."* |
| **404 Not Found** | User not found | Direct user to login again / refresh token. |
| **412 Precondition** | Insufficient balance | Show inline input error: *"Insufficient balance for this request."* |
| **500 Internal Error** | Payment gateway error | Show toast: *"Payment service temporary unavailable. Please try again shortly."* |

---

> **Summary for Mobile Developers:**  
> 1. In **Customer App**: Update the wallet page to show 3 metrics (Total, Withdrawable, Company credit) and restrict withdrawals to `withdrawableCredit`. Add `isVerified` and `isCertified` badges to provider cards.  
> 2. In **Provider App**: Allow 100% withdrawals of earned revenue, display verification & certification status, and allow uploading certificates to get the green `isCertified` badge.
