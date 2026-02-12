# Part 1: API Design & Documentation - Design a RESTful API endpoint specification for the customer registration flow between Aspin and PartnerCRM

This API enables customer registration and KYC (Know Your Customer) verification between **Aspin** (insurance platform) and **PartnerCRM** (KYC provider).

## Key Feature

- Synchronous customer registration
- Asynchronous KYC verification
- Webhook-based status notifications
- Support for both individual and corporate customers
- Comprehensive error handling
- Idempotent operations

### Workflow

```
1. Aspin → POST /customers/register → PartnerCRM
2. PartnerCRM → Immediate response (pending status)
3. PartnerCRM → Performs KYC verification (async)
4. PartnerCRM → POST /webhooks/kyc-status → Aspin (callback)
5. Aspin → GET /customers/{id} → PartnerCRM (optional status check)
```

---

## Design Decisions

### Why REST?

**Chosen:** REST API
**Alternative Considered:** GraphQL, gRPC

**Reasoning:**

1. **Simplicity**: REST is universally understood and requires no special tooling
2. **HTTP Standard**: Leverages HTTP methods (GET, POST) naturally
3. **Caching**: HTTP caching works out-of-the-box for GET requests
4. **Webhooks**: REST webhooks are standard practice for async notifications
5. **Tooling**: Extensive tooling (Postman, Swagger UI, curl) available

### Why These HTTP Methods?

| Method   | Endpoint               | Reasoning                                               |
| -------- | ---------------------- | ------------------------------------------------------- |
| **POST** | `/customers/register`  | Creating a new resource (customer record)               |
| **GET**  | `/customers/{id}`      | Retrieving existing resource (idempotent, cacheable)    |
| **POST** | `/webhooks/kyc-status` | Sending notification (not creating a resource on Aspin) |

### Why These Status Codes?

| Status Code                   | Usage                           | Reasoning                                                       |
| ----------------------------- | ------------------------------- | --------------------------------------------------------------- |
| **200 OK**                    | Idempotent registration request | Customer already exists, returning existing record              |
| **201 Created**               | New customer registered         | New resource created successfully                               |
| **400 Bad Request**           | Invalid request data            | Client error - fix request and retry                            |
| **401 Unauthorized**          | Invalid API key                 | Authentication failure                                          |
| **404 Not Found**             | Customer doesn't exist          | Requested resource not found                                    |
| **409 Conflict**              | Duplicate ID number             | Resource conflict (e.g., ID already registered)                 |
| **422 Unprocessable Entity**  | Valid format but logical error  | Data is valid but cannot be processed (e.g., expired documents) |
| **429 Too Many Requests**     | Rate limit exceeded             | Client sending too many requests                                |
| **500 Internal Server Error** | Server-side error               | Something went wrong on PartnerCRM side                         |

### Why Asynchronous Processing?

**Pattern:** Synchronous request + Async processing + Webhook callback

**Reasoning:**

1. **KYC takes time**: Manual document review can take 24-48 hours
2. **Better UX**: Don't keep HTTP connection open for hours
3. **Reliability**: Webhooks can be retried if Aspin is temporarily down
4. **Scalability**: PartnerCRM can process verifications in batches

**Flow:**

```
Aspin sends request → PartnerCRM responds immediately (pending)
                   → PartnerCRM verifies in background
                   → PartnerCRM sends webhook when done
```

### Why Webhook Signatures?

**Security Measure:** HMAC-SHA256 signatures

**Reasoning:**

1. **Authenticity**: Prove webhook came from PartnerCRM
2. **Integrity**: Detect if payload was tampered with
3. **Replay Protection**: Combined with webhook_id for idempotency

**How it works:**

```
1. PartnerCRM calculates: HMAC-SHA256(webhook_body, shared_secret)
2. PartnerCRM sends signature in X-Webhook-Signature header
3. Aspin recalculates signature and compares
4. If match → authentic, if not → reject
```

### Why Idempotency?

**Implementation:**

- `reference_id` for customer registration
- `webhook_id` for webhook callbacks

**Reasoning:**

1. **Network Failures**: Same request might be sent multiple times due to timeouts
2. **Retries**: Failed requests should be safely retryable
3. **Webhooks**: Same webhook might be delivered multiple times

**Benefits:**

- Safe to retry failed requests
- Duplicate webhooks don't cause issues
- Consistent state even with network problems

### Why JSON?

**Chosen:** JSON (application/json)
**Alternative Considered:** XML, Protocol Buffers

**Reasoning:**

1. **Universally supported**: Every language has JSON libraries
2. **Human-readable**: Easy to debug and test
3. **Lightweight**: Smaller payload than XML
4. **JavaScript native**: Works seamlessly with web frontends

---

## Authentication

### API Key Authentication

**Method:** API keys in HTTP headers

**Header Name:** `X-API-Key`

