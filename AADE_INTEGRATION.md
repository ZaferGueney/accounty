# AADE myDATA Integration - Current Status

## 🎯 Goal
Submit invoices to Greek Tax Authority (AADE) myDATA API to get:
- MARK (invoice registration number)
- UID (unique identifier)
- Authentication Code (for QR code generation)

---

## ✅ What's Working Now

### 1. Development Environment Connection ✅
- **Status**: Fully operational
- **Endpoint**: `https://mydataapidev.aade.gr/SendInvoices`
- **Response**: 200 OK with XML validation feedback
- **Credentials**:
  - Username: `Zafer2025`
  - Subscription Key: `0956ef3ee63e7f78765c91f881da9253`
  - AFM: `803058973`

### 2. Production Environment Connection ✅
- **Status**: Also working (but creates REAL invoices)
- **Endpoint**: `https://mydatapi.aade.gr/myDATA/SendInvoices`
- **Credentials**:
  - Username: `LBNSWRKACCOUNTY`
  - Subscription Key: `2eed82de545688b804579353cf88c79d`
  - AFM: `803058973`
- **Note**: Successfully submitted invoice A20250001 (accidentally) - needs to be cancelled later

### 3. Auto Environment Switching ✅
Code automatically selects credentials based on `NODE_ENV`:
```javascript
// aadeService.js lines 10-24
const isProduction = process.env.NODE_ENV === 'production';

this.baseURL = isProduction
  ? process.env.AADE_PROD_URL  // https://mydatapi.aade.gr/myDATA
  : process.env.AADE_DEV_URL;  // https://mydataapidev.aade.gr

this.subscriptionKey = isProduction
  ? process.env.AADE_PROD_KEY
  : process.env.AADE_DEV_KEY;

this.aadeUserId = isProduction
  ? process.env.AADE_PROD_USER_ID
  : process.env.AADE_DEV_USER_ID;
```

### 4. XML Response Parser ✅
Parser successfully extracts AADE responses (fixed in `aadeService.js:317-380`):
- Tries multiple XML structure paths
- Logs full parsed structure for debugging
- Extracts statusCode, errors, mark, uid, authenticationCode

### 5. Fixed XML Errors (Round 1) ✅
**Fixed 4 schema errors:**
1. ✅ Changed `<invType>` → `<invoiceType>` (line 44)
2. ✅ Removed `<invoiceRowType>` wrapper - flattened structure
3. ✅ Added `<totalStampDutyAmount>` and `<totalOtherTaxesAmount>` to summary
4. ✅ Moved `<paymentMethods>` from after summary to after header

---

## ❌ Current Blocking Issues

### Remaining 3 XML Schema Errors:

#### Error 1: Invalid Income Classification Type
```xml
<icls:classificationType>E3_562_001</icls:classificationType>
```
**AADE Error**: `The value 'E3_562_001' is invalid according to its datatype 'IncomeClassificationValueType' - The Enumeration constraint failed.`

**Problem**: We're using `E3_562_001` but this code doesn't exist in AADE's allowed enumeration.

**What we need**: Correct income classification code for restaurant/food services (current invoice is for Penelope & Jackson and Afro Spiti - likely category E3_561_001 or E3_561_002)

#### Error 2: Invalid Classification Category
```xml
<icls:classificationCategory>1</icls:classificationCategory>
```
**AADE Error**: `The value '1' is invalid according to its datatype 'IncomeClassificationCategoryType' - The Enumeration constraint failed.`

**Problem**: We're using `1` but the category format is wrong.

**What we need**: Correct category format (might be `category1_1`, `category1_2`, etc. or completely different values)

#### Error 3: Invoice Details Structure Still Wrong
```xml
<invoiceDetails>
  <lineNumber>1</lineNumber>
  <itemDescr>Penelope & Jackson</itemDescr>
  <quantity>1</quantity>
  ...
  <incomeClassification>...</incomeClassification>
  <lineNumber>2</lineNumber>  <!-- ❌ ERROR HERE (Line 57) -->
  ...
</invoiceDetails>
```

**AADE Error**: `The element 'invoiceDetails' has invalid child element 'lineNumber'. List of possible elements expected: 'incomeClassification, expensesClassification, quantity15, otherMeasurementUnitQuantity, otherMeasurementUnitTitle, notVAT195, vatExemptDescrEN, vatExemptDescrGR'`

