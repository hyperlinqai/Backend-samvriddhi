# Samvriddhi Attendance Management API

This document provides a comprehensive overview of the Samvriddhi Attendance Management Backend API, designed for integrating with mobile applications (iOS/Android) and frontend web dashboards.

## Base Information

- **Base URL:** `{SERVER_URL}/api/v1`
- **Content-Type:** `application/json` (for all standard requests and responses)
- **Authentication:** Bearer Token via the `Authorization` header (`Authorization: Bearer <token>`). Required for all endpoints except where noted.

## Standard Response Format

**Success Response:**
```json
{
  "success": true,
  "message": "Optional localized message",
  "data": { ... } // Or an array
}
```

**Paginated Response:**
```json
{
  "success": true,
  "data": [ ... ],
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 20,
    "totalPages": 5,
    "hasNext": true,
    "hasPrev": false
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "message": "Error description",
  "code": "ERROR_CODE"
}
```

---

## 1. Authentication

### Register a User
* **Endpoint:** `POST /api/v1/auth/register`
* **Access:** Public (or Admin depending on logic)
* **Body:**
  * `email` (string, required)
  * `password` (string, min 6 chars, required)
  * `fullName` (string, required)
  * `phone` (string, required)
  * `role` (enum: `"SUPER_ADMIN", "SM_ADMIN", "RM", "ACCOUNTS"`, default: `"RM"`)
* **Response:** Returns newly created user details and tokens (if auto-login).

### Login
* **Endpoint:** `POST /api/v1/auth/login`
* **Access:** Public
* **Body:**
  * `email` (string, optional - either email or phone required)
  * `phone` (string, optional)
  * `password` (string, required)
* **Response:** `{ user: {...}, token: "jwt_token", refreshToken: "jwt_refresh" }`

### Refresh Token
* **Endpoint:** `POST /api/v1/auth/refresh-token`
* **Access:** Public
* **Body:**
  * `refreshToken` (string, required)
* **Response:** `{ token: "new_jwt_token", refreshToken: "new_jwt_refresh" }`

### Change Password
* **Endpoint:** `POST /api/v1/auth/change-password`
* **Access:** Authenticated
* **Body:**
  * `currentPassword` (string, required)
  * `newPassword` (string, min 6 chars, required)
* **Response:** Success message.

### Get Profile
* **Endpoint:** `GET /api/v1/auth/profile`
* **Access:** Authenticated
* **Response:** Current user details.

---

## 2. Users

### List Users
* **Endpoint:** `GET /api/v1/users`
* **Access:** Admin (`SUPER_ADMIN`, `SM_ADMIN`)
* **Query Params:**
  * `role` (enum: `"SUPER_ADMIN", "SM_ADMIN", "RM", "ACCOUNTS"`)
  * `isActive` (boolean as string, e.g., `"true"`)
  * `search` (string)
  * `page` (number, default: 1)
  * `limit` (number, default: 20)
* **Response:** Paginated list of users.

### Get User by ID
* **Endpoint:** `GET /api/v1/users/:userId`
* **Access:** Admin or the Owner of the profile
* **Response:** User details including manager and subordinates.

### Update User
* **Endpoint:** `PATCH /api/v1/users/:userId`
* **Access:** Admin (`SUPER_ADMIN`, `SM_ADMIN`)
* **Body:**
  * `fullName` (string)
  * `phone` (string)
  * `role` (string)
  * `isActive` (boolean)
  * `managerId` (uuid/string)
* **Response:** Updated user details.

### Deactivate User
* **Endpoint:** `DELETE /api/v1/users/:userId`
* **Access:** `SUPER_ADMIN`
* **Response:** 204 No Content.

---

## 3. Attendance

### Check-In
* **Endpoint:** `POST /api/v1/attendance/check-in`
* **Access:** Authenticated
* **Body:**
  * `lat` (number, required)
  * `lng` (number, required)
  * `locationType` (enum: `"HOME", "OFFICE", "FIELD"`, required)
  * `selfieUrl` (string, required)
  * `batteryLevel` (number, optional)
* **Response:** Check-in record details.

### Check-Out
* **Endpoint:** `POST /api/v1/attendance/check-out`
* **Access:** Authenticated
* **Body:**
  * `attendanceId` (uuid, required)
  * `lat` (number, required)
  * `lng` (number, required)
  * `batteryLevel` (number, optional)
* **Response:** Updated attendance record showing checkout time.

