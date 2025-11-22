# Commission & Host Payout Architecture

This document outlines the commission tracking and host payout system for GuestCode (owned by LBNSWRK E.E.) integrated with Accounty.

## Overview

When customers buy tickets through GuestCode:
- **LBNSWRK E.E.** receives the payment
- **3.9%** platform fee is retained
- **96.1%** goes to the event host

All financial transactions must be reported to AADE (Greek tax authority).

---

## AADE Document Types

| Document | Greek Term | When Used | Who Creates |
|----------|------------|-----------|-------------|
| Receipt | Απόδειξη | Customer buys ticket | Accounty (for LBNSWRK) |
| Self-Billed Invoice | Τιμολόγιο Αυτοτιμολόγησης | Host cashes out | Accounty (on host's behalf) |
| Credit Note | Πιστωτικό | Refund/cancellation | Accounty (future feature) |

---

## Self-Billing Explained

### What is Self-Billing?

Instead of waiting for hosts to send invoices for their earnings, LBNSWRK E.E. creates invoices **on behalf of the host**. This requires written authorization from the host.

### Why Self-Billing?

**Advantages:**
- Fully automated - instant invoice on payout
- Consistent AADE-compliant formatting
- Host just clicks "cash out" and receives money + invoice PDF
- No chasing hosts for paperwork
- You control timing and accuracy

**Requirements:**
- Host must sign self-billing agreement during registration
- Host must provide complete business details
- Both parties report to AADE

### Alternative: Host Bills You

If not using self-billing:
- Host sends invoice for their earnings
- You pay them and record expense
- Depends on hosts to send proper invoices
- Cannot fully automate payouts

**Recommendation:** Use self-billing for automation and control.

---

## Data Architecture

### What Lives Where

| Data | Location | Reason |
|------|----------|--------|
| Pending commissions | GuestCode | Operational - not real money yet |
| Host dashboard totals | GuestCode | Real-time UX data |
| Completed Receipts | Accounty | Official AADE document |
| Self-Billed Invoices | Accounty | Official AADE document |
| Payout records | Accounty | Financial transaction records |

### GuestCode Commission Model (Simplified)

```javascript
// Track per-order for host dashboard & payout eligibility
{
  orderId: ObjectId,
  eventId: ObjectId,
  brandId: ObjectId,           // Host

  grossAmount: Number,          // What customer paid (EUR)
  platformFee: Number,          // 3.9% of gross
  hostEarnings: Number,         // 96.1% of gross

  currency: "EUR",
  status: "pending" | "available" | "paid",

  // After payout
  payoutId: String,             // Reference to Accounty payout
  paidAt: Date
}
```

**Remove from GuestCode:**
- TransactionLedger model (USD, US tax logic)
- Complex double-entry accounting
- Currency conversion logic

### Accounty Payout Model (New)

```javascript
// Track actual money movement
{
  userId: ObjectId,              // LBNSWRK Accounty user

  // Host details
  hostId: String,                // GuestCode brand/host ID
  hostBusinessName: String,
  hostVatNumber: String,
  hostTaxOffice: String,
  hostAddress: Object,
  hostIban: String,

  // Amounts
  grossSales: Number,            // Total ticket revenue
  platformFee: Number,           // 3.9% retained
  netPayout: Number,             // What host receives

  // References
  invoiceId: ObjectId,           // Self-billed invoice
  invoiceNumber: String,
  aadeMark: String,
  stripeTransferId: String,

  // Event reference
  eventIds: [String],            // Events included in payout

  status: "pending" | "processing" | "completed" | "failed",
  completedAt: Date
}
```

---

## Complete Payout Flow

### 1. Customer Buys Ticket

```
Customer pays €100 for ticket
    ↓
GuestCode: Create Commission {
  grossAmount: 100,
  platformFee: 3.90,
  hostEarnings: 96.10,
  status: "pending"
}
    ↓
Accounty: POST /api/external/receipts
    ↓
AADE: Returns MARK for receipt
```

### 2. Event Completes

```
Event ends successfully
    ↓
GuestCode: Update all event commissions
  status: "pending" → "available"
```

### 3. Host Requests Payout

```
Host clicks "Cash Out" (€961.00 from 10 tickets)
    ↓
GuestCode: Validate host has complete business details
    ↓
Accounty: POST /api/external/payouts {
  host: {
    businessName: "Night Club XYZ",
    vatNumber: "123456789",
    taxOffice: "Α' ΑΘΗΝΩΝ",
    address: {...},
    iban: "GR..."
  },
  grossSales: 1000.00,
  platformFee: 39.00,
  netPayout: 961.00,
  eventIds: ["event1", "event2"],
  commissionIds: ["comm1", "comm2", ...]
}
    ↓
Accounty: Create Self-Billed Invoice
  - Issuer: Host (Night Club XYZ)
  - Receiver: LBNSWRK E.E.
  - Amount: €961.00
  - Submit to AADE → Get MARK
    ↓
Accounty: Initiate Stripe Transfer
  - Amount: €961.00
  - Destination: Host's bank (IBAN)
    ↓
Accounty: Return payout confirmation {
  payoutId,
  invoiceNumber,
  aadeMark,
  stripeTransferId,
  invoicePdfUrl
}
    ↓
GuestCode: Update Commissions
  status: "available" → "paid"
  payoutId: returned payoutId
    ↓
Send host email with invoice PDF
```

---

## Host Verification Requirements

### Required Before Selling Tickets

Hosts must provide complete business details to enable ticket sales feature.

#### Greek Business (E.E., O.E., A.E., etc.)

| Field | Greek | Required | Verification |
|-------|-------|----------|--------------|
| Business name | Επωνυμία | Yes | - |
| VAT number | ΑΦΜ | Yes | AADE API |
| Tax office | ΔΟΥ | Yes | - |
| Business address | Διεύθυνση | Yes | - |
| Legal representative | Νόμιμος εκπρόσωπος | Yes | - |
| IBAN | - | Yes | Format validation |
| Self-billing authorization | - | Yes | Checkbox + terms |

#### EU Business (Outside Greece)

| Field | Required | Verification |
|-------|----------|--------------|
| Business name | Yes | - |
| EU VAT number | Yes | VIES API |
| Business address | Yes | - |
| IBAN | Yes | Format validation |
| Self-billing authorization | Yes | Checkbox + terms |

### Self-Billing Agreement

Host must accept terms that authorize LBNSWRK E.E. to:
- Issue invoices on their behalf
- Report transactions to AADE
- Determine invoice amounts based on ticket sales

**Example text:**
> "I authorize LBNSWRK E.E. to issue invoices on my behalf for ticket sales through the GuestCode platform. I confirm that my business details are accurate and I will report these transactions to the relevant tax authorities."

---

## VAT Handling by Event Location

### Events in Greece
- **VAT Rate:** 24%
- **Reporting:** Full AADE receipt
- **Standard flow**

### Events in EU (Outside Greece)
- **VAT Rate:** Varies by country (e.g., Germany 19%)
- **Options:**
  1. Register for VAT in that country
  2. Use OSS (One-Stop Shop) system
- **AADE:** Still needs to know about revenue
- **Indicator:** Use `event.country` field

### Events Outside EU
- **VAT Rate:** Typically 0% or local rules
- **Complex:** Consult accountant

### Implementation

Add `country` field to GuestCode Event model:

```javascript
{
  // ... existing fields
  country: {
    type: String,
    default: 'GR',
    enum: ['GR', 'DE', 'NL', 'FR', ...] // ISO codes
  }
}
```

Determine VAT handling:
```javascript
if (event.country === 'GR') {
  // Greek VAT 24%, standard AADE receipt
} else if (EU_COUNTRIES.includes(event.country)) {
  // EU event - OSS or local VAT registration
} else {
  // Non-EU - special handling
}
```

---

## API Endpoints Needed in Accounty

### 1. Create Payout (New)

`POST /api/external/payouts`

Creates self-billed invoice and initiates bank transfer.

**Request:**
```json
{
  "host": {
    "id": "guestcode_brand_id",
    "businessName": "Night Club XYZ",
    "vatNumber": "123456789",
    "taxOffice": "Α' ΑΘΗΝΩΝ",
    "address": {
      "street": "Ermou 123",
      "city": "Athens",
      "postalCode": "10563",
      "country": "GR"
    },
    "iban": "GR1234567890123456789012345"
  },
  "grossSales": 1000.00,
  "platformFee": 39.00,
  "netPayout": 961.00,
  "eventIds": ["event1", "event2"],
  "commissionIds": ["comm1", "comm2"],
  "description": "Ticket sales payout - November 2025"
}
```

**Response:**
```json
{
  "success": true,
  "payout": {
    "id": "payout_id",
    "invoiceId": "invoice_id",
    "invoiceNumber": "P0001",
    "aadeMark": "400001234567890",
    "stripeTransferId": "tr_xxx",
    "status": "processing",
    "invoicePdfUrl": "/api/external/payouts/payout_id/pdf"
  }
}
```

### 2. Get Payout Status

`GET /api/external/payouts/:id`

Check payout status and get invoice PDF.

### 3. Download Payout Invoice PDF

`GET /api/external/payouts/:id/pdf`

Returns the self-billed invoice PDF to send to host.

---

## GuestCode Cleanup Required

### Remove (Old American Logic)

1. **TransactionLedger model** - USD hardcoded, US tax calculations
2. **adminFinanceController.js** - US tax report logic
3. **fulfillOrder.js** - Ledger creation code (lines 284-373)
4. **orderModel.js** - Currency conversion (conversionRate field)
5. **setupRevenueSharing.js** - $50 USD minimum payout

### Keep but Simplify

1. **Commission model** - Remove USD, simplify to track host earnings
2. **RevenueSharing model** - Change default to 3.9%, remove USD minimum

---

## Open Questions

1. **Require business registration?**
   - Recommendation: Yes, require hosts to have a registered business to sell tickets
   - Simplifies VAT handling and invoicing

2. **Self-billing agreement timing?**
   - Part of host onboarding, OR
   - Separate step before first payout

3. **ΑΦΜ/VAT verification**
   - Automatic via AADE/VIES API during registration?
   - Or manual verification?

4. **Stripe Connect**
   - Currently using direct transfers?
   - Consider Stripe Connect for automated payouts

---

## Future Considerations

### Refunds / Credit Notes
- Customer refunds need Credit Notes to AADE
- Reverse commission calculations
- Separate documentation needed

### Multi-Currency
- Currently EUR only
- If expanding, need exchange rate handling

### Host Tax Reporting
- Consider providing hosts with annual summary
- Export of all invoices issued on their behalf

---

## Summary

| Component | GuestCode | Accounty |
|-----------|-----------|----------|
| Commission tracking | ✅ Simplified model | - |
| Host dashboard | ✅ Real-time totals | - |
| Customer receipts | Trigger API call | ✅ Create & AADE |
| Self-billed invoices | Trigger API call | ✅ Create & AADE |
| Payout records | Reference only | ✅ Full tracking |
| Bank transfers | - | ✅ Stripe integration |
| Tax reporting | - | ✅ All AADE data |

**Key Principle:** GuestCode handles operational tracking, Accounty handles official financial records and AADE compliance.
