# Purchase Manager Backend

A standalone Express service for the Purchase Manager portal. It connects to the
**same MongoDB database** as the rest of the CRM, but keeps all Purchase Manager
data in its **own collections** — nothing in the Sales Head / Manager / BDE /
Coordinator collections is touched.

## Collections (same database)
- `purchase_managers` — Purchase Manager accounts (role `purchase_manager`), created by the Sales Head.
- `purchase_suppliers` — vendors.
- `purchase_orders` — purchase-order material lines.

When Purchase Manager needs existing CRM data (leads, clients, orders, products),
read the existing CRM collections by reference — do not duplicate them.

## APIs
- `POST /api/auth/login` · `GET /api/auth/me` · `POST /api/auth/logout`
- `POST /api/auth/forgot-password` · `/verify-otp` · `/reset-password`
- `GET/POST/PUT/DELETE /api/suppliers`
- `GET/POST/PUT/DELETE /api/orders`

Every data route requires a valid token (shared `JWT_SECRET`) and a permitted
role (`purchase_manager` or `Sales Head`) — enforced server-side.

## Setup
```bash
cp .env.example .env     # set MONGO_URI (same as Head) and the SAME JWT_SECRET
npm install
npm start                # http://localhost:5003
```

## Account creation
Purchase Manager accounts are created by the **Sales Head** (Head portal →
Settings → Purchase Manager Accounts), which writes to `purchase_managers`.
This backend reads that collection to authenticate logins.

## Deploy (Render)
New Web Service · root = this folder · build `npm install` · start `npm start` ·
env `MONGO_URI` (same as Head), `JWT_SECRET` (same as Head), `CLIENT_URL` (the
deployed Purchase frontend URL).
