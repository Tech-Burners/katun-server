# AuraVive — Wallet, Credit Breakdown, Withdrawal & HR Reclaim Integration Guide

> **Audience:** Frontend Web Developers (React.js, Next.js, Vue, Angular) and AI Coding Assistants (Cursor, ChatGPT, Claude, Copilot).  
> **Purpose:** Step-by-step technical implementation guide for building the **Customer Wallet & Credit Breakdown Screen**, **Top-up Flow**, **Withdrawal Modal**, **Transaction History**, **HR Credit Allocation**, and the **Admin Manual Reclaim to HR Panel**.  
> **Currency:** Nigerian Naira (₦ / NGN)  
> **Backend Base URL:** `https://api.auravive.ng` (Production) / `http://localhost:8047` (Local)

---

## Table of Contents
1. [Core Business Rules & Wallet Architecture](#1-core-business-rules--wallet-architecture)
2. [TypeScript Interfaces & Type Definitions](#2-typescript-interfaces--type-definitions)
3. [API Endpoints Reference](#3-api-endpoints-reference)
   - [3.1 Customer: Get Wallet Overview & Transactions](#31-customer-get-wallet-overview--transactions)
   - [3.2 Customer: Top-Up Wallet Credit](#32-customer-top-up-wallet-credit)
   - [3.3 Customer: Withdraw Withdrawable Credit](#33-customer-withdraw-withdrawable-credit)
   - [3.4 Admin: Manually Reclaim Unused Credit to HR](#34-admin-manually-reclaim-unused-credit-to-hr)
   - [3.5 HR: Allocate Credit to Employee](#35-hr-allocate-credit-to-employee)
4. [Frontend UI/UX Guidelines & Component Wireframes](#4-frontend-uiux-guidelines--component-wireframes)
5. [Production-Ready React / Next.js Code Implementation](#5-production-ready-react--nextjs-code-implementation)
   - [5.1 API Client Service (`walletApi.ts`)](#51-api-client-service-walletapits)
   - [5.2 Complete Customer Wallet Page Component (`WalletPage.tsx`)](#52-complete-customer-wallet-page-component-walletpagetsx)
   - [5.3 Admin Reclaim Component (`AdminReclaimModal.tsx`)](#53-admin-reclaim-component-adminreclaimmodaltsx)
6. [Edge Cases & Error Handling Checklist](#6-edge-cases--error-handling-checklist)

---

## 1. Core Business Rules & Wallet Architecture

AuraVive features a hybrid wallet system that separates **company-funded credits** from **self-funded customer credits**:

| Credit Metric | Field Name | Explanation | Can Customer Withdraw? |
|---|---|---|:---:|
| **Total Balance** | `totalCredit` / `digitalWallet` / `balance` | Total spendable credit for booking services on AuraVive. | **Partial** (Only self-funded portion) |
| **Withdrawable Credit** | `withdrawableCredit` / `rechargedCredit` | Funds deposited/topped-up directly by the customer with their own card/bank. | **YES** ✅ (Up to available balance) |
| **HR Allocated Credit** | `allocatedCredit` / `nonWithdrawableCredit` | Credits gifted/allocated to the user by a Corporate HR/Company employer. | **NO** ❌ (Locked for booking services only) |

### Key Business Logic
1. **Withdrawal Restriction:** Customers **CANNOT** withdraw credits allocated by an employer/HR. If a customer attempts to withdraw more than their `withdrawableCredit`, the backend rejects it with HTTP `412` or `400`.
2. **Smart Spending Priority:** When a customer books a service using wallet credit, the backend automatically **burns HR-allocated credit first**. Only after all HR credit is used up will it deduct self-topped-up credit. This preserves the customer's withdrawable cash as long as possible!
3. **Admin Manual Reclaim to HR:** If an employee has unused HR credit after a period of time, an Admin can manually reclaim the unused portion from the employee's wallet and return it to the company's employer credit balance.

---

## 2. TypeScript Interfaces & Type Definitions

Copy and paste these interfaces into your frontend project (e.g., `src/types/wallet.ts`):

```typescript
export interface WalletOverview {
  totalCredit: number;           // Total spendable credit (₦)
  balance: number;               // Alias for totalCredit
  digitalWallet: number;         // Raw database balance
  withdrawableCredit: number;    // Maximum amount eligible for cashout (₦)
  withdrawableAmount: number;    // Alias for withdrawableCredit
  allocatedCredit: number;       // Non-withdrawable HR credit (₦)
  nonWithdrawableCredit: number; // Alias for allocatedCredit
  rechargedCredit: number;       // Lifetime/active self-topped-up credit (₦)
  isCompanyEmployee: boolean;    // Whether user belongs to an employer/company
  transactions: WalletTransaction[];
  pagination?: {
    totalResults: number;
    totalPages: number;
    currentPage: number;
    limit: number;
  };
}

export interface WalletTransaction {
  _id: string;
  tx_ref: string;
  amount: number;
  gross_amount?: number;
  net_amount?: number;
  currency: string;
  payment_type: 'credit' | 'booking' | 'payout' | 'refund' | 'tip';
  payment_method: 'card' | 'wallet' | 'banktransfer' | 'ussd';
  payment_status: 'successful' | 'pending' | 'failed' | 'refunded';
  description?: string;
  createdAt: string;
  booking?: {
    _id: string;
    serviceName?: string;
    startTime?: string;
    date?: string;
  };
}

export interface TopUpRequest {
  amount: number;
  redirect_url?: string;
}

export interface TopUpResponse {
  paymentLink: string;
  tx_ref: string;
}

export interface WithdrawRequest {
  amount: number;
  bankCode?: string;
  accountNumber?: string;
  accountName?: string;
}

export interface ReclaimToHrRequest {
  employeeId?: string;           // Optional if userId is provided
  userId?: string;               // Optional if employeeId is provided
  companyId?: string;            // Required if user has no employee profile
  amount: number | 'all';        // 'all' to reclaim 100% of unused HR credit
  reason?: string;
}
```

---

## 3. API Endpoints Reference

### 3.1 Customer: Get Wallet Overview & Transactions
Returns the complete wallet balance breakdown and recent wallet activity.

* **Method:** `GET`
* **Path:** `/api/v1/overview/user/wallet-transactions`
* **Headers:** `Authorization: Bearer <CUSTOMER_JWT_TOKEN>`
* **Query Params:** `?page=1&limit=10`

#### Example Response:
```json
{
  "status": "Success",
  "statusCode": 200,
  "type": "overview",
  "message": "User wallet transaction data retrieved successfully",
  "data": {
    "totalCredit": 15000,
    "balance": 15000,
    "digitalWallet": 15000,
    "withdrawableCredit": 5000,
    "withdrawableAmount": 5000,
    "allocatedCredit": 10000,
    "nonWithdrawableCredit": 10000,
    "rechargedCredit": 5000,
    "isCompanyEmployee": true,
    "transactions": [
      {
        "_id": "673f1234567890abcdef1234",
        "tx_ref": "txn_1732450000_abc123",
        "amount": 5000,
        "currency": "NGN",
        "payment_type": "credit",
        "payment_method": "card",
        "payment_status": "successful",
        "description": "Customer Wallet Top-up",
        "createdAt": "2026-11-24T10:00:00.000Z"
      }
    ],
    "pagination": {
      "totalResults": 1,
      "totalPages": 1,
      "currentPage": 1,
      "limit": 10
    }
  }
}
```

---

### 3.2 Customer: Top-Up Wallet Credit
Initiates a top-up via Flutterwave. The response returns a `paymentLink` where the user completes payment.

* **Method:** `POST`
* **Path:** `/api/v1/transaction/purchase-credit`
* **Headers:**  
  * `Authorization: Bearer <CUSTOMER_JWT_TOKEN>`  
  * `Content-Type: application/json`
* **Request Body:**
  ```json
  {
    "amount": 5000,
    "redirect_url": "https://auravive.ng/wallet?payment_status=success"
  }
  ```
* **Response:**
  ```json
  {
    "status": "success",
    "statusCode": 200,
    "data": {
      "paymentLink": "https://api.auravive.ng/api/v1/transaction/pay/081da878863ec52cd120",
      "tx_ref": "txn_1795496547_abcd"
    }
  }
  ```

---

### 3.3 Customer: Withdraw Withdrawable Credit
Withdraws funds to the customer's bank account. Enforces that customers cannot withdraw HR-allocated funds.

* **Method:** `PATCH`
* **Path:** `/api/v1/transaction/withdraw-credit`
* **Headers:**  
  * `Authorization: Bearer <CUSTOMER_JWT_TOKEN>`  
  * `Content-Type: application/json`
* **Request Body:**
  ```json
  {
    "amount": 3000
  }
  ```
* **Success Response (`200 OK`):**
  ```json
  {
    "status": "OK",
    "statusCode": 200,
    "message": "Withdrawal request submitted successfully",
    "data": {
      "withdrawnAmount": 3000,
      "remainingDigitalWallet": 12000,
      "remainingWithdrawableCredit": 2000
    }
  }
  ```
* **Error Response When Attempting to Withdraw HR Credit (`412 Precondition Failed` or `400 Bad Request`):**
  ```json
  {
    "status": "Error",
    "statusCode": 412,
    "message": "Insufficient withdrawable balance. You can only withdraw up to your topped-up amount (5000.00 NGN). HR-allocated credits cannot be withdrawn.",
    "errors": []
  }
  ```

---

### 3.4 Admin: Manually Reclaim Unused Credit to HR
Allows an Admin or Sub-Admin to manually take back unused HR credits from an employee and credit them back to the employer's company wallet balance.

* **Method:** `POST` or `PATCH`
* **Path:** `/api/v1/allocate/reclaim-to-hr`
* **Headers:**  
  * `Authorization: Bearer <ADMIN_JWT_TOKEN>`  
  * `Content-Type: application/json`
* **Request Body Options:**

  **Option A (By Employee ID):**
  ```json
  {
    "employeeId": "673f1234567890abcdef1234",
    "amount": "all",
    "reason": "Credit unused for 90 days. Reclaiming back to company account."
  }
  ```

  **Option B (By Direct User & Company ID):**
  ```json
  {
    "userId": "673f9876543210fedcba4321",
    "companyId": "673f11112222333344445555",
    "amount": 4500,
    "reason": "Quarterly unused credit expiry."
  }
  ```

* **Success Response (`200 OK`):**
  ```json
  {
    "status": "Success",
    "statusCode": 200,
    "type": "allocate",
    "message": "Unused credit reclaimed to HR successfully",
    "data": {
      "reclaimedAmount": 4500,
      "employeeName": "John Doe",
      "companyName": "Acme Corp",
      "companyUpdatedBalance": 94500,
      "employeeRemainingWallet": 1500
    }
  }
  ```

---

### 3.5 HR: Allocate Credit to Employee
Allows an HR representative to disburse company credits to an employee.

* **Method:** `POST`
* **Path:** `/api/v1/allocate/add`
* **Headers:**  
  * `Authorization: Bearer <HR_JWT_TOKEN>`  
  * `Content-Type: application/json`
* **Request Body:**
  ```json
  {
    "employeeId": "673f1234567890abcdef1234",
    "creditAmount": 10000,
    "period": "monthly",
    "date": "2026-11-24"
  }
  ```

---

## 4. Frontend UI/UX Guidelines & Component Wireframes

```
+-----------------------------------------------------------------------------------+
|  💰 MY WALLET                                                                     |
+-----------------------------------------------------------------------------------+
|  +---------------------------+  +---------------------------+  +----------------+ |
|  | TOTAL SPENDABLE BALANCE   |  | WITHDRAWABLE CASH         |  | HR ALLOCATED   | |
|  | ₦15,000.00                |  | ₦5,000.00                 |  | ₦10,000.00     | |
|  | Available for any booking |  | Available to Cashout      |  | 🔒 Locked      | |
|  +---------------------------+  +---------------------------+  +----------------+ |
|                                                                                   |
|  [ + Top Up Credit ]      [ ⬇ Withdraw Cash ]                                     |
+-----------------------------------------------------------------------------------+
|  ℹ️ Note: HR-allocated credits are funded by your employer for wellness services |
|     and cannot be cashed out. Self-funded top-ups can be withdrawn anytime.       |
+-----------------------------------------------------------------------------------+
|  TRANSACTION HISTORY                                                              |
|  Date         Type      Description               Method       Status     Amount  |
|  2026-11-24   Top-up    Customer Wallet Top-up    Card         Success   +₦5,000  |
|  2026-11-20   Booking   Massage & Spa Therapy     HR Credit    Paid      -₦8,000  |
+-----------------------------------------------------------------------------------+
```

### UX Recommendations for the Frontend:
1. **Highlight the Withdrawable vs Non-Withdrawable Difference:** Use distinct badge colors:
   - **Total Balance:** Primary brand color (e.g. Navy / Emerald).
   - **Withdrawable Cash:** Green with an active "Withdraw" CTA button.
   - **HR Allocated Credit:** Amber/Gold with a lock icon `🔒 Non-Withdrawable`.
2. **Withdrawal Modal Input Validation:**
   - Display a quick badge: `Max Withdrawable: ₦5,000.00`.
   - Prevent entering an amount greater than `withdrawableCredit`. If entered, display an inline warning:  
     *“You cannot withdraw more than ₦5,000.00. HR-allocated credits (₦10,000.00) are reserved for bookings only.”*
3. **Smart Spending Tooltip:** Add an information tooltip:  
   *“When booking a service, AuraVive burns your HR-allocated credit first so your withdrawable cash remains in your wallet.”*

---

## 5. Production-Ready React / Next.js Code Implementation

### 5.1 API Client Service (`walletApi.ts`)

```typescript
import axios from 'axios';
import { WalletOverview, TopUpResponse, ReclaimToHrRequest } from '../types/wallet';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.auravive.ng';

const getAuthHeaders = () => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };
};

export const walletApi = {
  // 1. Fetch wallet overview & transaction history
  getWalletOverview: async (page = 1, limit = 10): Promise<WalletOverview> => {
    const response = await axios.get(
      `${BASE_URL}/api/v1/overview/user/wallet-transactions?page=${page}&limit=${limit}`,
      getAuthHeaders()
    );
    return response.data.data;
  },

  // 2. Initiate Top-up (Returns payment link)
  topUpCredit: async (amount: number, redirectUrl?: string): Promise<TopUpResponse> => {
    const response = await axios.post(
      `${BASE_URL}/api/v1/transaction/purchase-credit`,
      {
        amount,
        redirect_url: redirectUrl || window.location.href,
      },
      getAuthHeaders()
    );
    return response.data.data;
  },

  // 3. Request Withdrawal
  withdrawCredit: async (amount: number) => {
    const response = await axios.patch(
      `${BASE_URL}/api/v1/transaction/withdraw-credit`,
      { amount },
      getAuthHeaders()
    );
    return response.data;
  },

  // 4. Admin Reclaim Unused HR Credit
  adminReclaimToHr: async (payload: ReclaimToHrRequest) => {
    const response = await axios.post(
      `${BASE_URL}/api/v1/allocate/reclaim-to-hr`,
      payload,
      getAuthHeaders()
    );
    return response.data;
  },
};
```

---

### 5.2 Complete Customer Wallet Page Component (`WalletPage.tsx`)

A modern Tailwind CSS component ready to copy into React or Next.js:

```tsx
import React, { useEffect, useState } from 'react';
import { walletApi } from './walletApi';
import { WalletOverview } from '../types/wallet';

export default function WalletPage() {
  const [wallet, setWallet] = useState<WalletOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal States
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [amount, setAmount] = useState<number | ''>('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const fetchWallet = async () => {
    try {
      setLoading(true);
      const data = await walletApi.getWalletOverview(1, 10);
      setWallet(data);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load wallet data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWallet();
  }, []);

  const handleTopUp = async () => {
    if (!amount || amount <= 0) return alert('Please enter a valid amount');
    try {
      setActionLoading(true);
      const res = await walletApi.topUpCredit(Number(amount));
      if (res.paymentLink) {
        window.location.href = res.paymentLink; // Redirect to checkout
      }
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Top-up failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleWithdraw = async () => {
    if (!amount || amount <= 0) return alert('Please enter a valid amount');
    if (wallet && amount > wallet.withdrawableCredit) {
      return alert(
        `You cannot withdraw more than ₦${wallet.withdrawableCredit.toLocaleString()}. HR-allocated credits are non-withdrawable.`
      );
    }

    try {
      setActionLoading(true);
      await walletApi.withdrawCredit(Number(amount));
      alert('Withdrawal request submitted successfully!');
      setShowWithdrawModal(false);
      setAmount('');
      fetchWallet();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Withdrawal failed');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading wallet details...</div>;
  if (error) return <div className="p-8 text-center text-red-500">{error}</div>;
  if (!wallet) return null;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">My Wallet & Credits</h1>
        <p className="text-gray-500 text-sm mt-1">
          Manage your balance, self top-ups, and corporate wellness benefits.
        </p>
      </div>

      {/* Wallet Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Total Spendable Balance */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-6 shadow-lg flex flex-col justify-between">
          <div>
            <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
              Total Spendable Balance
            </span>
            <div className="text-3xl font-extrabold mt-2">
              ₦{wallet.totalCredit.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-slate-300 mt-2">
              Available to book any service or massage on AuraVive.
            </p>
          </div>
          <button
            onClick={() => { setAmount(''); setShowTopUpModal(true); }}
            className="mt-6 w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold rounded-xl text-sm transition"
          >
            + Top Up Credit
          </button>
        </div>

        {/* Card 2: Withdrawable Balance */}
        <div className="bg-white border border-emerald-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-emerald-700 font-semibold">
                Withdrawable Cash
              </span>
              <span className="bg-emerald-100 text-emerald-800 text-xs px-2.5 py-0.5 rounded-full font-medium">
                Self-Funded
              </span>
            </div>
            <div className="text-3xl font-extrabold text-emerald-600 mt-2">
              ₦{wallet.withdrawableCredit.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              From your own card/bank top-ups. You can cash this out anytime.
            </p>
          </div>
          <button
            onClick={() => { setAmount(''); setShowWithdrawModal(true); }}
            disabled={wallet.withdrawableCredit <= 0}
            className="mt-6 w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold rounded-xl text-sm transition"
          >
            ⬇ Withdraw to Bank
          </button>
        </div>

        {/* Card 3: HR Allocated Credit */}
        <div className="bg-white border border-amber-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-amber-700 font-semibold">
                HR / Company Allocated
              </span>
              <span className="bg-amber-100 text-amber-800 text-xs px-2.5 py-0.5 rounded-full font-medium">
                🔒 Non-Withdrawable
              </span>
            </div>
            <div className="text-3xl font-extrabold text-amber-600 mt-2">
              ₦{wallet.allocatedCredit.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Funded by your employer. Spent first automatically on bookings.
            </p>
          </div>
          <div className="mt-6 text-xs text-gray-400 italic">
            *Non-withdrawable as per corporate wellness policy.
          </div>
        </div>
      </div>

      {/* Transaction History Table */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Transaction History</h2>
        {wallet.transactions.length === 0 ? (
          <p className="text-gray-500 text-sm">No wallet transactions found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-xs uppercase text-gray-400 border-b">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Reference</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4">Method</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {wallet.transactions.map((tx) => (
                  <tr key={tx._id} className="hover:bg-gray-50">
                    <td className="py-3 px-4 text-gray-500">
                      {new Date(tx.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-gray-500">
                      {tx.tx_ref}
                    </td>
                    <td className="py-3 px-4 text-gray-800 font-medium">
                      {tx.description || tx.booking?.serviceName || tx.payment_type}
                    </td>
                    <td className="py-3 px-4 capitalize">{tx.payment_method}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                          tx.payment_status === 'successful'
                            ? 'bg-green-100 text-green-700'
                            : tx.payment_status === 'pending'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {tx.payment_status}
                      </span>
                    </td>
                    <td
                      className={`py-3 px-4 text-right font-semibold ${
                        tx.payment_type === 'credit' || tx.payment_status === 'refunded'
                          ? 'text-emerald-600'
                          : 'text-gray-900'
                      }`}
                    >
                      {tx.payment_type === 'credit' ? '+' : '-'}₦
                      {tx.amount?.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Top-up Modal */}
      {showTopUpModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Top Up Wallet Credit</h3>
            <p className="text-xs text-gray-500">
              Funds added through this modal are 100% withdrawable to your bank account anytime.
            </p>
            <input
              type="number"
              placeholder="Enter amount (₦)"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full border rounded-xl p-3 text-lg font-medium focus:ring-2 focus:ring-amber-500 outline-none"
            />
            <div className="flex gap-2">
              {[2000, 5000, 10000, 20000].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setAmount(preset)}
                  className="flex-1 py-1.5 text-xs font-semibold bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700"
                >
                  +₦{preset.toLocaleString()}
                </button>
              ))}
            </div>
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => setShowTopUpModal(false)}
                className="flex-1 py-2.5 border rounded-xl text-gray-600 font-semibold hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleTopUp}
                disabled={actionLoading}
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl"
              >
                {actionLoading ? 'Redirecting...' : 'Proceed to Pay'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Withdraw Modal */}
      {showWithdrawModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Withdraw Cash to Bank</h3>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 space-y-1">
              <div className="font-semibold">Maximum Withdrawable: ₦{wallet.withdrawableCredit.toLocaleString()}</div>
              <div>HR-allocated credits cannot be withdrawn into bank accounts.</div>
            </div>
            <input
              type="number"
              placeholder="Enter withdrawal amount (₦)"
              value={amount}
              max={wallet.withdrawableCredit}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full border rounded-xl p-3 text-lg font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
            />
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => setShowWithdrawModal(false)}
                className="flex-1 py-2.5 border rounded-xl text-gray-600 font-semibold hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleWithdraw}
                disabled={actionLoading || !amount || amount > wallet.withdrawableCredit}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white font-bold rounded-xl"
              >
                {actionLoading ? 'Processing...' : 'Confirm Withdrawal'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

---

### 5.3 Admin Reclaim Component (`AdminReclaimModal.tsx`)

This component is for the **Admin Dashboard** to reclaim unused HR credit from an employee:

```tsx
import React, { useState } from 'react';
import { walletApi } from './walletApi';

interface AdminReclaimModalProps {
  employeeId: string;
  employeeName: string;
  unusedAllocatedCredit: number;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AdminReclaimModal({
  employeeId,
  employeeName,
  unusedAllocatedCredit,
  isOpen,
  onClose,
  onSuccess,
}: AdminReclaimModalProps) {
  const [amount, setAmount] = useState<number | 'all'>('all');
  const [reason, setReason] = useState('Unused HR allocation reclaimed by admin policy.');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleReclaim = async () => {
    try {
      setLoading(true);
      await walletApi.adminReclaimToHr({
        employeeId,
        amount: amount === 'all' ? 'all' : Number(amount),
        reason,
      });
      alert(`Successfully reclaimed credit for ${employeeName} and credited company account.`);
      onSuccess();
      onClose();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Reclaim operation failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
        <h3 className="text-lg font-bold text-gray-900">Reclaim Unused HR Credit</h3>
        <p className="text-xs text-gray-500">
          This manual action takes back unspent HR allocation from <strong>{employeeName}</strong> and returns it to their corporate employer's balance.
        </p>

        <div className="bg-gray-50 p-3 rounded-xl border text-sm">
          <span className="text-gray-500">Available Unused HR Credit:</span>
          <span className="float-right font-bold text-gray-900">
            ₦{unusedAllocatedCredit.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
          </span>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-gray-700">Reclaim Amount:</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setAmount('all')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg border ${
                amount === 'all' ? 'bg-amber-500 text-white border-amber-500' : 'bg-gray-50 text-gray-700'
              }`}
            >
              Reclaim All (₦{unusedAllocatedCredit.toLocaleString()})
            </button>
            <button
              type="button"
              onClick={() => setAmount(unusedAllocatedCredit / 2)}
              className={`flex-1 py-2 text-xs font-bold rounded-lg border ${
                typeof amount === 'number' ? 'bg-amber-500 text-white border-amber-500' : 'bg-gray-50 text-gray-700'
              }`}
            >
              Custom Amount
            </button>
          </div>
          {typeof amount === 'number' && (
            <input
              type="number"
              max={unusedAllocatedCredit}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              placeholder="Enter amount to reclaim"
              className="w-full border rounded-xl p-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-amber-500"
            />
          )}
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-gray-700">Audit Reason:</label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full border rounded-xl p-2 text-xs text-gray-600 outline-none"
          />
        </div>

        <div className="flex gap-3 pt-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 border rounded-xl text-gray-600 font-semibold hover:bg-gray-50 text-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleReclaim}
            disabled={loading || unusedAllocatedCredit <= 0}
            className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white font-bold rounded-xl text-sm"
          >
            {loading ? 'Reclaiming...' : 'Confirm Reclaim'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

## 6. Edge Cases & Error Handling Checklist

| Scenario | Backend Behavior | Frontend Requirement |
|---|---|---|
| **Customer has ₦10,000 HR Credit & ₦0 Top-up** | Withdraw button disabled or returns `400` / `412`. | Disable "Withdraw" button or show tooltip: *"You do not have any withdrawable cash. HR credits cannot be withdrawn."* |
| **Customer has ₦5,000 Top-up and withdraws ₦5,000** | Successfully transfers ₦5,000 to bank. `withdrawableCredit` becomes `0`. | Instantly update UI: `withdrawableCredit: 0.00`, remaining balance matches `allocatedCredit`. |
| **Customer books a ₦6,000 service** with ₦10,000 HR Credit and ₦5,000 Top-up | Deducts ₦6,000 from HR Credit. `allocatedCredit` drops to ₦4,000. `rechargedCredit` stays ₦5,000. | Total balance becomes ₦9,000. Customer STILL has ₦5,000 withdrawable cash! |
| **Admin reclaims unused HR credit** | Deducts unused HR credit from employee and adds it back to corporate company's credit balance. | Refresh employee table and company balance in admin panel. |
| **Wrong Role in Token** | Server rejects with `401 "You are not authorized"`. | Ensure Customer Wallet screens pass a JWT with `role: "user"`. Admin panels must pass `role: "admin"`. |
