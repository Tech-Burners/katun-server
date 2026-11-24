# AuraVive — Dynamic Location & Distance Everywhere Integration Specification

> **Target Audience:** Mobile App Developers (Flutter / React Native / iOS / Android), Frontend Web Developers, and AI Coding Assistants.
> **Scope:** Dynamic GPS location parameters, distance calculation in kilometers across all service/partner endpoints, guest user support, and optional fallback behavior.
> **Unit of Distance:** Kilometers (km), rounded to 2 decimal places (e.g. `4.25`).

---

## 1. Executive Summary & How It Works

Previously, distance was only computed for logged-in users whose locations were saved in their database profile, which caused two major limitations:
1. **Guest users (not logged in)** could never see distances to services or providers.
2. **Logged-in users** had their distance fixed to their saved profile address instead of their real-time device GPS location.

### The New Dynamic Location System
The backend now accepts **dynamic GPS coordinates** from the frontend on all service and partner endpoints:

```
┌────────────────────────────────────────────────────────┐
│  1. Check Query or Body Params:                       │
│     latitude / lat, longitude / lng                    │
│     (Dynamic GPS coordinates sent by device)           │
└──────────────────────────┬─────────────────────────────┘
                           │
             Found? ───────┴─────── Not Found?
            /                                 \
           ▼                                   ▼
┌───────────────────────┐         ┌───────────────────────────────┐
│ Calculate distance    │         │ 2. Is user logged in?         │
│ based on dynamic GPS! │         └───────────────┬───────────────┘
│ (Works for guests AND │                         │
│ logged-in users)      │            Yes? ────────┴──────── No?
└───────────────────────┘           /                        \
                                   ▼                          ▼
                  ┌────────────────────────┐      ┌───────────────────────────┐
                  │ Fallback to user       │      │ 3. Optional Location:     │
                  │ profile coordinates    │      │ Return all services with  │
                  │ and calculate distance │      │ distance: null WITHOUT    │
                  └────────────────────────┘      │ ANY ERROR!                │
                                                  └───────────────────────────┘
```

---

## 2. Supported Parameter Names

The frontend can send location parameters in either **Query String** (for `GET` and `POST`) or **JSON Body** (for `POST`). The backend automatically parses any of the following aliases:

| Dimension | Primary Param | Accepted Aliases | Example Value |
|---|---|---|---|
| **Latitude** | `lat` | `latitude` | `6.4281` |
| **Longitude** | `lng` | `longitude`, `lon`, `long` | `3.4219` |

> **IMPORTANT:**
> - Location is **100% OPTIONAL**. If GPS permission is denied or location is not provided, the API **never fails**. It returns all services sorted by rating/popularity with `"distance": null`.

---

## 3. Request Headers, Authentication & Role Matrix

### 3.1 Standard HTTP Headers

| Header Name | Header Value | When to Send | Description |
|---|---|---|---|
| `Authorization` | `Bearer <JWT_TOKEN>` | **Logged-In Users** | Send if user is logged in. **Omit for guest users.** |
| `Content-Type` | `application/json` | All `POST`, `PUT`, `PATCH` requests | Specifies JSON body payload. |
| `Accept` | `application/json` | Recommended on all calls | Informs server to return JSON responses. |

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
Accept: application/json
```

---

### 3.2 Guest vs. Logged-In User Authentication Rules

The endpoints in this specification fall into two categories:

#### 1. Optional Authentication Endpoints (Guest-Friendly)
- **Endpoints:** `/home/home`, `/home/all-nearest`, `/service/all`, `/service/popular`, `/service/nearest-popular`, `/service/details/:id`, `/partner/details/:id`
- **Guest Mode (Not logged in):**
  - **Do NOT send an invalid or dummy token.** Either omit the `Authorization` header completely, or do not set it.
  - The server handles unauthenticated requests without throwing errors.
- **Logged-In Mode:**
  - Send `Authorization: Bearer <JWT_TOKEN>`.
  - The server will recognize the user, populate upcoming bookings or favorite statuses, and use the user's saved profile location if dynamic GPS is omitted.

#### 2. Strict Authentication Endpoints (Login Required)
- **Endpoint:** `/api/v1/favourite/my-fav`
- **Required Role:** `auth(['user'])` — **Customer User ONLY**.
- **Role Requirement Alert:**
  > [!WARNING]
  > Passing a Partner token (`role: "partner"`), Admin, or HR token to `/api/v1/favourite/my-fav` will trigger:
  > ```json
  > {
  >   "status": "Error",
  >   "statusCode": 401,
  >   "message": "You are not authorized",
  >   "data": { "type": "Error" },
  >   "errors": []
  > }
  > ```
  > Ensure that customer mobile apps authenticate with customer credentials (`role: "user"`).

---

## 4. Updated Endpoints & Integration Details

### 4.1 Home Screen (Popular & Nearest Services)
Returns upcoming bookings (if logged in), popular services near the user, and active promos.

- **URL:** `{{BASE_URL}}/api/v1/home/home`
- **Methods:** `GET` or `POST`
- **Auth:** Optional (`Bearer <Token>` if logged in, omit for guest)
- **Headers:**
  - `Authorization: Bearer <USER_JWT_TOKEN>` *(Optional)*
  - `Accept: application/json`
- **Query / Body Params:**
  - `lat` or `latitude` (optional): e.g. `6.4281`
  - `lng` or `longitude` (optional): e.g. `3.4219`

#### Example Requests:

**As Logged-in User (with GPS):**
```bash
curl -X GET "https://api.auravive.com/api/v1/home/home?lat=6.4281&lng=3.3792" \
  -H "Authorization: Bearer YOUR_USER_ACCESS_TOKEN" \
  -H "Accept: application/json"
