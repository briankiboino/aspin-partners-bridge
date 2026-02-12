# Part 4: Monitoring & Observability

## 1. Key Metrics to Track

### Metric 1: Payment Success Rate

**What:** Percentage of payments that complete successfully
**Formula:** `(successful_payments / total_payment_attempts) * 100`

**Why Important:**

- **Business Impact:** Directly affects revenue and customer satisfaction
- **SLA Tracking:** Core metric for service level agreements
- **Trend Analysis:** Early warning of systematic issues
- **Partner Comparison:** Identify problematic payment channels or partners

**Dashboard Visualization:**

- Line graph showing hourly success rate
- Breakdown by partner and channel
- Target: 95% success rate threshold

---

### Metric 2: Webhook Delivery Rate

**What:** Percentage of webhooks successfully received and processed
**Formula:** `(webhooks_received / payments_completed) * 100`

**Why Important:**

- **Data Integrity:** Missing webhooks = incorrect payment status
- **Policy Activation:** Blocked policy activation affects customers
- **Financial Accuracy:** Reconciliation issues and revenue recognition
- **Partner Trust:** Affects reliability perception

**Dashboard Visualization:**

- Real-time webhook delivery rate
- Time-series of webhook counts
- Failed webhook reasons breakdown
- Target: 99% delivery rate

---

### Metric 3: Payment Processing Latency

**What:** Time taken from payment initiation to completion
**Breakdown:**

- P50 (median): 50% of payments complete in X seconds
- P95: 95% of payments complete in X seconds
- P99: 99% of payments complete in X seconds

**Why Important:**

- **Customer Experience:** Long wait times = poor UX
- **System Performance:** Identifies bottlenecks
- **Partner SLA:** Track third-party performance
- **Capacity Planning:** Understand load patterns

**Dashboard Visualization:**

- Heatmap of latency distribution
- Separate graphs for each channel (Mpesa vs Airtel)
- Comparison across partners
- Targets: P95 < 30s, P99 < 60s

---

### Metric 4: API Error Rate

**What:** Rate of errors from payment gateway APIs
**Types:**

- 4xx errors (client errors - our fault)
- 5xx errors (server errors - gateway fault)
- Network errors (timeouts, connection refused)
- Validation errors

**Why Important:**

- **Reliability:** High error rate = system instability
- **Root Cause Analysis:** Identify patterns in failures
- **Partner Issues:** Detect gateway downtime quickly
- **Retry Strategy:** Optimize retry logic based on error types

**Implementation:**

**Dashboard Visualization:**

- Error rate trend over time
- Breakdown by error type
- Comparison between Mpesa and Airtel
- Target: < 1% error rate

---

### Metric 5: Queue Depth and Processing Rate

**What:** Number of pending jobs in queues and processing throughput

**Metrics:**

- Queue depth (pending jobs)
- Jobs processed per minute
- Average job processing time
- Failed job count

**Why Important:**

- **System Health:** Queue backup = processing issues
- **Scalability:** Know when to scale workers
- **Performance:** Identify slow-running jobs
- **Reliability:** Track job failure rates

**Implementation:**

**Dashboard Visualization:**

- Queue depth graph for each queue
- Processing rate trend
- Failed jobs count
- Targets: Queue depth < 100, Processing rate > 50/min

---

## 2. Alert Configuration

### Alert 1: Low Payment Success Rate