**Example:**

```http
POST /v1/customers/register HTTP/1.1
Host: api.partnercrm.com
X-API-Key: pk_live_51HxYzA2e...
Content-Type: application/json
```

### Why API Keys?

**Chosen:** API Keys
**Alternative Considered:** OAuth 2.0, JWT

**Reasoning:**

1. **Server-to-Server**: This is M2M (machine-to-machine) communication
2. **Simplicity**: No token refresh logic needed
3. **Performance**: No token validation overhead
4. **Security**: Can be rotated if compromised

---

## Endpoints

### 1. Register Customer

**Purpose:** Submit customer details for KYC verification

#### Request

```http
POST /v1/customers/register HTTP/1.1
Host: api.partnercrm.com
X-API-Key: pk_live_51HxYzA2e...
Content-Type: application/json

{
  "reference_id": "ASPIN_CUST_001",
  "customer_type": "individual",
  "personal_details": {
    "first_name": "John",
    "last_name": "Smith",
    "date_of_birth": "1985-06-15",
    "nationality": "KE"
  },
  "contact_details": {
    "email": "john.smith@example.com",
    "phone_number": "+254712345678",
    "address": {
      "street": "123 Kimathi Street",
      "city": "Nairobi",
      "postal_code": "00100",
      "country": "KE"
    }
  },
  "identification": {
    "id_type": "national_id",
    "id_number": "12345678",
    "id_issue_date": "2020-01-15",
    "id_expiry_date": "2030-01-15"
  },
  "documents": [
    {
      "document_type": "id_front",
      "document_url": "https://aspin-storage.com/docs/id_front_001.jpg"
    },
    {
      "document_type": "id_back",
      "document_url": "https://aspin-storage.com/docs/id_back_001.jpg"
    }
  ],
  "callback_url": "https://api.aspin.com/webhooks/kyc-status",
  "metadata": {
    "policy_number": "POL-2026-001",
    "agent_id": "AGT-456"
  }
}
```

#### Success Response (201 Created)

```json
{
  "success": true,
  "data": {
    "customer_id": "CRM_CUST_789012",
    "reference_id": "ASPIN_CUST_001",
    "verification_status": "pending",
    "created_at": "2026-02-12T10:30:00Z",
    "estimated_completion": "2026-02-14T10:30:00Z"
  },
  "message": "Customer registration initiated. KYC verification in progress."
}
```

#### Idempotent Response (200 OK)

If same `reference_id` is sent again:

```json
{
  "success": true,
  "data": {
    "customer_id": "CRM_CUST_789012",
    "reference_id": "ASPIN_CUST_001",
    "verification_status": "approved",
    "created_at": "2026-02-10T08:20:00Z",
    "verified_at": "2026-02-11T14:35:00Z"
  },
  "message": "Customer already registered."
}
```