```

**As Guest User (without GPS or with GPS):**
```bash
curl -X GET "https://api.auravive.com/api/v1/home/home?lat=6.4281&lng=3.3792" \
  -H "Accept: application/json"
```

#### Response (`200 OK`):
```json
{
  "status": "Success",
  "statusCode": 200,
  "type": "home",
  "message": "home",
  "data": {
    "upcomingBooking": null,
    "nearest": [
      {
        "_id": "673f1234abcd...",
        "name": "Deep Tissue Massage",
        "image": "/uploads/service/massage.jpg",
        "servicefee": 12000,
        "avgRating": 4.9,
        "ratingCount": 42,
        "sell": 130,
        "subCategoryName": "Massage Therapy",
        "isVerified": 1,
        "distance": 3.45
      },
      {
        "_id": "673f5678efgh...",
        "name": "Luxury Facial Cleansing",
        "image": "/uploads/service/facial.jpg",
        "servicefee": 8500,
        "avgRating": 4.8,
        "ratingCount": 19,
        "sell": 80,
        "subCategoryName": "Facials",
        "isVerified": 1,
        "distance": 5.12
      }
    ],
    "promo": [ ... ]
  }
}
```
*Note: If no location is passed, `distance` will be `null` and services are sorted by rating & popularity.*

---

### 4.2 View All Nearest Services
Paginated list of nearest services with search support.

- **URL:** `{{BASE_URL}}/api/v1/home/all-nearest`
- **Methods:** `GET` or `POST`
- **Auth:** Optional (`Bearer <Token>` if logged in, omit for guest)
- **Headers:**
  - `Authorization: Bearer <USER_JWT_TOKEN>` *(Optional)*
  - `Accept: application/json`
- **Query Params:**
  - `lat` or `latitude` (optional)
  - `lng` or `longitude` (optional)
  - `page` (optional, default: `1`)
  - `limit` (optional, default: `10`)
  - `search` (optional): keyword filter

#### Example Request:
```bash
curl -X GET "https://api.auravive.com/api/v1/home/all-nearest?lat=6.4281&lng=3.3792&page=1&limit=10&search=massage" \
  -H "Accept: application/json"