**Problem**: After line 1's incomeClassification, AADE finds `<lineNumber>2</lineNumber>` but expects more optional fields for line 1 OR a different structure entirely.

**Our Theory**: The flat structure is still incorrect. Each line item might need:
- A wrapper element (not `<invoiceRowType>`, something else)
- OR all classifications must come AFTER all line items
- OR there's a specific grouping/nesting we're missing

---

## 🔍 What We Know About AADE Schema

### Current Generated XML Structure:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<InvoicesDoc xmlns="http://www.aade.gr/myDATA/invoice/v1.0"
             xmlns:icls="https://www.aade.gr/myDATA/incomeClassificaton/v1.0">
  <invoice>
    <issuer>
      <vatNumber>803058973</vatNumber>
      <country>GR</country>
      <branch>0</branch>
      <address>...</address>
    </issuer>

    <counterpart>
      <vatNumber>802478503</vatNumber>
      <country>GR</country>
      <branch>0</branch>
      <name>HARLEM ATHENS MON IKE</name>
      <address>...</address>
    </counterpart>

    <invoiceHeader>
      <series>A</series>
      <aa>1</aa>
      <issueDate>2025-11-18</issueDate>
      <invoiceType>2.1</invoiceType>  <!-- ✅ Fixed from invType -->
      <currency>EUR</currency>
    </invoiceHeader>

    <paymentMethods>  <!-- ✅ Moved here -->
      <paymentMethodDetails>
        <type>3</type>
        <amount>2935.84</amount>
      </paymentMethodDetails>
    </paymentMethods>

    <invoiceDetails>  <!-- ❌ STRUCTURE ISSUE -->
      <lineNumber>1</lineNumber>
      <itemDescr>Penelope &amp; Jackson</itemDescr>
      <quantity>1</quantity>
      <measurementUnit>1</measurementUnit>
      <netValue>867.61</netValue>
      <vatCategory>1</vatCategory>
      <vatAmount>208.23</vatAmount>
      <incomeClassification>  <!-- ❌ WRONG VALUES -->
        <icls:classificationType>E3_562_001</icls:classificationType>  <!-- INVALID -->
        <icls:classificationCategory>1</icls:classificationCategory>  <!-- INVALID -->
        <icls:amount>867.61</icls:amount>
      </incomeClassification>
      <lineNumber>2</lineNumber>  <!-- ❌ Line 57: Can't have second lineNumber here -->
      <itemDescr>Afro Spiti</itemDescr>
      ...
    </invoiceDetails>

    <invoiceSummary>
      <totalNetValue>2367.61</totalNetValue>
      <totalVatAmount>568.23</totalVatAmount>
      <totalWithheldAmount>0.00</totalWithheldAmount>
      <totalFeesAmount>0.00</totalFeesAmount>
      <totalStampDutyAmount>0.00</totalStampDutyAmount>  <!-- ✅ Added -->
      <totalOtherTaxesAmount>0.00</totalOtherTaxesAmount>  <!-- ✅ Added -->
      <totalDeductionsAmount>0.00</totalDeductionsAmount>
      <totalGrossValue>2935.84</totalGrossValue>
    </invoiceSummary>
  </invoice>
