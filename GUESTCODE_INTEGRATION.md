# GuestCode Integration with Accounty

This document describes how to integrate GuestCode with the Accounty Receipt API for AADE myDATA compliance.

## Overview

When a customer purchases a ticket on GuestCode, you need to create a receipt in Accounty for Greek tax compliance. The receipt is automatically submitted to AADE and you receive a MARK number and QR code to include in the ticket email.

## Setup

### 1. Configure Accounty

Add your GuestCode API key to Accounty's `.env` file:

```bash
# Format: secretkey:userId
# The userId is your LBNSWRK E.E. account ID in Accounty
GUESTCODE_API_KEY=your-secure-secret-key:507f1f77bcf86cd799439011
```

Generate a secure API key:
```javascript
require('crypto').randomBytes(32).toString('hex')
```

### 2. Configure GuestCode

Add these to GuestCode's `.env`:

```bash
ACCOUNTY_API_URL=https://your-accounty-domain.com/api
ACCOUNTY_API_KEY=your-secure-secret-key
```

## API Endpoints

### Create Receipt

**POST** `/api/external/receipts`

Creates a receipt in Accounty and submits it to AADE.

**Headers:**
```
X-API-Key: your-secure-secret-key
Content-Type: application/json
```

**Request Body:**
```json
{
  "customer": {
    "email": "buyer@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "address": {
      "street": "123 Main St",
      "city": "Athens",
      "postalCode": "10431",
      "country": "GR"
    }
  },
  "items": [
    {
      "description": "VIP Ticket - Summer Party 2025",
      "quantity": 2,
      "unitPrice": 50.00,
      "vatCategory": "1"
    }
  ],
  "payment": {
    "method": "4",
    "stripeSessionId": "cs_live_xxx",
    "totalAmount": 124.00
  },
  "eventName": "Summer Party 2025",
  "eventDate": "2025-07-15",
  "orderId": "order_mongodb_id"
}
```

**Response (Success):**
```json
{
  "success": true,
  "receipt": {
    "id": "accounty_invoice_id",
    "receiptNumber": "R0001",
    "mark": "400011693839995",
    "qrCode": "data:image/png;base64,...",
    "status": "transmitted",
    "totalAmount": 124.00
  }
}
```

**Response (AADE Error):**
```json
{
  "success": true,
  "receipt": {
    "id": "accounty_invoice_id",
    "receiptNumber": "R0001",
    "mark": null,
    "qrCode": null,
    "status": "failed",
    "errors": [
      {
        "code": "1001",
        "message": "Invalid VAT number"
      }
    ]
  }
}
```

### Get Receipt by ID

**GET** `/api/external/receipts/:id`

### Get Receipt by Stripe Session ID

**GET** `/api/external/receipts/by-external/:stripeSessionId`

Useful for checking if a receipt was already created (idempotency).

### Download Receipt PDF

**GET** `/api/external/receipts/:id/pdf`

Downloads the complete receipt PDF that can be attached to the ticket email.

**Response:** PDF file with `Content-Disposition: attachment; filename="receipt-R0001.pdf"`

## Field Reference

### Customer

| Field | Required | Description |
|-------|----------|-------------|
| email | Yes | Buyer's email address |
| firstName | Yes | Buyer's first name |
| lastName | Yes | Buyer's last name |
| address.street | No | Street address |
| address.city | No | City |
| address.postalCode | No | Postal code |
| address.country | No | ISO country code (default: GR) |
| afm | No | Customer VAT number (if business) |

### Items

| Field | Required | Description |
|-------|----------|-------------|
| description | Yes | Item description (e.g., "VIP Ticket - Event Name") |
| quantity | Yes | Number of items |
| unitPrice | Yes | Price per unit (net, before VAT) |
| vatCategory | No | VAT rate category (default: "1" = 24%) |
| itemDescription | No | Additional description (event date, venue, etc.) |

**VAT Categories:**
- `1` = 24% (Standard)
- `2` = 13% (Reduced)
- `3` = 6% (Super-reduced)
- `7` = 0% (Zero rate)
- `8` = VAT exempt