```

#### Response (`200 OK`):
```json
{
  "status": "Success",
  "statusCode": 200,
  "type": "home",
  "message": "home",
  "data": {
    "nearest": {
      "result": [
        {
          "_id": "673f1234abcd...",
          "name": "Deep Tissue Massage",
          "image": "/uploads/service/massage.jpg",
          "servicefee": 12000,
          "avgRating": 4.9,
          "ratingCount": 42,
          "sell": 130,
          "subCategoryName": "Massage Therapy",
          "providerName": "Serenity Wellness Spa",
          "providerId": "673f0001...",
          "distance": 3.45
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
}
```

---

### 4.3 Popular Services
List of top-rated & most booked services.

- **URL:** `{{BASE_URL}}/api/v1/service/popular`
- **Method:** `GET`
- **Auth:** Optional
- **Headers:**
  - `Authorization: Bearer <USER_JWT_TOKEN>` *(Optional)*
  - `Accept: application/json`
- **Query Params:**
  - `lat` or `latitude` (optional)
  - `lng` or `longitude` (optional)
  - `page` (optional)
  - `limit` (optional)
  - `search` (optional)

#### Response Item (`distance` is in km):
```json
{
  "_id": "673f1234abcd...",
  "name": "Aromatherapy Session",
  "image": "/uploads/service/aroma.jpg",
  "servicefee": 15000,
  "avgRating": 5.0,
  "ratingCount": 56,
  "sell": 210,
  "partnerName": "Aura Spa Lekki",
  "partnerId": "673f9999...",
  "isVerified": true,
  "isCertified": true,
  "distance": 2.85
}
```

---

### 4.4 Nearest Popular Services
- **URL:** `{{BASE_URL}}/api/v1/service/nearest-popular`
- **Method:** `GET`
- **Auth:** Optional
- **Headers:**
  - `Authorization: Bearer <USER_JWT_TOKEN>` *(Optional)*
  - `Accept: application/json`
- **Query Params:**
  - `lat` or `latitude` (optional)
  - `lng` or `longitude` (optional)
  - `radius` (optional, in km, default: `200`)
  - `category` (optional)
  - `search` (optional)

---

### 4.5 All Services (Catalogue / Search Screen)
- **URL:** `{{BASE_URL}}/api/v1/service/all`
- **Method:** `GET`
- **Auth:** Optional
- **Headers:**
  - `Authorization: Bearer <USER_JWT_TOKEN>` *(Optional)*
  - `Accept: application/json`
- **Query Params:**
  - `lat` or `latitude` (optional)
  - `lng` or `longitude` (optional)
  - `radius` (optional, in km, default: `50`)
  - `categoryId` (optional)
  - `subCategoryId` (optional)
  - `rating` (optional)
  - `search` (optional)
  - `page` & `limit`

---

### 4.6 Single Service Details
Shows full details of a service including provider info, available time slots, passes, addons, and distance.

- **URL:** `{{BASE_URL}}/api/v1/service/details/:serviceId`
- **Method:** `GET`
- **Auth:** Optional
- **Headers:**
  - `Authorization: Bearer <USER_JWT_TOKEN>` *(Optional)*
  - `Accept: application/json`
- **Query Params:**
  - `lat` or `latitude` (optional): Real-time user latitude
  - `lng` or `longitude` (optional): Real-time user longitude

#### Example Request:
```bash
curl -X GET "https://api.auravive.com/api/v1/service/details/673f1234abcd?lat=6.4281&lng=3.3792" \
  -H "Accept: application/json"
```

#### Response (`200 OK`):
```json
{
  "status": "success",
  "statusCode": 200,
  "type": "Service",
  "message": "Service details successfully",
  "data": [
    {
      "_id": "673f1234abcd...",
      "name": "Swedish Full Body Massage",
      "description": "Relaxing pressure massage with organic essential oils.",
      "duration": "60 mins",
      "servicefee": 10000,
      "image": "/uploads/service/massage.jpg",
      "providerName": "Healing Hands Spa",
      "providerImage": "/uploads/users/provider.jpg",
      "providerId": "673f8888...",
      "number": "08012345678",
      "countryCode": "+234",
      "address": "12 Admiralty Way, Lekki Phase 1, Lagos",
      "distance": 4.15,
      "platformFeePercent": 5,
      "avgRating": 4.9,
      "ratingCount": 88,
      "isFavourite": false,
      "availability": [ ... ],
      "addons": [ ... ],
      "pass": [ ... ]
    }
  ]
}
```

---

### 4.7 Single Partner / Provider Details
- **URL:** `{{BASE_URL}}/api/v1/partner/details/:partnerUserId`
- **Method:** `GET`
- **Auth:** Optional
- **Headers:**
  - `Authorization: Bearer <USER_JWT_TOKEN>` *(Optional)*
  - `Accept: application/json`
- **Query Params:**
  - `lat` or `latitude` (optional)
  - `lng` or `longitude` (optional)

#### Response Projection:
Includes `"distance": 4.15` (in km) when location is provided, or `"distance": null` when omitted.

---

### 4.8 User Favourites
- **URL:** `{{BASE_URL}}/api/v1/favourite/my-fav`
- **Method:** `GET`
- **Auth:** **Mandatory** (`auth(['user'])`)
- **Required Headers:**
  - `Authorization: Bearer <USER_JWT_TOKEN>` *(Must be a valid token with `role: "user"`)*
  - `Accept: application/json`
- **Query Params:**
  - `lat` or `latitude` (optional)
  - `lng` or `longitude` (optional)

> [!WARNING]
> This endpoint strictly requires a Customer User token. Passing a Partner or Admin token will return:
> `HTTP 401: {"status":"Error","statusCode":401,"message":"You are not authorized"}`

#### Example Request:
```bash
curl -X GET "https://api.auravive.com/api/v1/favourite/my-fav?lat=6.4281&lng=3.3792" \
  -H "Authorization: Bearer YOUR_USER_ACCESS_TOKEN" \
  -H "Accept: application/json"
```

#### Response Projection:
Each favorited service card includes `"distance"` calculated from dynamic location (or fallback to profile location).

---

## 5. Client Implementation Guidelines for Mobile Apps & Web

### 5.1 Complete Flutter / Dio Implementation with Auto-Location & Token Interceptor

Here is an end-to-end Flutter client demonstrating how to pass both real-time GPS coordinates and the `Authorization` header cleanly:

```dart
import 'package:dio/dio.dart';
import 'package:geolocator/geolocator.dart';

class AuraViveApiClient {
  final Dio _dio;
  final String baseUrl;
  final Future<String?> Function() getUserToken;

  AuraViveApiClient({
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
    // Interceptor: Injects Bearer Token (if logged in)
    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final token = await getUserToken();
          // Only attach Authorization header if user is logged in
          if (token != null && token.isNotEmpty) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          return handler.next(options);
        },
      ),
    );
  }

  /// Helper: Get current device GPS coordinates (or null if denied/disabled)
  Future<Position?> _getCurrentLocation() async {
    try {
      bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) return null;

      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) return null;
      }
      if (permission == LocationPermission.deniedForever) return null;

      return await Geolocator.getCurrentPosition(
        timeLimit: const Duration(seconds: 5),
      );
    } catch (_) {
      return null;
    }
  }

  /// 1. Home Screen API (Guest-friendly, with dynamic GPS)
  Future<Map<String, dynamic>> getHomeData() async {
    final pos = await _getCurrentLocation();
    final queryParams = <String, dynamic>{};
    if (pos != null) {
      queryParams['lat'] = pos.latitude;
      queryParams['lng'] = pos.longitude;
    }

    final response = await _dio.get('/api/v1/home/home', queryParameters: queryParams);
    return response.data['data'];
  }

  /// 2. View All Nearest Services
  Future<Map<String, dynamic>> getAllNearestServices({
    int page = 1,
    int limit = 10,
    String? search,
  }) async {
    final pos = await _getCurrentLocation();
    final queryParams = <String, dynamic>{
      'page': page,
      'limit': limit,
      if (search != null && search.isNotEmpty) 'search': search,
      if (pos != null) ...{
        'lat': pos.latitude,
        'lng': pos.longitude,
      },
    };

    final response = await _dio.get('/api/v1/home/all-nearest', queryParameters: queryParams);
    return response.data['data']['nearest'];
  }

  /// 3. Service Details Screen
  Future<Map<String, dynamic>> getServiceDetails(String serviceId) async {
    final pos = await _getCurrentLocation();
    final queryParams = <String, dynamic>{
      if (pos != null) ...{
        'lat': pos.latitude,
        'lng': pos.longitude,
      },
    };

    final response = await _dio.get(
      '/api/v1/service/details/$serviceId',
      queryParameters: queryParams,
    );
    return response.data['data'][0];
  }

  /// 4. User Favourites (Requires User Login)
  Future<List<dynamic>> getUserFavourites() async {
    final pos = await _getCurrentLocation();
    final queryParams = <String, dynamic>{
      if (pos != null) ...{
        'lat': pos.latitude,
        'lng': pos.longitude,
      },
    };

    final response = await _dio.get(
      '/api/v1/favourite/my-fav',
      queryParameters: queryParams,
    );
    return response.data['data'];
  }
}
```

---

### 5.2 How to Display the Distance in UI
```dart
Widget buildDistanceBadge(num? distance) {
  if (distance == null) {
    return const SizedBox.shrink(); // Hide badge if location was not provided
  }
  return Row(
    children: [
      const Icon(Icons.location_on, size: 14, color: Colors.grey),
      const SizedBox(width: 2),
      Text(
        '${distance.toStringAsFixed(1)} km', // e.g. "3.5 km"
        style: const TextStyle(fontSize: 12, color: Colors.grey),
      ),
    ],
  );
}
```

---

## 6. Developer & AI Prompting Checklist

When asking an AI or assigning developers to integrate this in the client apps:

```markdown
- [ ] Centralize GPS retrieval: Create a `LocationService` that provides cached or live `{lat, lng}`.
- [ ] Attach `lat` and `lng` to `HttpInterceptor` or repository query parameters for:
      - [ ] Home Screen: `GET /api/v1/home/home`
      - [ ] All Nearest: `GET /api/v1/home/all-nearest`
      - [ ] Service Listing / Catalogue: `GET /api/v1/service/all`
      - [ ] Popular Services: `GET /api/v1/service/popular`
      - [ ] Nearest Popular Services: `GET /api/v1/service/nearest-popular`
      - [ ] Service Details Screen: `GET /api/v1/service/details/:id`
      - [ ] Partner Details Screen: `GET /api/v1/partner/details/:id`
      - [ ] Favourites Screen: `GET /api/v1/favourite/my-fav`
- [ ] Update Service Card & Details UI models:
      - [ ] Add `final double? distance;` to `ServiceModel` / `PartnerModel`.
      - [ ] If `distance != null`, render `${distance.toStringAsFixed(1)} km`.
      - [ ] If `distance == null`, hide distance pill or display "Distance unavailable" gracefully.
```
