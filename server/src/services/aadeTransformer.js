class AADETransformer {
  /**
   * Transform MongoDB invoice to AADE XML format
   * @param {Object} invoice - Invoice object from MongoDB
   * @returns {String} XML string for AADE API
   */
  invoiceToXML(invoice) {
    // Extract series and sequential number from invoiceNumber
    const { series, aa } = this.parseInvoiceNumber(invoice.invoiceNumber);

    // Check if this is a B2C receipt (type 11.x)
    const isRetailReceipt = invoice.invoiceType.startsWith('11');

    // Build AADE XML structure
    return `<?xml version="1.0" encoding="UTF-8"?>
<InvoicesDoc xmlns="http://www.aade.gr/myDATA/invoice/v1.0" xmlns:icls="https://www.aade.gr/myDATA/incomeClassificaton/v1.0">
  <invoice>
    <issuer>
      <vatNumber>${invoice.issuer.taxInfo.afm}</vatNumber>
      <country>GR</country>
      <branch>0</branch>
      ${invoice.issuer.country !== 'GR' ? `<address>
        <street>${this.escapeXML(invoice.issuer.address.street)}</street>
        <number>${this.escapeXML(invoice.issuer.address.number)}</number>
        <postalCode>${invoice.issuer.address.postalCode}</postalCode>
        <city>${this.escapeXML(invoice.issuer.address.city)}</city>
      </address>` : ''}
    </issuer>
${isRetailReceipt ? this.generateRetailCounterpart(invoice) : this.generateB2BCounterpart(invoice)}

    <invoiceHeader>
      <series>${series}</series>
      <aa>${aa}</aa>
      <issueDate>${this.formatDate(invoice.issueDate)}</issueDate>
      <invoiceType>${invoice.invoiceType}</invoiceType>
      <currency>${invoice.currency}</currency>
    </invoiceHeader>

    <paymentMethods>
      <paymentMethodDetails>
        <type>${invoice.payment.method}</type>
        <amount>${invoice.totals.totalAmount.toFixed(2)}</amount>
      </paymentMethodDetails>
    </paymentMethods>

    ${invoice.invoiceDetails.map((line, index) => {
      // Invoice type 2.1 (services) doesn't allow itemDescr, quantity, measurementUnit
      const isServiceInvoice = invoice.invoiceType === '2.1';
      return `
    <invoiceDetails>
      <lineNumber>${index + 1}</lineNumber>
      ${!isServiceInvoice && line.description ? `<itemDescr>${this.escapeXML(line.description)}</itemDescr>` : ''}
      ${!isServiceInvoice ? `<quantity>${line.quantity}</quantity>` : ''}
      ${!isServiceInvoice ? `<measurementUnit>${this.mapUnit(line.unit)}</measurementUnit>` : ''}
      <netValue>${line.netValue.toFixed(2)}</netValue>
      <vatCategory>${line.vatCategory}</vatCategory>
      <vatAmount>${line.vatAmount.toFixed(2)}</vatAmount>${this.generateIncomeClassification(line)}
    </invoiceDetails>`;
    }).join('')}

    <invoiceSummary>
      <totalNetValue>${invoice.totals.totalNetValue.toFixed(2)}</totalNetValue>
      <totalVatAmount>${invoice.totals.totalVatAmount.toFixed(2)}</totalVatAmount>
      <totalWithheldAmount>${(invoice.totals.totalWithheldAmount || 0).toFixed(2)}</totalWithheldAmount>
      <totalFeesAmount>${(invoice.totals.totalFeesAmount || 0).toFixed(2)}</totalFeesAmount>
      <totalStampDutyAmount>${(invoice.totals.totalStampDutyAmount || 0).toFixed(2)}</totalStampDutyAmount>
      <totalOtherTaxesAmount>${(invoice.totals.totalOtherTaxesAmount || 0).toFixed(2)}</totalOtherTaxesAmount>
      <totalDeductionsAmount>${(invoice.totals.totalDeductionsAmount || 0).toFixed(2)}</totalDeductionsAmount>
      <totalGrossValue>${invoice.totals.totalGrossValue.toFixed(2)}</totalGrossValue>${this.generateSummaryClassifications(invoice)}
    </invoiceSummary>
  </invoice>
</InvoicesDoc>`;
  }

  /**
   * Generate counterpart section for B2B invoices
   */
  generateB2BCounterpart(invoice) {
    return `
    <counterpart>
      <vatNumber>${invoice.counterpart.taxInfo?.afm || ''}</vatNumber>
      <country>${invoice.counterpart.country || 'GR'}</country>
      <branch>0</branch>
      ${(invoice.counterpart.country || 'GR') !== 'GR' && invoice.counterpart.name ? `<name>${this.escapeXML(invoice.counterpart.name)}</name>` : ''}
      ${(invoice.counterpart.country || 'GR') !== 'GR' ? `<address>
        <street>${this.escapeXML(invoice.counterpart.address.street || '')}</street>
        <number>${this.escapeXML(invoice.counterpart.address.number || '')}</number>
        <postalCode>${invoice.counterpart.address.postalCode || ''}</postalCode>
        <city>${this.escapeXML(invoice.counterpart.address.city || '')}</city>
      </address>` : ''}
    </counterpart>`;
  }

  /**
   * Generate counterpart section for B2C retail receipts
   * For retail receipts (11.x), counterpart is simplified - only country is required
   */
  generateRetailCounterpart(invoice) {
    const country = invoice.counterpart.country || 'GR';

    // For retail receipts, we only need country
    // If customer has AFM, we can include it but it's optional
    if (invoice.counterpart.taxInfo?.afm) {
      return `
    <counterpart>
      <vatNumber>${invoice.counterpart.taxInfo.afm}</vatNumber>
      <country>${country}</country>
      <branch>0</branch>
    </counterpart>`;
    }

    // Minimal counterpart for anonymous retail customer
    return `
    <counterpart>
      <country>${country}</country>
    </counterpart>`;
  }

  /**
   * Generate income classification XML for invoice line
   */
  generateIncomeClassification(line) {
    if (!line.incomeClassification || line.incomeClassification.length === 0) {
      return '';
    }

    const classification = line.incomeClassification[0];
    return `
        <incomeClassification>
          <icls:classificationType>${classification.classificationType}</icls:classificationType>
          <icls:classificationCategory>${classification.categoryId}</icls:classificationCategory>
          <icls:amount>${(classification.amount || line.netValue).toFixed(2)}</icls:amount>
        </incomeClassification>`;
  }

  /**
   * Generate income classification summary for invoice
   * Aggregates all line-level classifications for the summary section
   */
  generateSummaryClassifications(invoice) {
    // Collect all classifications from invoice lines
    const classificationsMap = new Map();

    invoice.invoiceDetails.forEach(line => {
      if (line.incomeClassification && line.incomeClassification.length > 0) {
        const classification = line.incomeClassification[0];
        const key = `${classification.classificationType}_${classification.categoryId}`;

        const amount = classification.amount || line.netValue;

        if (classificationsMap.has(key)) {
          classificationsMap.get(key).amount += amount;
        } else {
          classificationsMap.set(key, {
            classificationType: classification.classificationType,
            categoryId: classification.categoryId,
            amount: amount
          });
        }
      }
    });

    // Generate XML for all classifications
    if (classificationsMap.size === 0) {
      return '';
    }

    let xml = '';
    classificationsMap.forEach(classification => {
      xml += `
      <incomeClassification>
        <icls:classificationType>${classification.classificationType}</icls:classificationType>
        <icls:classificationCategory>${classification.categoryId}</icls:classificationCategory>
        <icls:amount>${classification.amount.toFixed(2)}</icls:amount>
      </incomeClassification>`;
    });

    return xml;
  }

  /**
   * Parse invoice number to extract series and sequential number
   * Example: "A0001" → { series: "A", aa: "1" }
   */
  parseInvoiceNumber(invoiceNumber) {
    // Match pattern: Series (letters) + Sequential (digits)
    // New format: A0001, A0002, etc. (no year)
    const match = invoiceNumber.match(/^([A-Z]+)(\d+)$/);

    if (!match) {
      throw new Error(`Invalid invoice number format: ${invoiceNumber}`);
    }

    return {
      series: match[1],  // "A"
      aa: parseInt(match[2], 10).toString()  // "1" (remove leading zeros)
    };
  }

  /**
   * Format date to YYYY-MM-DD for AADE
   */
  formatDate(date) {
    const d = new Date(date);
    return d.toISOString().split('T')[0]; // "2025-11-18"
  }

  /**
   * Escape special XML characters
   */
  escapeXML(str) {
    if (!str) return '';
    return str
      .toString()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Map our unit types to AADE measurement unit codes
   */
  mapUnit(unit) {
    const unitMap = {
      'pcs': '1',      // Τεμάχια (pieces)
      'hrs': '2',      // Ώρες (hours)
      'days': '3',     // Ημέρες (days)
      'kg': '4',       // Κιλά (kilograms)
      'm': '5',        // Μέτρα (meters)
      'm2': '6',       // Τετραγωνικά μέτρα (square meters)
      'liters': '7',   // Λίτρα (liters)
      'months': '8'    // Μήνες (months)
    };
    return unitMap[unit] || '1'; // Default to pieces
  }
}

module.exports = new AADETransformer();
