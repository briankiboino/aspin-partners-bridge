# Part 1: API Design & Documentation - Design a RESTful API endpoint specification for the customer registration flow between Aspin and PartnerCRM

## 1. Overview

This API manages customer registration and KYC (Know Your Customer) verification between **Aspin** (core insurance platform) and **PartnerCRM** (KYC and customer onboarding service).

The integration follows a decoupled architecture that separates **Customer Registration** (Profile Management) from **KYC Verification**. This design ensures reliability, idempotency, and efficient failure handling.

The integration enables:

- **Aspin** to upsert (create or update) customer profiles idempotently.
- **Aspin** to initiate or retry KYC verification independently.
- **PartnerCRM** to return immediate verification status (pending, approved, rejected).
- **PartnerCRM** to send webhook callbacks to Aspin whenever the verification status changes.

---

## 2. Architecture Summary

The following flow represents the interaction between the Core Insurance Platform and the KYC Provider:

**Data Flow Direction:**

1. `[Aspin]` → `POST /api/v1/customers` → `[PartnerCRM]` (Upsert Profile)
2. `[Aspin]` → `POST /api/v1/customers/{customer_id}/kyc` → `[PartnerCRM]` (Initiate KYC)
3. `[PartnerCRM]` → `POST /api/v1/webhooks/kyc-status` → `[Aspin]` (Async Status Callback)

### 2.1 Queue-Based Reliability

To prevent duplicate requests and handle transient failures, the integration employs a queue-based mechanism on the Aspin side:

1. **Enqueue:** Every customer registration request is placed into a persistent message queue within Aspin's infrastructure.
2. **Process:** A worker consumes the request and attempts to upsert the customer profile with PartnerCRM.
3. **Acknowledge (Success):** The task is removed from the queue _only_ after receiving an immediate success response (e.g., `200 OK` or `201 Created`) from PartnerCRM.
4. **Retry (Failure):** If the request fails (network error, 5xx response), the task remains in the queue (or moves to a retry queue) to be retriggered automatically.

This ensures **guaranteed delivery**, **no duplicates**, and **resilience** against temporary outages.

---

## 3. Authentication

All requests between Aspin and PartnerCRM use **Bearer Token** authentication with JWTs.

- **Header:** `Authorization: Bearer <access_token>`
- **Token lifetime:** 1 hour
- **Renewal:** Via OAuth 2.0 client credentials grant
- **Transport:** HTTPS only

---

## 4. Endpoints

### 4.1 Upsert Customer Profile (Idempotent)

**POST** `/api/v1/customers`

Creates a new customer profile or updates an existing one. This endpoint is idempotent, meaning multiple identical requests will have the same effect as a single request, preventing duplicate records.

**Request Body:**

```json
{
  "first_name": "John",
  "last_name": "Doe",
  "national_id": "123456789",
  "date_of_birth": "1985-04-12",
  "email": "john.doe@example.com",
  "phone_number": "+254700000000",
  "address": {
    "line1": "Lumumba Drive, Roysambu, Kasarani",
    "city": "Nairobi",
    "country": "KE"
  }
}
```

**Response:**

```json
{
  "customer_id": "3b61843d-af5c-4bde-934e-0ab90eab7bb7",
  "status": "active",
  "message": "Customer profile created successfully."
}
```

**Error Response Example:**

```json
{
  "error_code": "INVALID_REQUEST",
  "message": "Missing required field: national_id",
  "status": 400
}
```

**Possible Responses:**

| Status Code | Description |
| :--- | :--- |
| `200` | OK - Customer profile updated. |
| `201` | Created - New customer profile created. |
| `400` | INVALID_REQUEST - Missing or invalid field. |
| `401` | UNAUTHORIZED - Invalid or missing token. |
| `500` | INTERNAL_ERROR - Unexpected backend issue. |

### 4.2 Initiate KYC Verification

**POST** `/api/v1/customers/{customer_id}/kyc`

Triggers the KYC verification workflow for an existing customer. This endpoint uses the customer data already stored via the Upsert endpoint.

**Use Case:**

- Initial KYC request after successful registration.
- Retrying KYC verification if a previous attempt failed or timed out (Failover).

**Path Parameters:**

- `customer_id`: The unique identifier of the customer (e.g., `3b61843d-af5c-4bde-934e-0ab90eab7bb7`).

**Request Body:**

```json
{
  "reason": "INITIAL_REQUEST"
  // or "TIMEOUT_RETRY", "MANUAL_TRIGGER", etc.
}
```

**Response:**

```json
{
  "verification_id": "KYC-987654321",
  "status": "pending",
  "message": "KYC verification initiated."
}
```

**Error Response Example:**

