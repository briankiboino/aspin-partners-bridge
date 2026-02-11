# Part 3: Debugging & Troubleshooting

## Bug Report 1: From PartnerCRM

- Subject: PartnerCRM is receiving redundant registration requests for the same customer within a very short time window, resulting in duplicate database records.
- Description: Identical customer registration requests are being sent multiple

### Example

- **Customer ID:** `CUST_7890`
- **Timestamp Log:**
  - 10:30:15 (First Request)
  - 10:30:17 (Duplicate)
  - 10:30:19 (Duplicate)

#### What are the possible root causes?

1. Lack of or faulty validation that checks whether registration requests for respective customer (s) are already in the queue
2. Faulty implementation of the queueing system that allows duplicate requests to be processed
3. Network issues that lead to retries or poorly deisgned or timed retry logic
4. Missing or faulty feedback webhooks that notify Aspin Backend of successful customer creation
5. PartnerCRM service downtime causing retries

#### What questions would you ask each party (Partner, Backend team)?

1. Partner
   - Can you confirm whether the PartnerCRM is sending duplicate registration requests for the same customer?
   - Is the feedback webhook configured correctly to notify Aspin Backend of successful customer creation?
   - Can you perform a code audit for the logic that handles customer registration requests in PartnerCRM?
2. Aspin Backend Team
   - Is the queueing system properly configured to handle duplicate requests?
   - Have you checked the network logs to see if there are any retries or failed requests?
   - Can you perform a code audit for the logic that handles customer registration requests in Aspin Backend?

#### What logs/data would you check?

Network logs to check for retries or failed requests
Duplicate customer (s) records from both PartnerCRM and Aspin Backend databases
Duplicate requests in the queueing system

#### How would you investigate? (step-by-step)

1. Replicate the issue by sending multiple identical registration requests for the same customer within a short time window
2. Check network logs for retries or failed requests
3. Query both PartnerCRM and Aspin Backend databases for duplicate customer records
4. Check the queueing system for duplicate requests
5. Check on the validation strategy from both sides

#### Propose a solution and prevention strategy

1. First fix any data incosistencies brought about by the duplicate requests (Duplicate customer records)
2. Implement a validation check in PartnerCRM to ensure that duplicate registration requests for the same customer are not processed (If faulty or does not exist)
3. Update the queueing system to reject duplicate requests before processing
4. Review and optimize the retry logic in PartnerCRM to avoid unnecessary retries
5. Implement a feedback webhook in Aspin Backend to notify it of successful customer creation (Upon successfull registration the respective task (s) are marked as completed and cleared from the queue)

---

## Bug Report 2: From Aspin Backend

- Subject: Payment Webhooks Not Received
- Description: We initiated 15 payments yesterday but only received webhook callbacks for 8 of them. The other 7 payments show as "completed" in PaymentHub dashboard but we never got notified. This is blocking policy activation for customers.

## What are the possible root causes?

1. Network issues between Aspin Backend and PaymentHub API calls
2. Webhook (Payment notifications) rejections (Might have been authentication issues) from Aspin Backend from PaymentHub
3. Queing system downtime that might have caused the Aspin Backend to miss completed payments notifications PaymentHub service

## What questions would you ask each party (Partner, Backend team)?

1. Partner
   - Can you check for rejected network calls made to Aspin Backend from PaymentHub?
   - Is the feedback webhook configured correctly to notify Aspin Backend of successful payment notifications?
   - Can you perform a code audit for the payment notification message producer in the PaymentHub be done?
2. Aspin Backend Team
   - Can you check for downtimes within the period of the payments?
   - Can you check for network related issues with the PaymentHub API calls?s
   - Can a code audit for the payment notification handling logic be done?

#### What logs/data would you check?

Network logs to check for retries or failed requests
PaymentHub API logs to check for webhook rejections
Aspin Backend logs to check for missed payment notifications

#### How would you investigate? (step-by-step)

1. Replicate the issue by sending multiple payment requests
2. Query PaymentHub API logs for webhook rejections
3. Check Aspin Backend logs for missed payment notifications
4. Check on the validation strategy from both sides

#### Propose a solution and prevention strategy

1. First fix any data incosistencies brought about by the missed payment notifications (PaymentHub dashboard shows completed payments but Aspin Backend never got notified)
2. Implement a cron job (Aspin Backend) that checks for payment request that are outside the timeout window for success or failure and check for their corresponding statuses from the PaymetnHub and update the Aspin Backend database accordingly
3. Fix any existing network related, code related, authentication related issues found after the investigation
4. Reinforce the monitoring strategy to capture such events and alert the respective teams

---