### Payment

| Field | Required | Description |
|-------|----------|-------------|
| method | No | Payment method code (default: "4" = Credit Card) |
| stripeSessionId | Yes | Stripe checkout session ID |
| totalAmount | No | Total amount (auto-calculated if not provided) |

**Payment Methods:**
- `1` = Cash
- `2` = Check
- `3` = Bank Transfer
- `4` = Credit Card
- `5` = Web Banking
- `6` = POS
- `7` = IRIS

## Email Options

You have two options for including the receipt in the ticket email:

### Option A: Embed QR Code Only (Lightweight)

Just include the QR code image in the email body. Customer can scan to verify with AADE.

```html
<div style="text-align: center;">
  <img src="{{qrCode}}" alt="AADE Receipt" style="width: 100px;">
  <p>Receipt #{{receiptNumber}} | MARK: {{mark}}</p>
</div>
```

### Option B: Attach Full PDF Receipt (Complete)

Download the PDF from Accounty and attach it to the email. This gives the customer a proper receipt document.

```javascript
// After creating receipt, download PDF
const pdfResponse = await fetch(
  `${process.env.ACCOUNTY_API_URL}/external/receipts/${receiptId}/pdf`,
  {
    headers: { 'X-API-Key': process.env.ACCOUNTY_API_KEY }
  }
);
const pdfBuffer = await pdfResponse.buffer();

// Attach to email
await sendEmail({
  to: order.email,
  subject: 'Your Ticket & Receipt',
  attachments: [{
    filename: `receipt-${receiptNumber}.pdf`,
    content: pdfBuffer
  }]
});
```

## Integration Example

### GuestCode Stripe Webhook Handler

```javascript
// In your Stripe webhook handler (after payment success)

const createReceipt = async (order, event) => {
  try {
    // Map GuestCode order to Accounty format
    const receiptData = {
      customer: {
        email: order.email,
        firstName: order.firstName,
        lastName: order.lastName,
        address: {
          street: order.billingAddress?.line1 || '',
          city: order.billingAddress?.city || '',
          postalCode: order.billingAddress?.postal_code || '',
          country: order.billingAddress?.country || 'GR'
        }
      },
      items: order.tickets.map(ticket => ({
        description: `${ticket.name} - ${event.title}`,
        quantity: ticket.quantity,
        unitPrice: ticket.pricePerUnit,
        vatCategory: '1' // 24% VAT
      })),
      payment: {
        method: '4', // Credit card
        stripeSessionId: order.stripeSessionId
      },
      eventName: event.title,
      eventDate: event.startDate,
      orderId: order._id.toString()
    };

    // Call Accounty API
    const response = await fetch(`${process.env.ACCOUNTY_API_URL}/external/receipts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.ACCOUNTY_API_KEY
      },
      body: JSON.stringify(receiptData)
    });

    const result = await response.json();

    if (result.success) {
      // Store receipt info in order
      await Order.findByIdAndUpdate(order._id, {
        aadeReceipt: {
          accountyId: result.receipt.id,
          receiptNumber: result.receipt.receiptNumber,
          mark: result.receipt.mark,
          qrCode: result.receipt.qrCode,
          status: result.receipt.status
        }
      });

      console.log(`✅ Receipt created: ${result.receipt.receiptNumber}`);

      // Return QR code for ticket email
      return {
        mark: result.receipt.mark,
        qrCode: result.receipt.qrCode
      };
    } else {
      console.error('Receipt creation failed:', result.message);
      return null;
    }
  } catch (error) {
    console.error('Accounty API error:', error);
    return null;
  }
};

