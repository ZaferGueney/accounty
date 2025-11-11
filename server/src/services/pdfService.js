const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs').promises;

class PDFService {
  constructor() {
    this.browser = null;
  }

  async initialize() {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
    }
  }

  async generateInvoicePDF(invoiceData, theme = 'light') {
    await this.initialize();
    
    const page = await this.browser.newPage();
    
    try {
      // Generate HTML content from invoice data
      const html = await this.generateInvoiceHTML(invoiceData, theme);
      
      // Set content and wait for any resources
      await page.setContent(html, { waitUntil: 'networkidle0' });
      
      // Generate PDF
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          bottom: '20mm',
          left: '15mm',
          right: '15mm'
        }
      });
      
      return pdf;
    } finally {
      await page.close();
    }
  }

  async generateInvoiceHTML(invoice, theme = 'light') {
    // Get invoice template
    const templatePath = path.join(__dirname, '../templates/invoiceTemplate.html');
    let template = await fs.readFile(templatePath, 'utf8');
    
    // Theme configuration
    const themes = {
      light: {
        background: '#ffffff',
        foreground: '#000000',
        muted: '#6b7280',
        border: '#e5e7eb',
        accent: '#3b82f6',
        cardBg: '#f9fafb',
        success: '#10b981',
        warning: '#f59e0b',
        error: '#ef4444'
      },
      dark: {
        background: '#0f172a',
        foreground: '#ffffff',
        muted: '#94a3b8',
        border: '#334155',
        accent: '#3b82f6',
        cardBg: '#1e293b',
        success: '#10b981',
        warning: '#f59e0b',
        error: '#ef4444'
      },
      professional: {
        background: '#ffffff',
        foreground: '#111827',
        muted: '#6b7280',
        border: '#d1d5db',
        accent: '#4338ca',
        cardBg: '#f3f4f6',
        success: '#059669',
        warning: '#d97706',
        error: '#dc2626'
      }
    };

    const currentTheme = themes[theme] || themes.light;

    // Calculate totals
    const totals = invoice.totals || {
      totalNetValue: 0,
      totalVatAmount: 0,
      totalAmount: 0
    };

    // Format date
    const formatDate = (dateString) => {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    };

    // Get VAT regulation text
    const getVatRegulationText = (regulation) => {
      const regulations = {
        standard: 'Standard VAT',
        taxFree: 'Tax-free supplies §4 UStG',
        reverseChargeDE: 'Reverse charge §13b UStG',
        reverseChargeEU: 'EU Reverse charge §18b UStG',
        intraCommunity: 'Intra-Community deliveries',
        oss: 'One-Stop-Shop (OSS)',
        export: 'Export deliveries',
        nonTaxableAbroad: 'Non-taxable service abroad'
      };
      return regulations[regulation] || 'Standard VAT';
    };

    // Replace placeholders
    const replacements = {
      '{{theme.background}}': currentTheme.background,
      '{{theme.foreground}}': currentTheme.foreground,
      '{{theme.muted}}': currentTheme.muted,
      '{{theme.border}}': currentTheme.border,
      '{{theme.accent}}': currentTheme.accent,
      '{{theme.cardBg}}': currentTheme.cardBg,
      '{{invoiceNumber}}': invoice.invoiceNumber || 'DRAFT',
      '{{issueDate}}': formatDate(invoice.issueDate),
      '{{dueDate}}': formatDate(invoice.dueDate),
      '{{series}}': invoice.series || 'A',
      '{{issuer.name}}': invoice.issuer?.name || '',
      '{{issuer.afm}}': invoice.issuer?.taxInfo?.afm || '',
      '{{issuer.doy}}': invoice.issuer?.taxInfo?.doy?.name || '',
      '{{issuer.address}}': invoice.issuer?.address ? 
        `${invoice.issuer.address.street} ${invoice.issuer.address.number}, ${invoice.issuer.address.city} ${invoice.issuer.address.postalCode}` : '',
      '{{counterpart.name}}': invoice.counterpart?.name || '',
      '{{counterpart.afm}}': invoice.counterpart?.taxInfo?.afm || '',
      '{{counterpart.address}}': invoice.counterpart?.address ? 
        `${invoice.counterpart.address.street} ${invoice.counterpart.address.number}, ${invoice.counterpart.address.city} ${invoice.counterpart.address.postalCode}` : '',
      '{{currency}}': invoice.currency || 'EUR',
      '{{totalNetValue}}': totals.totalNetValue.toFixed(2),
      '{{totalVatAmount}}': totals.totalVatAmount.toFixed(2),
      '{{totalAmount}}': totals.totalAmount.toFixed(2),
      '{{notes}}': invoice.notes || '',
      '{{notesDisplay}}': invoice.notes ? 'block' : 'none',
      '{{vatRegulation}}': getVatRegulationText(invoice.vatRegulation),
      '{{invoiceItems}}': this.generateInvoiceItemsHTML(invoice.invoiceDetails || [], invoice.currency)
    };

    // Replace all placeholders
    for (const [placeholder, value] of Object.entries(replacements)) {
      template = template.replace(new RegExp(placeholder, 'g'), value);
    }

    return template;
  }

  generateInvoiceItemsHTML(items, currency = 'EUR') {
    const currencySymbol = currency === 'EUR' ? '€' : currency === 'USD' ? '$' : '£';
    
    return items.map((item, index) => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid {{theme.border}};">${index + 1}</td>
        <td style="padding: 12px; border-bottom: 1px solid {{theme.border}};">
          <div style="font-weight: 500;">${item.description || 'Item'}</div>
          ${item.itemDescription ? `<div style="color: {{theme.muted}}; font-size: 12px; margin-top: 4px;">${item.itemDescription}</div>` : ''}
        </td>
        <td style="padding: 12px; border-bottom: 1px solid {{theme.border}}; text-align: center;">${item.quantity || 1}</td>
        <td style="padding: 12px; border-bottom: 1px solid {{theme.border}}; text-align: center;">${item.unit || 'pcs'}</td>
        <td style="padding: 12px; border-bottom: 1px solid {{theme.border}}; text-align: right;">${currencySymbol}${(item.unitPrice || 0).toFixed(2)}</td>
        <td style="padding: 12px; border-bottom: 1px solid {{theme.border}}; text-align: center;">${(item.vatAmount / item.netValue * 100 || 0).toFixed(0)}%</td>
        <td style="padding: 12px; border-bottom: 1px solid {{theme.border}}; text-align: right; font-weight: 600;">${currencySymbol}${((item.netValue || 0) + (item.vatAmount || 0)).toFixed(2)}</td>
      </tr>
    `).join('');
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

module.exports = new PDFService();