### Get Today's Status
* **Endpoint:** `GET /api/v1/attendance/today`
* **Access:** Authenticated
* **Response:** User's attendance record for the current day, if any.

### Get Attendance Summary
* **Endpoint:** `GET /api/v1/attendance/summary`
* **Access:** Authenticated
* **Response:** High-level summary of active attendances, etc.

### List Attendance
* **Endpoint:** `GET /api/v1/attendance`
* **Access:** Authenticated (Admins see all; RM sees only own unless specifically scoped)
* **Query Params:**
  * `startDate` (string, `YYYY-MM-DD`)
  * `endDate` (string, `YYYY-MM-DD`)
  * `userId` (uuid)
  * `page`, `limit`
* **Response:** Paginated list of attendance records with embedded user details.

### Auto-Close Attendance (Admin)
* **Endpoint:** `POST /api/v1/attendance/auto-close`
* **Access:** Admin (`SUPER_ADMIN`, `SM_ADMIN`)
* **Response:** Forces checkout for attendances left open from the previous day.

---

## 4. Visits

### Log a Visit
* **Endpoint:** `POST /api/v1/visits`
* **Access:** Authenticated
* **Body:**
  * `attendanceId` (uuid, required)
  * `cspId` (uuid, optional)
  * `lat` (number, required)
  * `lng` (number, required)
  * `address` (string, optional)
  * `purpose` (string, required)
  * `notes` (string, optional)
* **Response:** Visit record details with `geoTaggedAt` timestamp.

### List Visits
* **Endpoint:** `GET /api/v1/visits`
* **Access:** Authenticated
* **Query Params:**
  * `attendanceId` (uuid)
  * `startDate`, `endDate` (string, `YYYY-MM-DD`)
  * `page`, `limit`
* **Response:** Paginated list of visits.

### Get Visit by ID
* **Endpoint:** `GET /api/v1/visits/:id`
* **Access:** Authenticated
* **Response:** Visit details including `csp` and `user` data.

---

## 5. Leads (CRM)

### Create Lead
* **Endpoint:** `POST /api/v1/leads`
* **Access:** Authenticated
* **Body:**
  * `name`, `phone` (string, required)
  * `email`, `address`, `notes`, `source` (string, optional)
  * `assignedToId` (uuid, optional. Defaults to requesting user)
  * `lat`, `lng` (number, optional)
* **Response:** Newly created lead.

### List Leads
* **Endpoint:** `GET /api/v1/leads`
* **Access:** Authenticated
* **Query Params:**
  * `status` (enum: `"NEW", "CONTACTED", "QUALIFIED", "PROPOSAL_SENT", "NEGOTIATION", "WON", "LOST"`)
  * `assignedToId` (uuid)
  * `search` (string)
  * `page`, `limit`
* **Response:** Paginated lead list.

### Get Lead by ID
* **Endpoint:** `GET /api/v1/leads/:id`
* **Access:** Authenticated
* **Response:** Details of a specific lead.

### Update Lead
* **Endpoint:** `PATCH /api/v1/leads/:id`
* **Access:** Authenticated
* **Body:** Elements to update from `status`, `name`, `phone`, `email`, `address`, `assignedToId`, `notes`, `documentUrls`.
* **Response:** Updated lead object.

### Delete Lead
* **Endpoint:** `DELETE /api/v1/leads/:id`
* **Access:** Admin (`SUPER_ADMIN`, `SM_ADMIN`)
* **Response:** Success message.

---

## 6. Expenses

### Create Expense
* **Endpoint:** `POST /api/v1/expenses`
* **Access:** Authenticated
* **Body:**
  * `date` (string `YYYY-MM-DD`, required)
  * `category` (string, required)
  * `amount` (number, required)
  * `description` (string, optional)
  * `startLat`, `startLng`, `endLat`, `endLng` (number, optional) - Used for auto-calculating distance (auto KM).
  * `manualKm` (number, optional)
* **Response:** Expense created with `PENDING` status.

### List Expenses
* **Endpoint:** `GET /api/v1/expenses`
* **Access:** Authenticated
* **Query Params:**
  * `status` (enum: `"PENDING", "APPROVED", "REJECTED", "RESUBMITTED"`)
  * `startDate`, `endDate` (string, `YYYY-MM-DD`)
  * `userId` (uuid)
  * `page`, `limit`
* **Response:** Paginated list of expenses.