**Trigger Condition:** Payment success rate drops below **85%** (calculated over 5-minute intervals).
**Threshold Duration:** Persists for **10 minutes**.
**Severity:** **CRITICAL**
**Impact:** Indicates a major failure in payment processing; significant revenue and customer experience impact.
**Notifications:** PagerDuty (On-Call), Slack (#alerts-payments-critical), Email.
**Runbook:** `https://wiki.company.com/runbooks/low-payment-success-rate`

**Escalation:**

- 0-10 min: Slack notification
- 10-30 min: PagerDuty to on-call engineer
- 30+ min: Email to engineering manager

---

### Alert 2: Missing Webhooks

**Trigger Condition:** More than **5 payments** have completed without receiving a corresponding webhook in the last hour.
**Threshold Duration:** Persists for **15 minutes**.
**Severity:** **HIGH**
**Impact:** Downstream systems are not updating; policy activations for customers will be blocked.
**Recommended Actions:**
    1. Check webhook endpoint health.
    2. Review PaymentHub logs for delivery failures.
    3. Run manual reconciliation script.
    4. Contact PaymentHub support if the issue persists.
**Escalation:** Escalates to PagerDuty (On-Call) if unresolved after **30 minutes**.

---

### Alert 3: High API Error Rate

**Trigger Condition:** API error rate exceeds **5%** for a specific partner/channel (calculated over 5-minute intervals).
**Threshold Duration:** Persists for **5 minutes**.
**Severity:** **WARNING**
**Impact:** Indicates potential gateway instability or connectivity issues for a specific channel.
**Notifications:** Slack (#alerts-payments).

---

### Alert 4: Queue Backup

**Trigger Condition:** More than **500 jobs** are waiting in a queue.
**Threshold Duration:** Persists for **5 minutes**.
**Severity:** **WARNING**
**Impact:** Processing delays; system may need scaling or unblocking.
**Recommended Actions:**
    1. Check worker health and resource usage (CPU/Memory).
    2. Investigate for "poison pill" (stuck) jobs.
    3. Scale out worker instances.
    4. Review recent deployments for regressions.

---

### Alert 5: Payment Service Down

**Trigger Condition:** Payment Integration Service health check fails (Status = 0).
**Threshold Duration:** Persists for **1 minute**.
**Severity:** **CRITICAL**
**Impact:** **Total Outage**. All payment processing is blocked.
**Notifications:** PagerDuty (Immediate), Slack (#alerts-critical), SMS (On-Call Engineer).

---

### Alert 6: Slow Payment Processing

**Trigger Condition:** 95th Percentile (P95) of payment processing duration exceeds **60 seconds**.
**Threshold Duration:** Persists for **10 minutes**.
**Severity:** **WARNING**
**Impact:** Degraded customer experience; potential timeouts in upstream systems.

---

### Alert 7: Database Connection Pool Exhaustion

**Trigger Condition:** Database connection usage exceeds **80%** of the maximum pool size.
**Threshold Duration:** Persists for **5 minutes**.
**Severity:** **CRITICAL** (Infrastructure Team)
**Impact:** Service will likely start failing incoming requests due to inability to connect to the database.

---

### Alert 8: Circuit Breaker Opened

**Trigger Condition:** Circuit breaker state changes to **Open (1)**.
**Threshold Duration:** Persists for **1 minute**.
**Severity:** **WARNING**
**Impact:** Requests to the target service are being actively blocked to prevent cascading failures.

---

## 3. Sentry Integration

### Error Tracking Strategy

#### What Errors to Track

- Priority 1 - Critical Errors (Alert Immediately)
- Priority 2 - Important Errors (Review Daily)
- Priority 3 - Informational (Review Weekly)**

---

### Error Categorization

- Category 1: Payment Gateway Errors
- Category 2: Validation Errors
- Category 3: Infrastructure Errors
- Category 4: Business Logic Errors
  
---

## 4. Dashboard Design

### Dashboard 1: Engineering Dashboard

**Purpose:** Real-time system health and performance monitoring  
**Audience:** On-call engineers, DevOps team

**Layout:**

```
┌─────────────────────────────────────────────────────────────┐
│                 PAYMENT INTEGRATION SERVICE                  │
│                    System Health Overview                    │
└─────────────────────────────────────────────────────────────┘

┌──────────────────┬──────────────────┬──────────────────────┐
│  Payment Success │  Webhook Delivery│   API Error Rate     │
│      95.8%       │      99.2%       │       0.8%           │
│   ✓ HEALTHY      │   ✓ HEALTHY      │    ✓ HEALTHY         │
└──────────────────┴──────────────────┴──────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Payment Success Rate (Last 24 Hours)                        │
│                                                              │
│  100% ┤                                                      │
│   95% ┤━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│   90% ┤                                                      │
│   85% ┤ ⚠️ Alert Threshold                                   │
│       └──────────────────────────────────────────────────   │
│        00:00   06:00   12:00   18:00   24:00                │
└─────────────────────────────────────────────────────────────┘

┌──────────────────────────┬──────────────────────────────────┐
│  Payment Latency (P95)   │  Queue Depth                     │
│                          │                                  │
│  Mpesa:  18s             │  Payments:  45 jobs              │
│  Airtel: 22s             │  Webhooks:  12 jobs              │
│  Target: <30s ✓          │  Status:    8 jobs               │
│                          │                                  │
│  [Latency Histogram]     │  [Queue Depth Graph]             │
└──────────────────────────┴──────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Recent Errors (Last Hour)                                   │
│                                                              │
│  ⚠️  3x Webhook signature validation failed - APA/Airtel    │
│  ⚠️  2x Database connection timeout                          │
│  ⚠️  1x Mpesa API timeout - BRITAM                          │
│                                                              │
│  [View All Errors in Sentry] →                              │
└─────────────────────────────────────────────────────────────┘

┌──────────────────────────┬──────────────────────────────────┐
│  System Resources        │  Active Alerts                   │
│                          │                                  │
│  CPU:     45%            │  🔴 None - All Clear             │
│  Memory:  62%            │                                  │
│  DB Conn: 12/50          │                                  │
│  Redis:   Connected ✓    │                                  │
│  RabbitMQ: Connected ✓   │                                  │
└──────────────────────────┴──────────────────────────────────┘
```

**Key Features:**

- Real-time metrics (auto-refresh every 30s)
- Color-coded health indicators (green/yellow/red)
- Direct links to Sentry for error investigation
- Queue depth monitoring
- Resource utilization
- Active alerts section

---

### Dashboard 2: Support Team Dashboard

**Purpose:** Customer-facing operational metrics  
**Audience:** Customer support, Account managers

**Layout:**

```
┌─────────────────────────────────────────────────────────────┐
│               PAYMENT OPERATIONS DASHBOARD                   │
│                      Today's Summary                         │
└─────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  📊 Today's Statistics                                        │
│                                                              │
│  Total Payments:          1,247                             │
│  Successful:              1,189  (95.3%)                    │
│  Pending:                    42  (3.4%)                     │
│  Failed:                     16  (1.3%)                     │
│                                                              │
│  Total Amount Processed:  KES 6,234,500                     │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────┬───────────────────────────────────┐
│  By Partner              │  By Payment Channel               │
│                          │                                   │
│  BRITAM:    523 (41.9%)  │  Mpesa:   892 (71.5%)            │
│  APA:       412 (33.0%)  │  Airtel:  355 (28.5%)            │
│  MADISON:   198 (15.9%)  │                                   │
│  JUBILEE:   114 (9.1%)   │                                   │
│                          │                                   │
│  [Partner Breakdown →]   │  [Channel Performance →]          │
└──────────────────────────┴───────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  ⚠️ Attention Required                                       │
│                                                              │
│  • 12 payments pending > 15 minutes [View Details →]        │
│  • 3 webhook delivery failures - needs reconciliation       │
│                                                              │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  Customer Impact Summary                                     │
│                                                              │
│  Average Payment Time:      12 seconds                      │
│  Policy Activation Rate:    98.7%                           │
│  Customer Complaints:       2 (down from 5 yesterday)       │
│                                                              │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  Quick Actions                                               │
│                                                              │
│  [Search Payment by Transaction ID]                         │
│  [View Pending Payments]                                    │
│  [Generate Daily Report]                                    │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**Key Features:**

- High-level business metrics
- Partner and channel breakdown
- Actionable alerts (payments needing attention)
- Customer impact metrics
- Quick action buttons for common tasks
