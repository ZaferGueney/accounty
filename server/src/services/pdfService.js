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
    console.log('🎨 PDFService: Starting PDF generation with theme:', theme);
    console.log('📊 PDFService: Invoice data preview:', {
      invoiceNumber: invoiceData.invoiceNumber,
      issuerName: invoiceData.issuer?.name,
      counterpartName: invoiceData.counterpart?.name,
      itemsCount: invoiceData.invoiceDetails?.length || 0,
      totals: invoiceData.totals
    });

    await this.initialize();
    console.log('🌐 PDFService: Browser initialized');
    
    const page = await this.browser.newPage();
    console.log('📄 PDFService: New page created');
    
    try {
      // Generate HTML content from invoice data
      console.log('🔄 PDFService: Generating HTML content...');
      const html = await this.generateInvoiceHTML(invoiceData, theme);
      console.log('✅ PDFService: HTML generated, length:', html.length);
      
      // Set content and wait for any resources
      console.log('🔄 PDFService: Setting page content...');
      await page.setContent(html, { waitUntil: 'networkidle0' });
      console.log('✅ PDFService: Page content set');
      
      // Generate PDF
      console.log('🔄 PDFService: Generating PDF...');
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
      console.log('✅ PDFService: PDF generated, size:', pdf.length, 'bytes');
      
      return pdf;
    } catch (error) {
      console.error('💥 PDFService: Error generating PDF:', error);
      throw error;
    } finally {
      await page.close();
      console.log('🧹 PDFService: Page closed');
    }
  }

  async generateInvoiceHTML(invoice, theme = 'light') {
    console.log('📄 PDFService: Starting HTML generation...');
    console.log('📋 PDFService: Invoice details:', {
      invoiceNumber: invoice.invoiceNumber,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      vatRegulation: invoice.vatRegulation
    });

    // Get invoice template
    const templatePath = path.join(__dirname, '../templates/invoiceTemplate.html');
    console.log('📄 PDFService: Loading template from:', templatePath);
    let template = await fs.readFile(templatePath, 'utf8');
    console.log('✅ PDFService: Template loaded, length:', template.length);
    
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
    console.log('🎨 PDFService: Using theme:', theme, 'colors:', currentTheme);

    // Calculate totals
    const totals = invoice.totals || {
      totalNetValue: 0,
      totalVatAmount: 0,
      totalAmount: 0
    };
    console.log('💰 PDFService: Calculated totals:', totals);

    // Format date
    const formatDate = (dateString) => {
      if (!dateString) return 'N/A';
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

    // Generate invoice items HTML first with proper theme replacement
    console.log('🔄 PDFService: Generating invoice items HTML...');
    const invoiceItemsHTML = this.generateInvoiceItemsHTML(invoice.invoiceDetails || [], invoice.currency, currentTheme);
    console.log('✅ PDFService: Invoice items generated, length:', invoiceItemsHTML.length);

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
        `${invoice.issuer.address.street || ''} ${invoice.issuer.address.number || ''}, ${invoice.issuer.address.city || ''} ${invoice.issuer.address.postalCode || ''}`.trim() : '',
      '{{counterpart.name}}': invoice.counterpart?.name || '',
      '{{counterpart.afm}}': invoice.counterpart?.taxInfo?.afm || '',
      '{{counterpart.address}}': invoice.counterpart?.address ? 
        `${invoice.counterpart.address.street || ''} ${invoice.counterpart.address.number || ''}, ${invoice.counterpart.address.city || ''} ${invoice.counterpart.address.postalCode || ''}`.trim() : '',
      '{{currency}}': invoice.currency || 'EUR',
      '{{totalNetValue}}': totals.totalNetValue?.toFixed(2) || '0.00',
      '{{totalVatAmount}}': totals.totalVatAmount?.toFixed(2) || '0.00',
      '{{totalAmount}}': totals.totalAmount?.toFixed(2) || '0.00',
      '{{notes}}': invoice.notes || '',
      '{{notesDisplay}}': invoice.notes ? 'block' : 'none',
      '{{vatRegulation}}': getVatRegulationText(invoice.vatRegulation),
      '{{invoiceItems}}': invoiceItemsHTML
    };

    console.log('🔄 PDFService: Replacing placeholders...');
    console.log('📄 PDFService: Replacement values preview:', {
      invoiceNumber: replacements['{{invoiceNumber}}'],
      issuerName: replacements['{{issuer.name}}'],
      counterpartName: replacements['{{counterpart.name}}'],
      itemsHtmlLength: replacements['{{invoiceItems}}'].length
    });

    // Replace all placeholders
    for (const [placeholder, value] of Object.entries(replacements)) {
      template = template.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
    }

    console.log('✅ PDFService: All placeholders replaced, final HTML length:', template.length);
    return template;
  }

  generateInvoiceItemsHTML(items, currency = 'EUR', theme) {
    const currencySymbol = currency === 'EUR' ? '€' : currency === 'USD' ? '$' : '£';
    console.log('📋 PDFService: Generating items HTML for', items.length, 'items with currency:', currency);
    
    if (!items || items.length === 0) {
      console.log('⚠️ PDFService: No items to generate');
      return '<tr><td colspan="7" style="text-align: center; padding: 20px; color: #6b7280;">No items</td></tr>';
    }

    const html = items.map((item, index) => {
      console.log(`📦 PDFService: Processing item ${index + 1}:`, {
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        netValue: item.netValue,
        vatAmount: item.vatAmount
      });

      const vatPercentage = item.netValue && item.vatAmount ? 
        (item.vatAmount / item.netValue * 100).toFixed(0) : '0';
      const totalPrice = ((item.netValue || 0) + (item.vatAmount || 0)).toFixed(2);

      return `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid ${theme.border};">${index + 1}</td>
          <td style="padding: 12px; border-bottom: 1px solid ${theme.border};">
            <div style="font-weight: 500; color: ${theme.foreground};">${item.description || 'Item'}</div>
            ${item.itemDescription ? `<div style="color: ${theme.muted}; font-size: 12px; margin-top: 4px;">${item.itemDescription}</div>` : ''}
          </td>
          <td style="padding: 12px; border-bottom: 1px solid ${theme.border}; text-align: center; color: ${theme.foreground};">${item.quantity || 1}</td>
          <td style="padding: 12px; border-bottom: 1px solid ${theme.border}; text-align: center; color: ${theme.foreground};">${item.unit || 'pcs'}</td>
          <td style="padding: 12px; border-bottom: 1px solid ${theme.border}; text-align: right; color: ${theme.foreground};">${currencySymbol}${(item.unitPrice || 0).toFixed(2)}</td>
          <td style="padding: 12px; border-bottom: 1px solid ${theme.border}; text-align: center; color: ${theme.foreground};">${vatPercentage}%</td>
          <td style="padding: 12px; border-bottom: 1px solid ${theme.border}; text-align: right; font-weight: 600; color: ${theme.foreground};">${currencySymbol}${totalPrice}</td>
        </tr>`;
    }).join('');

    console.log('✅ PDFService: Items HTML generated, length:', html.length);
    return html;
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

module.exports = new PDFService();