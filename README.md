# BillMou

A minimalistic invoicing web application for Greece, providing legally compliant invoicing solutions.

## Project Overview

BillMou is a SevDesk alternative specifically designed for the Greek market, focusing on:
- Legal compliance with Greek tax regulations
- Automated reporting to tax authorities via API integration
- Minimalistic, clean user interface
- Subscription-based business model

## Features

### Core Functionality
- Invoice creation and management
- Legal compliance for Greek tax requirements
- Automated export and reporting to Greek tax office
- Customer management
- Payment tracking

### Business Model
- Stripe subscription integration
- Monthly/yearly payment plans
- Tiered pricing structure

### Technical Requirements
- Next.js frontend (React-based)
- Node.js backend API
- Custom ports for development (not standard 3000/5000)
- Database integration for invoice and customer data
- API integration with Greek tax authority systems
- Stripe payment processing

## Project Structure

```
BillMou/
├── client/          # Next.js frontend application
├── server/          # Node.js backend API
└── README.md        # Project documentation
```

## Development Setup

The application uses custom ports to avoid conflicts:
- Client: Custom port (not 3000)
- Server: Custom port (not 5000)

## Legal Compliance

The application must ensure:
- Proper invoice formatting according to Greek standards
- Automated tax reporting
- Data retention policies compliance
- GDPR compliance for customer data

## Target Market

Small to medium businesses in Greece requiring:
- Professional invoice generation
- Tax compliance automation
- Simple, cost-effective accounting solution

## Technology Stack

- **Frontend**: Next.js, React
- **Backend**: Node.js, Express
- **Database**: TBD (PostgreSQL/MongoDB)
- **Payments**: Stripe
- **Tax Integration**: Greek tax authority API
- **Deployment**: TBD

## Development Phases

1. ✅ Project setup and basic structure
2. 🔄 Authentication system
3. 📝 Invoice creation and management
4. 🏛️ Greek tax compliance integration
5. 💳 Stripe subscription integration
6. 🚀 Production deployment

---

*This project aims to simplify invoicing for Greek businesses while ensuring full legal compliance.*