#### Error Response (400 Bad Request)

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request data",
    "details": [
      {
        "field": "personal_details.date_of_birth",
        "message": "Date of birth must be in YYYY-MM-DD format"
      },
      {
        "field": "contact_details.phone_number",
        "message": "Phone number must include country code"
      }
    ]
  },
  "request_id": "req_abc123"
}
```

#### Field Validation Rules

| Field           | Rules                                     | Example            |
| --------------- | ----------------------------------------- | ------------------ |
| `reference_id`  | Required, unique, 1-100 chars             | "ASPIN_CUST_001"   |
| `email`         | Required, valid email format              | "john@example.com" |
| `phone_number`  | Required, E.164 format                    | "+254712345678"    |
| `date_of_birth` | Required, YYYY-MM-DD, age 18+             | "1985-06-15"       |
| `id_number`     | Required, alphanumeric                    | "12345678"         |
| `document_url`  | Required, HTTPS only, publicly accessible | "https://..."      |
| `callback_url`  | Required, HTTPS only, valid URL           | "https://..."      |

---

### 2. Get Customer Status

**Purpose:** Check current KYC verification status

### Request

```http
GET /v1/customers/CRM_CUST_789012 HTTP/1.1
Host: api.partnercrm.com
X-API-Key: pk_live_51HxYzA2e...
```

#### Response (200 OK)

Status: Pending

```json
{
  "success": true,
  "data": {
    "customer_id": "CRM_CUST_789012",
    "reference_id": "ASPIN_CUST_001",
    "verification_status": "pending",
    "verification_stage": "document_review",
    "created_at": "2026-02-12T10:30:00Z",
    "estimated_completion": "2026-02-14T10:30:00Z"
  }
}
```

Status: Approved

```json
{
  "success": true,
  "data": {
    "customer_id": "CRM_CUST_789012",
    "reference_id": "ASPIN_CUST_001",
    "verification_status": "approved",
    "verified_at": "2026-02-13T15:20:00Z",
    "verification_score": 95,
    "risk_level": "low",
    "verified_documents": ["id_front", "id_back"]
  }
}
```

Status: Rejected

```json
{
  "success": true,
  "data": {
    "customer_id": "CRM_CUST_789012",
    "reference_id": "ASPIN_CUST_001",
    "verification_status": "rejected",
    "rejected_at": "2026-02-13T16:45:00Z",
    "rejection_reasons": [
      {
        "code": "DOCUMENT_MISMATCH",
        "message": "ID number on document does not match provided details"
      },
      {
        "code": "POOR_DOCUMENT_QUALITY",
        "message": "ID images are unclear or illegible"
      }
    ],
    "next_steps": "Please resubmit with clearer images and correct details"
  }
}
```

---

## Webhook Integration

### Overview

PartnerCRM sends webhook notifications to Aspin when KYC verification status changes.

### Webhook Endpoint (Implemented by Aspin)

```
POST https://api.aspin.com/webhooks/kyc-status
```

### Webhook Payload

```json
{
  "webhook_id": "whk_abc123xyz",
  "event_type": "kyc.verification.completed",
  "timestamp": "2026-02-13T15:20:00Z",
  "data": {
    "customer_id": "CRM_CUST_789012",
    "reference_id": "ASPIN_CUST_001",
    "previous_status": "pending",
    "current_status": "approved",
    "verified_at": "2026-02-13T15:20:00Z",
    "verification_score": 95,
    "risk_level": "low",
    "verified_documents": ["id_front", "id_back"]
  }
}
```

### Webhook Signature Verification

**Header:** `X-Webhook-Signature: sha256=<signature>`

**Validation Steps:**

1. Extract raw request body
2. Calculate HMAC-SHA256 using shared secret
3. Compare with header signature
4. Reject if mismatch

### Webhook Retry Logic

PartnerCRM retries failed webhooks with exponential backoff:

| Attempt | Delay      | Total Time |
| ------- | ---------- | ---------- |
| 1       | Immediate  | 0 min      |
| 2       | 1 minute   | 1 min      |
| 3       | 5 minutes  | 6 min      |
| 4       | 15 minutes | 21 min     |
| 5       | 1 hour     | 1hr 21min  |
| 6       | 6 hours    | 7hr 21min  |

**Success Criteria:** 2xx status code response

### Webhook Idempotency

**Problem:** Same webhook might be delivered multiple times

**Solution:** Use `webhook_id` to detect duplicates

**Implementation:**

## Error Handling

### Error Response Format

All errors follow consistent format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": [
      {
        "field": "field_name",
        "message": "Specific error for this field"
      }
    ]
  },
  "request_id": "req_abc123"
}
```

### Error Codes

| Code                         | HTTP Status | Description                     | Action                    |
| ---------------------------- | ----------- | ------------------------------- | ------------------------- |
| `VALIDATION_ERROR`           | 400         | Invalid request format          | Fix request data          |
| `MISSING_DOCUMENTS`          | 400         | Required documents not provided | Upload missing documents  |
| `UNAUTHORIZED`               | 401         | Invalid/missing API key         | Check API key             |
| `CUSTOMER_NOT_FOUND`         | 404         | Customer doesn't exist          | Verify customer ID        |
| `DUPLICATE_CUSTOMER`         | 409         | ID number already registered    | Check existing customer   |
| `DOCUMENT_VALIDATION_FAILED` | 422         | Document quality/content issues | Resubmit better documents |
| `RATE_LIMIT_EXCEEDED`        | 429         | Too many requests               | Wait and retry            |
| `INTERNAL_ERROR`             | 500         | Server-side error               | Retry or contact support  |

### Rate Limiting

**Limit:** 100 requests per minute per API key

**Headers:**

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1707745800
```

**Response (429):**

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please try again later."
  },
  "request_id": "req_pqr678"
}
```

**Best Practices:**

1. Implement exponential backoff
2. Monitor rate limit headers
3. Cache GET responses when possible
4. Batch operations if API supports it

---

## Security Considerations

### 1. Transport Security

TLS 1.2+ Required

- All communication over HTTPS
- No plain HTTP allowed
- Certificate validation enforced

### 2. Authentication

API Key Security

- Rotate keys every 90 days
- Different keys per environment
- Store in environment variables
- Monitor for suspicious usage

### 3. Webhook Security

Signature Verification

- HMAC-SHA256 signatures
- Timing-safe comparison
- Shared secret rotation

HTTPS Only

- Webhooks only sent to HTTPS URLs
- Certificate validation required

### 4. Data Privacy

PII Protection

- Documents transmitted securely
- No sensitive data in URLs
- Audit logging for access
  
GDPR Compliance

- Data minimization
- Purpose limitation
- Right to erasure support

### 5. Input Validation

Server-Side Validation

- All inputs validated
- Type checking enforced
- Length limits applied
- XSS prevention

---