// Usage in webhook
case 'checkout.session.completed': {
  const order = await Order.findOne({ stripeSessionId: session.id });
  const event = await Event.findById(order.eventId);

  // Create receipt and get QR code
  const receiptInfo = await createReceipt(order, event);

  // Send ticket email with QR code
  await sendTicketEmail(order, event, receiptInfo);
  break;
}
```

### Including AADE QR in Ticket Email

```html
<!-- In your ticket email template -->
<div style="margin-top: 20px; padding: 15px; background: #f5f5f5; border-radius: 8px;">
  <h4>Receipt Information</h4>
  <p>Receipt #: {{receiptNumber}}</p>
  <p>MARK: {{mark}}</p>

  {{#if qrCode}}
  <div style="text-align: center; margin-top: 10px;">
    <img src="{{qrCode}}" alt="AADE QR Code" style="width: 100px; height: 100px;">
    <p style="font-size: 12px; color: #666;">Scan to verify with AADE</p>
  </div>
  {{/if}}
</div>
```

## Idempotency

The API is idempotent based on `stripeSessionId`. If you call the endpoint multiple times with the same Stripe session ID, it will return the existing receipt instead of creating a duplicate.

```javascript
// Safe to retry
const result = await createReceipt(order, event);
// Will return existing receipt if already created
```

## Error Handling

### HTTP Status Codes

- `200` - Success (or receipt already exists)
- `201` - Receipt created
- `400` - Bad request (missing fields, invalid data)
- `401` - Invalid or missing API key
- `500` - Server error

### AADE Errors

Even if the receipt is created in Accounty, AADE submission might fail. Check the `status` field:

- `transmitted` - Successfully submitted to AADE
- `failed` - AADE rejected the receipt (check `errors` array)
- `pending` - Not yet submitted (credentials issue)

When status is `failed`, the receipt still exists in Accounty and can be retried manually.

## Testing

### Development Environment

In development (`NODE_ENV=development`), receipts are sent to AADE's test environment. You'll get real MARK numbers but they're not valid for tax purposes.

### Test Request

```bash
curl -X POST https://your-accounty.com/api/external/receipts \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "customer": {
      "email": "test@example.com",
      "firstName": "Test",
      "lastName": "User"
    },
    "items": [{
      "description": "Test Ticket",
      "quantity": 1,
      "unitPrice": 10.00
    }],
    "payment": {
      "stripeSessionId": "cs_test_123"
    },
    "eventName": "Test Event",
    "orderId": "test_order_1"
  }'