### Approve/Reject Expense
* **Endpoint:** `PATCH /api/v1/expenses/:id/status`
* **Access:** `SUPER_ADMIN`, `SM_ADMIN`, `ACCOUNTS`
* **Body:**
  * `status` (enum: `"APPROVED", "REJECTED"`, required)
  * `approvalNote` (string, optional)
* **Response:** Updated expense.

### Get Expense by ID
* **Endpoint:** `GET /api/v1/expenses/:id`
* **Access:** Authenticated
* **Response:** Single expense details, including approver info.

---

## 7. Route Management & CSPs

### Create Route
* **Endpoint:** `POST /api/v1/routes`
* **Access:** Admin (`SUPER_ADMIN`, `SM_ADMIN`)
* **Body:**
  * `name` (string, required)
  * `description` (string, optional)
  * `areas` (Array of `{name, lat, lng, radius}`)
* **Response:** Newly created route.

### Get All Active Routes
* **Endpoint:** `GET /api/v1/routes`
* **Access:** Authenticated
* **Response:** List of routes and active assigned CSPs.

### Get Route by ID
* **Endpoint:** `GET /api/v1/routes/:id`
* **Access:** Authenticated
* **Response:** Route specifics, its CSPs, and active assignments.

### Delete Route
* **Endpoint:** `DELETE /api/v1/routes/:id`
* **Access:** `SUPER_ADMIN`
* **Response:** Marks route inactive (204 No Content).

### Create CSP (Customer Service Point)
* **Endpoint:** `POST /api/v1/routes/csps`
* **Access:** Admin (`SUPER_ADMIN`, `SM_ADMIN`)
* **Body:**
  * `name`, `code` (string, required)
  * `routeId` (uuid, required)
  * `lat`, `lng` (number, required)
  * `address`, `contactPerson`, `phone` (string, optional)
* **Response:** Created CSP record.

### Get All Active CSPs
* **Endpoint:** `GET /api/v1/routes/csps/all`
* **Access:** Authenticated
* **Response:** List of all active CSPs.

### Assign Route to User
* **Endpoint:** `POST /api/v1/routes/assignments`
* **Access:** Admin (`SUPER_ADMIN`, `SM_ADMIN`)
* **Body:**
  * `userId`, `routeId` (uuid, required)
  * `startDate` (string `YYYY-MM-DD`, required)
  * `endDate` (string `YYYY-MM-DD`, optional)
* **Response:** Active Assignment record.

---

## 8. Discrepancies

### Raise Discrepancy
* **Endpoint:** `POST /api/v1/discrepancies`
* **Access:** Authenticated
* **Body:**
  * `type` (enum: `"ATTENDANCE", "EXPENSE", "VISIT", "OTHER"`, required)
  * `relatedEntityId` (uuid, required)
  * `relatedEntityType` (string, required)
  * `description` (string, min 10 chars, required)
* **Response:** Discrepancy record detail.

### List Discrepancies
* **Endpoint:** `GET /api/v1/discrepancies`
* **Access:** Authenticated
* **Query Params:**
  * `status` (enum: `"PENDING", "APPROVED", "REJECTED"`)
  * `type` (enum)
  * `page`, `limit`
* **Response:** Paginated list of discrepancies.

### Resolve Discrepancy
* **Endpoint:** `PATCH /api/v1/discrepancies/:id/resolve`
* **Access:** Admin (`SUPER_ADMIN`, `SM_ADMIN`)
* **Body:**
  * `status` (enum: `"APPROVED", "REJECTED"`, required)
  * `resolutionNotes` (string, required)
* **Response:** Updated discrepancy record.

### Get Discrepancy by ID
* **Endpoint:** `GET /api/v1/discrepancies/:id`
* **Access:** Authenticated
* **Response:** Full details of a discrepancy object.

---

## 9. Audit Logs

### List Audit Logs
* **Endpoint:** `GET /api/v1/audit-logs`
* **Access:** Admin (`SUPER_ADMIN`, `SM_ADMIN`)
* **Query Params:**
  * `userId`, `entityId` (uuid)
  * `entityType`, `action` (string)
  * `startDate`, `endDate` (string, `YYYY-MM-DD`)
  * `page`, `limit`
* **Response:** Paginated stream of audit log entries.

### Get Audit Trail for Entity
* **Endpoint:** `GET /api/v1/audit-logs/entity/:entityType/:entityId`
* **Access:** Admin (`SUPER_ADMIN`, `SM_ADMIN`)
* **Response:** Activity log isolated to a singular entity over time.