```json
{
  "error_code": "DUPLICATE_ENTRY",
  "message": "KYC verification is already in progress for this customer.",
  "status": 409
}
```

**Possible Responses:**

| Status Code | Description |
| :--- | :--- |
| `200` | OK - KYC verification initiated successfully. |
| `400` | INVALID_REQUEST - Missing or invalid field. |
| `401` | UNAUTHORIZED - Invalid or missing token. |
| `404` | NOT_FOUND - Customer not found (cannot initiate KYC). |
| `409` | DUPLICATE_ENTRY - KYC verification already in progress. |
| `500` | INTERNAL_ERROR - Unexpected backend issue. |

### 4.3 Error Codes

Standard error codes used across the API to indicate failure reasons.

| Error Code | Description | HTTP Status |
| :--- | :--- | :--- |
| `INVALID_REQUEST` | Missing or invalid field | 400 |
| `UNAUTHORIZED` | Invalid/missing token | 401 |
| `DUPLICATE_ENTRY` | Customer already registered | 409 |
| `NOT_FOUND` | Customer not found | 404 |
| `INTERNAL_ERROR` | Unexpected issue | 500 |

---

## 5. Webhook Security

To ensure authenticity:

- PartnerCRM signs each webhook request with an **HMAC SHA256** signature using a shared secret.
- Aspin verifies the signature.

**Header Example:**
`X-Signature: sha256=5d42402abc1b2a76b9719d913017c592`

---

## 6. Design Decisions

## Why REST?

- REST is simple, widely adopted, and ideal for service-to-service communication over HTTP.
- JSON payloads are human-readable and easy to log/debug.
- It fits Aspin’s microservice-style architecture and external partner integrations.

### Why These Status Codes?

- **201:** Resource created (new customer record).
- **200:** Resource updated (existing customer record).
- **400/409:** Validation and duplication clarity.
- **401:** Standard authentication error.
- **500:** Catch-all for unexpected backend issues.

### Why Webhooks?

- Avoids constant polling from Aspin.
- Real-time status updates ensure smooth user flows (e.g., policy activation after approval).

### Why HMAC signatures for webhooks?

- Prevents spoofing; ensures that webhook requests are truly from PartnerCRM.

## 7. Improvement Proposal: Decoupling Registration & KYC

From the background scenario in the assesement documentation and my observations it is safe to say that my assumption about the current architecture is that Customer Registration and KYC Verification are tightly coupled into a single request opening room for duplicates, unreliability and inefficiency. This is also backed up by part 3 (Debugging & Troubleshooting) of the assesement where one of the bugs report is about duplicate customer registration requests. Based on this assumption, i recommend decoupling the **Customer Registration** from the **KYC Verification** request (s). The above API Design & Documentation works under the proposed solution and below iv'e outlined the assumed existing problem description and proposed solution

## 7.1 The Problem

Assuming the current architecture couples customer registration and KYC into a single request, if the KYC process fails (e.g., timeout or downstream service unavailable), Aspin might retry the entire registration request. This can lead to:

- **Duplicate Customer Records:** If the previous registration succeeded but the KYC step failed.
- **Redundant Data Transfer:** Sending full customer profiles repeatedly consumes unnecessary bandwidth.

### 7.2 Proposed Solution

Split the process into two distinct, idempotent operations:

1. **Upsert Customer Profile (Idempotent)**
   - **Endpoint:** `PUT /api/v1/customers/{customer_id}`
   - **Behavior:** Creates the customer if they don't exist, or updates them if they do. This ensures that retries are safe and don't create duplicates.

2. **Initiate KYC Verification**
   - **Endpoint:** `POST /api/v1/customers/{customer_id}/kyc`
   - **Behavior:** Triggers the KYC workflow using the already stored customer data.
   - **Benefit:** If KYC fails, Aspin only needs to retry this lightweight request, not the full registration.

### 7.3 Queue-Based Registration Handling

To further prevent duplicate requests and handle transient failures, i recommend implementing a queue system for the registration process.

- **Workflow:**
  1. **Enqueue:** Every customer registration request from Aspin is placed into a persistent message queue.
  2. **Process:** A worker consumes the request and attempts to register the customer with PartnerCRM.
  3. **Acknowledge (Success):** The task is removed from the queue _only_ after receiving an immediate success response (e.g., `201 Created`) from PartnerCRM.
  4. **Retry (Failure):** If the request fails (network error, 5xx response), the task remains in the queue (or moves to a retry queue) to be retriggered automatically.

- **Benefits:**
  - **Guaranteed Delivery:** Ensures no registration requests are lost due to temporary outages.
  - **No Duplicates:** Successful processing removes the task, preventing accidental re-submission.
  - **Resilience:** Failed requests are automatically retried without requiring manual intervention from Aspin.
