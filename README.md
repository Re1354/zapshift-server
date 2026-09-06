# 📦 ZapShift Server

ZapShift Server is the core backend REST API for the **ZapShift** parcel delivery & logistics platform. Built using **Node.js**, **Express**, and **MongoDB**, it features a clean feature-based modular architecture, role-based access control (RBAC), Firebase Authentication, Stripe checkout integration, and parcel tracking.

---

## 🚀 Key Features

- **Modular Architecture**: Organized into feature-driven modules (`user`, `rider`, `parcel`, `payment`, `tracking`) separating routes, controllers, and services.
- **Authentication & Security**:
  - Firebase Admin SDK Bearer token authentication.
  - Role-based authorization middleware (`User`, `Rider`, `Admin`).
  - Security headers via Helmet, CORS protection, and rate limiting with `express-rate-limit`.
- **Parcel Lifecycle Management**:
  - Booking, dynamic cost validation, state machine transitions (`driver-assigned`, `driver-accepted`, `picked-up`, `in-transit`, `delivered`).
- **Rider Operations**:
  - Rider onboarding applications, approval workflow, and daily delivery performance aggregation.
- **Payment Processing**:
  - Seamless Stripe Checkout Sessions with automated status confirmation and audit logs.
- **Public Parcel Tracking**:
  - Real-time audit trail and parcel tracking lookup by unique Tracking ID.

---

## 🛠️ Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js (v5)
- **Database**: MongoDB (Native Driver v7)
- **Authentication**: Firebase Admin SDK
- **Payments**: Stripe API
- **Security**: Helmet, Express Rate Limit, CORS

---

## 📁 Project Structure

```text
ZapShiftServer/
├── config/             # DB connection, Firebase Admin, Stripe configurations
├── middlewares/        # Auth, Admin, Rider checks & Rate limiting
├── modules/            # Feature modules (routes, controllers, services)
│   ├── user/           # User profiles & role management
│   ├── rider/          # Rider applications & deliveries
│   ├── parcel/         # Parcel bookings, assignments, & status updates
│   ├── payment/        # Stripe checkout & payment verification
│   └── tracking/       # Public tracking queries & logs
├── routes/             # Central route aggregator
├── utils/              # Tracking ID generator & audit logger
├── app.js              # Express app pipeline & middleware setup
└── index.js            # Server entrypoint & DB lifecycle manager
```

---

## ⚙️ Environment Variables

Create a `.env` file in the root of `ZapShiftServer/`:

```env
PORT=3000
CLIENT_URL=http://localhost:5173
SITE_DOMAIN=http://localhost:5173
DB_USER=your_mongodb_user
DB_PASS=your_mongodb_password
STRIPE_PAYMENT_SECRET=your_stripe_secret_key
FB_SERVICE_KEY=optional_base64_encoded_firebase_admin_key
```

Place your Firebase service account key as `zap-shift-firebase-adminsdk.json` in the server root (or provide it via `FB_SERVICE_KEY`).

---

## 🏃 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Run in Development Mode (with auto-watch)
```bash
npm run dev
```

### 3. Run in Production Mode
```bash
npm start
```

---

## 📡 API Endpoints Overview

| Module | Method | Endpoint | Access |
| :--- | :--- | :--- | :--- |
| **System** | `GET` | `/` | Public |
| **Users** | `GET` | `/users` | Admin |
| | `GET` | `/users/role` | Authenticated |
| | `GET` | `/users/:id` | Admin |
| | `POST` | `/users` | Authenticated |
| | `PATCH` | `/users/:id/role` | Admin |
| **Riders** | `GET` | `/riders/delivery-per-day`| Rider |
| | `POST` | `/riders` | Authenticated |
| | `GET` | `/riders` | Admin |
| | `PATCH` | `/riders/:id` | Admin |
| **Parcels**| `GET` | `/parcels/delivery-status/stats` | Admin |
| | `GET` | `/parcels` | Authenticated |
| | `GET` | `/parcels/rider` | Rider |
| | `PATCH` | `/parcels/:id/delivery-status` | Rider |
| | `PATCH` | `/parcels/:id` | Admin |
| | `GET` | `/parcels/:id` | Owner / Admin |
| | `POST` | `/parcels` | Authenticated |
| | `DELETE` | `/parcels/:id` | Owner |
| **Payments** | `POST` | `/payment-checkout-session` | Owner |
| | `PATCH` | `/payment-success` | Owner |
| | `GET` | `/payments` | Authenticated |
| **Tracking** | `GET` | `/trackings/:trackingId` | Public |