</InvoicesDoc>
```

### Invoice Type Used:
- `2.1` = "Τιμολόγιο / Συντελεστή Παρ." (Invoice / Service Provider)

### Payment Method:
- `3` = Cash payment

---

## 🔬 Research Needed

### 1. Income Classification Codes
**Question**: What are the valid `classificationType` values for restaurant/food services?

**Current value**: `E3_562_001` ❌
**Likely correct values**:
- `E3_561_001` - Gross income from sales of goods/services - Wholesale/Retail?
- `E3_561_002` - Gross income from provision of services?
- `E3_561_003` - Production sales?

**Where to find**:
- AADE myDATA API Documentation v1.0.9, Section on Income Classifications
- XSD schema file: `InvoiceIncomeClassificationType` enumeration
- Greek Tax Code regulations for income categories

### 2. Classification Categories
**Question**: What are the valid `classificationCategory` values?

**Current value**: `1` ❌
**Expected format**: Unknown - might be:
- `category1_1`, `category1_2`, etc.
- `E3_561_001`, `E3_561_002` (same as classificationType?)
- Numeric codes: `1`, `2`, `3` (but different meaning?)

**Where to find**:
- XSD schema: `IncomeClassificationCategoryType` enumeration
- AADE documentation on classification categories

### 3. Invoice Details Structure
**Question**: What is the correct XML structure for multiple invoice line items?

**Possibilities**:
1. **Wrapper element needed** (but what element name?)
   ```xml
   <invoiceDetails>
     <SomeWrapper>
       <lineNumber>1</lineNumber>
       ...
     </SomeWrapper>
     <SomeWrapper>
       <lineNumber>2</lineNumber>
       ...
     </SomeWrapper>
   </invoiceDetails>
   ```

2. **Classifications go at the end**
   ```xml
   <invoiceDetails>
     <lineNumber>1</lineNumber>
     <quantity>1</quantity>
     ...
     <lineNumber>2</lineNumber>
     <quantity>1</quantity>
     ...
   </invoiceDetails>
   <invoicesIncomeClassification>
     <lineNumber>1</lineNumber>
     <icls:classificationType>...</icls:classificationType>
     ...
   </invoicesIncomeClassification>
   ```

3. **Separate section for classifications**
   ```xml
   <invoiceDetails>...</invoiceDetails>
   <taxesTotals>
     <incomeClassification>...</incomeClassification>
   </taxesTotals>
   <invoiceSummary>...</invoiceSummary>
   ```

**Where to find**:
- AADE myDATA XSD schema file (`InvoicesDoc.xsd`)
- Working XML examples from AADE documentation
- Section on `invoiceDetails` element structure

---

## 📁 Code Files

### Modified Files:
```
server/src/services/aadeTransformer.js
├── Line 44: invoiceType ✅
├── Lines 48-62: Flattened invoiceDetails (removed invoiceRowType)
├── Lines 63-73: Added totalStampDutyAmount, totalOtherTaxesAmount
└── Lines 48-53: Moved paymentMethods position

server/src/services/aadeService.js
├── Lines 10-24: Auto environment switching
├── Lines 27-31: Startup logging
└── Lines 317-380: Enhanced XML parser

server/src/controllers/settingsController.js
└── Lines 266-296: Fixed GEMI saving bug (toObject() conversion)

server/src/models/settingsModel.js
└── Lines 58-69: Added GEMI field

server/.env
├── Dev credentials: Zafer2025 / 0956ef3e...
└── Prod credentials: LBNSWRKACCOUNTY / 2eed82de...
```

---

## 🎯 Next Steps

### Immediate:
1. **Find correct income classification codes** for food/restaurant services
2. **Find valid classification category values**
3. **Research correct invoiceDetails XML structure** from XSD schema

### After XML is Fixed:
1. Test invoice submission in dev environment
2. Verify MARK, UID, authenticationCode are received
3. Generate QR code from response
4. Update PDF template with QR code
5. Cancel the accidentally submitted production invoice (A20250001)

### Additional Tasks:
1. Remove invoice year from numbering (A20250001 → A1)
2. Fix Mongoose duplicate index warnings
3. Add GEMI to AADE XML if required (currently only in PDF/database)

---

## 📊 Progress Tracker

| Component | Status | Notes |
|-----------|--------|-------|
| Dev environment connection | ✅ | 200 OK responses |
| Prod environment connection | ✅ | Working but on hold |
| Auto credential switching | ✅ | Based on NODE_ENV |
| XML response parser | ✅ | Extracts all data |
| XML structure (round 1) | ✅ | 4 errors fixed |
| Income classification codes | ❌ | Invalid enumeration values |
| Classification categories | ❌ | Invalid format |
| Invoice details structure | ❌ | Flat structure rejected |
| QR code generation | ⏸️ | Waiting for successful submission |
| GEMI implementation | ✅ | In settings/PDF only |

---

## 🔗 Resources

- **Dev Portal**: TaxisNet myDATA registration (completed ✓)
- **Dev Credentials**: Zafer2025, Active
- **Prod Credentials**: LBNSWRKACCOUNTY, Active
- **API Version**: myDATA v1.0.9
- **Namespace**: `http://www.aade.gr/myDATA/invoice/v1.0`
- **Income Classification NS**: `https://www.aade.gr/myDATA/incomeClassificaton/v1.0`

---

**Status**: XML schema validation errors (3 remaining)
**Last Updated**: November 18, 2025 21:37
**Current Focus**: Research correct income classification codes and invoiceDetails structure
**Next Milestone**: Successful invoice submission in dev environment
