# AADE myDATA API Research Documentation

## Overview
The AADE (Greek Tax Authority) myDATA platform provides electronic invoice submission and management services for Greek businesses. This document outlines the technical requirements and implementation details for integrating with the myDATA REST API.

## Authentication
The myDATA API uses subscription key authentication:
- **Subscription Key**: Unique string per user (available from AADE environment variable)
- **Header**: `Ocp-Apim-Subscription-Key`
- **Note**: Username/Password are NOT used for myDATA API (only for POS Registry API) 

## Base URLs
- **Production**: `https://mydatapi.aade.gr/`
- **Sandbox**: `https://mydataapidev.aade.gr/`

## Key API Endpoints

### 1. SendInvoices
- **Method**: POST
- **Endpoint**: `/SendInvoices`
- **Purpose**: Submit invoices to AADE
- **Content-Type**: `application/json`
- **Body**: XML invoice data in JSON wrapper

### 2. RequestTransmittedDocs
- **Method**: POST  
- **Endpoint**: `/RequestTransmittedDocs`
- **Purpose**: Retrieve submitted invoice status
- **Parameters**: Date range, invoice marks

### 3. CancelInvoice
- **Method**: POST
- **Endpoint**: `/CancelInvoice`
- **Purpose**: Cancel a previously submitted invoice
- **Parameters**: Invoice MARK (unique identifier)

### 4. RequestMyIncome
- **Method**: POST
- **Endpoint**: `/RequestMyIncome`
- **Purpose**: Retrieve income classifications
- **Parameters**: Date range, entity details

### 5. SendExpensesClassification
- **Method**: POST
- **Endpoint**: `/SendExpensesClassification`
- **Purpose**: Submit expense classifications
- **Body**: Classification data

## Invoice Data Requirements

### Mandatory Fields
- **Issuer Information**:
  - VAT Number (AFM)
  - Country Code (GR)
  - Branch (default: 0)
  - Name
  - Address details

- **Counterpart Information**:
  - Name (mandatory)
  - VAT Number (optional for individuals)
  - Address details

- **Invoice Details**:
  - Invoice Number
  - Invoice Type (e.g., "2.1" for service invoices)
  - Issue Date
  - Net Value
  - VAT Category
  - VAT Amount
  - Income Classification

### Invoice Types (Key Codes)
- **1.1**: Sales Invoice
- **1.2**: Sales Invoice / Intra-community Deliveries
- **1.3**: Sales Invoice / Third Country Deliveries
- **2.1**: Service Invoice (most common for accounting services)
- **2.2**: Service Invoice / Intra-community Services
- **2.3**: Service Invoice / Third Country Services
- **5.1**: Credit Note / Associated
- **5.2**: Credit Note / Non-associated

### VAT Categories
- **1**: 24% (Standard rate)
- **2**: 13% (Reduced rate)
- **3**: 6% (Super-reduced rate)
- **4**: 17% (Island rate)
- **5**: 9% (Island reduced rate)
- **6**: 4% (Island super-reduced rate)
- **7**: 0% (Zero rate)
- **8**: VAT exempt

### Income Classification Types (E3 Categories)
For accounting services, common classifications include:
- **E3_561_001**: Revenue from sales of goods
- **E3_562_001**: Revenue from provision of services
- **E3_563_001**: Other revenue
- **E3_881_001**: Revenue from professional activities

## Response Format

### Successful Response
```json
{
  "response": {
    "index": 1,
    "invoiceUid": "unique_identifier",
    "invoiceMark": "mark_string",
    "classificationMark": "classification_mark",
    "authenticationCode": "auth_code",
    "qrUrl": "qr_code_url"
  }
}
```

### Error Response
```json
{
  "response": {
    "index": 1,
    "invoiceUid": "unique_identifier",
    "errors": [
      {
        "message": "Error description",
        "code": "error_code"
      }
    ]
  }
}
```

## Rate Limits
- Maximum 100 invoices per API call
- Rate limiting applies (exact limits not specified in available documentation)
- Recommended to implement retry logic with exponential backoff

## Data Format
- **Request Format**: JSON containing XML data
- **Character Encoding**: UTF-8
- **Date Format**: ISO 8601 (YYYY-MM-DD)
- **Time Format**: HH:mm:ss
- **Decimal Separator**: Period (.)
- **Currency**: EUR (default)

## Error Handling
Common error scenarios:
- Invalid authentication credentials
- Malformed XML/JSON data
- Missing mandatory fields
- Duplicate invoice numbers
- Invalid VAT numbers
- Network timeouts

## Implementation Notes

### Security Considerations
- Store subscription keys securely (environment variables)
- Use HTTPS for all communications
- Implement proper error logging (without exposing sensitive data)
- Regular key rotation as required by AADE

### Data Validation
- Validate AFM (Greek tax numbers) format: 9 digits
- Ensure VAT numbers match EL + 9 digits format
- Validate invoice number uniqueness per series
- Check amount calculations match line totals

### Retry Strategy
- Implement exponential backoff for failed requests
- Store failed transmissions for manual review
- Queue system for batch processing
- Status tracking per invoice

## Testing Strategy
1. **Sandbox Testing**: Use development environment first
2. **Data Validation**: Test with various invoice types and scenarios
3. **Error Handling**: Test error conditions and recovery
4. **Performance**: Test with maximum allowed batch sizes
5. **Integration**: End-to-end testing with actual invoice workflow

## Compliance Requirements
- All Greek businesses must submit invoices electronically
- Real-time or near real-time submission required
- Data retention requirements apply
- Audit trail must be maintained
- QR codes must be displayed on invoices when provided by AADE