```

---

## Commission Invoices (B2B)

When hosts cash out their earnings, GuestCode needs to create a B2B invoice for the 3.9% commission fee. These are proper invoices (not receipts) that go to the host's business.

### Create Commission Invoice

**POST** `/api/external/invoices`

Creates a B2B invoice for the commission and submits it to AADE. The invoice type is automatically determined based on the host's country:

- **Greek host** → Type 2.1 (Service Invoice) with 24% VAT
- **EU host** → Type 2.2 (Intra-Community) with 0% VAT (reverse charge)
- **Non-EU host** → Type 2.3 (Third Country) with 0% VAT

**Request Body:**
```json
{
  "counterpart": {
    "name": "Host Business Name",
    "vatNumber": "123456789",
    "country": "GR",
    "address": {
      "street": "123 Host Street",
      "city": "Athens",
      "postalCode": "10431"
    }
  },
  "items": [
    {
      "description": "Platform Commission - January 2025",
      "quantity": 1,
      "unitPrice": 150.00,
      "vatCategory": "1"
    }
  ],
  "payment": {
    "method": "3"
  },
  "hostId": "host_mongodb_id",
  "reference": "payout_2025_01_host123",
  "notes": "Commission for ticket sales"
}
```

**Response:**
```json
{
  "success": true,
  "invoice": {
    "id": "accounty_invoice_id",
    "invoiceNumber": "A0001",
    "invoiceType": "2.1",
    "mark": "400011693839995",
    "qrCode": "data:image/png;base64,...",
    "status": "transmitted",
    "totalAmount": 186.00
  }
}
```

### Download Invoice PDF

**GET** `/api/external/invoices/:id/pdf`

Downloads the complete invoice PDF to send to the host.

### Counterpart Fields (B2B)

| Field | Required | Description |
|-------|----------|-------------|
| name | Yes | Business/legal name |
| vatNumber | Yes* | VAT number (required for Greek hosts) |
| country | Yes | ISO country code (GR, DE, FR, etc.) |
| address.street | No | Street address |
| address.city | No | City |
| address.postalCode | No | Postal code |

*VAT number is required for Greek counterparts. For EU/non-EU, it's optional but recommended.

### EU Countries for Reverse Charge

The system automatically applies reverse charge (0% VAT) for these EU countries:
AT, BE, BG, HR, CY, CZ, DK, EE, FI, FR, DE, HU, IE, IT, LV, LT, LU, MT, NL, PL, PT, RO, SK, SI, ES, SE

### Integration Example

```javascript
// When host requests payout
const createCommissionInvoice = async (host, payoutData) => {
  try {
    const invoiceData = {
      counterpart: {
        name: host.businessName,
        vatNumber: host.vatNumber,
        country: host.country,
        address: {
          street: host.address?.street || '',
          city: host.address?.city || '',
          postalCode: host.address?.postalCode || ''
        }
      },
      items: [{
        description: `Platform Commission - ${payoutData.period}`,
        quantity: 1,
        unitPrice: payoutData.commissionAmount, // Net amount (before VAT)
        vatCategory: '1' // Will be overridden to '7' for EU/non-EU
      }],
      payment: {
        method: '3' // Bank transfer
      },
      hostId: host._id.toString(),
      reference: `payout_${payoutData.id}`, // For idempotency
      notes: `Commission for ${payoutData.ticketsSold} tickets sold`
    };

    const response = await fetch(`${process.env.ACCOUNTY_API_URL}/external/invoices`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.ACCOUNTY_API_KEY
      },
      body: JSON.stringify(invoiceData)
    });

    const result = await response.json();

    if (result.success) {
      // Store invoice info
      await Payout.findByIdAndUpdate(payoutData.id, {
        commissionInvoice: {
          accountyId: result.invoice.id,
          invoiceNumber: result.invoice.invoiceNumber,
          invoiceType: result.invoice.invoiceType,
          mark: result.invoice.mark,
          totalAmount: result.invoice.totalAmount
        }
      });

      // Download PDF to send to host
      const pdfResponse = await fetch(
        `${process.env.ACCOUNTY_API_URL}/external/invoices/${result.invoice.id}/pdf`,
        {
          headers: { 'X-API-Key': process.env.ACCOUNTY_API_KEY }
        }
      );
      const pdfBuffer = await pdfResponse.buffer();

      // Send to host
      await sendEmail({
        to: host.email,
        subject: `Commission Invoice - ${result.invoice.invoiceNumber}`,
        text: 'Please find attached your commission invoice.',
        attachments: [{
          filename: `invoice-${result.invoice.invoiceNumber}.pdf`,
          content: pdfBuffer
        }]
      });

      return result.invoice;
    }
  } catch (error) {
    console.error('Commission invoice error:', error);
    throw error;
  }
};

// Usage in payout handler
const processPayout = async (hostId, amount) => {
  const host = await Host.findById(hostId);

  // Calculate commission (3.9% of gross sales)
  const grossSales = amount / (1 - 0.039);
  const commission = grossSales * 0.039;

  // Create payout record
  const payout = await Payout.create({
    hostId,
    grossAmount: grossSales,
    commissionAmount: commission,
    netAmount: amount,
    period: 'January 2025'
  });

  // Create commission invoice in Accounty
  await createCommissionInvoice(host, payout);

  // Process Stripe payout
  await stripe.transfers.create({
    amount: Math.round(amount * 100),
    currency: 'eur',
    destination: host.stripeAccountId
  });
};
```

### Tracking Commissions

You don't need to track individual ticket sales for the commission invoice. The invoice is for the total commission amount for the payout period. GuestCode tracks:

1. **Per Order**: Receipts are created for each ticket purchase (B2C)
2. **Per Payout**: A single commission invoice is created for the total commission (B2B)

The commission calculation is straightforward:
```javascript
const commission = totalTicketSales * 0.039; // 3.9% of gross
```

This amount becomes the `unitPrice` in the commission invoice.

## Support

For issues with:
- Accounty API: Check server logs in Accounty
- AADE errors: Review error codes in response
- Integration: Contact LBNSWRK E.E.
