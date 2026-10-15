const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');

class PDFService {
  constructor() {
    this.browser = null;
    this.translations = {};
    this.defaultLogoBase64 = null;
  }

  getDefaultLogo() {
    if (this.defaultLogoBase64) {
      return this.defaultLogoBase64;
    }

    try {
      const logoPath = path.join(__dirname, '../../public/images/logo.png');
      if (fsSync.existsSync(logoPath)) {
        const logoBuffer = fsSync.readFileSync(logoPath);
        this.defaultLogoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
        return this.defaultLogoBase64;
      }
    } catch (error) {
      console.error('Error loading default logo:', error);
    }

    return null;
  }

  getTranslations(language = 'en') {
    // Hardcoded translations to avoid file system issues
    const translations = {
      en: {
        pdf: {
          invoice: 'INVOICE',
          from: 'FROM',
          billTo: 'BILL TO',
          invoiceNumber: 'Invoice #',
          issueDate: 'Issue Date',
          dueDate: 'Due Date',
          description: 'Description',
          quantity: 'Qty',
          unit: 'Unit',
          price: 'Price',
          vat: 'VAT',
          total: 'Total',
          subtotal: 'Subtotal',
          vatTotal: 'VAT Total',
          grandTotal: 'Total Amount',
          vatNumber: 'VAT',
          taxOffice: 'Tax Office',
          activityCodes: 'Activity Codes',
          thankYou: 'Thank you for your business',
          vatRegulation: 'VAT Regulation',
          notes: 'Notes',
          bankingInfo: 'Banking Information',
          accountHolder: 'Account Holder',
          aadeQR: 'AADE QR Code',
          invoiceType: 'Invoice Type',
          invoiceTypes: {
            '1.1': 'Sales Invoice',
            '2.1': 'Service Invoice',
            '2.2': 'Service Invoice (EU)',
            '5.1': 'Credit Note (Associated)',
            '5.2': 'Credit Note (Non-Associated)'
          }
        }
      },
      el: {
        pdf: {
          invoice: 'ΤΙΜΟΛΟΓΙΟ',
          from: 'ΑΠΟ',
          billTo: 'ΠΡΟΣ',
          invoiceNumber: 'Τιμολόγιο #',
          issueDate: 'Ημερομηνία Έκδοσης',
          dueDate: 'Ημερομηνία Λήξης',
          description: 'Περιγραφή',
          quantity: 'Ποσότητα',
          unit: 'Μονάδα',
          price: 'Τιμή',
          vat: 'ΦΠΑ',
          total: 'Σύνολο',
          subtotal: 'Καθαρή Αξία',
          vatTotal: 'Σύνολο ΦΠΑ',
          grandTotal: 'Συνολικό Ποσό',
          vatNumber: 'ΑΦΜ',
          taxOffice: 'ΔΟΥ',
          activityCodes: 'Κωδικοί Δραστηριότητας',
          thankYou: 'Σας ευχαριστούμε για τη συνεργασία',
          vatRegulation: 'Φορολογικός Κανονισμός ΦΠΑ',
          notes: 'Σημειώσεις',
          bankingInfo: 'Τραπεζικές Πληροφορίες',
          accountHolder: 'Δικαιούχος',
          aadeQR: 'ΑΑΔΕ QR Κωδικός',
          invoiceType: 'Τύπος Τιμολογίου',
          invoiceTypes: {
            '1.1': 'Τιμολόγιο Πώλησης',
            '2.1': 'Τιμολόγιο Παροχής Υπηρεσιών',
            '2.2': 'Τιμολόγιο Παροχής (ΕΕ)',
            '5.1': 'Πιστωτικό Τιμολόγιο (Συσχετιζόμενο)',
            '5.2': 'Πιστωτικό Τιμολόγιο (Μη Συσχετιζόμενο)'
          }
        }
      },
      de: {
        pdf: {
          invoice: 'RECHNUNG',
          from: 'VON',
          billTo: 'AN',
          invoiceNumber: 'Rechnung #',
          issueDate: 'Ausstellungsdatum',
          dueDate: 'Fälligkeitsdatum',
          description: 'Beschreibung',
          quantity: 'Menge',
          unit: 'Einheit',
          price: 'Preis',
          vat: 'MwSt',
          total: 'Gesamt',
          subtotal: 'Zwischensumme',
          vatTotal: 'MwSt Gesamt',
          grandTotal: 'Gesamtbetrag',
          vatNumber: 'USt-IdNr',
          taxOffice: 'Finanzamt',
          activityCodes: 'Aktivitätscodes',
          thankYou: 'Vielen Dank für Ihr Geschäft',
          vatRegulation: 'MwSt.-Regelung',
          notes: 'Notizen',
          bankingInfo: 'Bankinformationen',
          accountHolder: 'Kontoinhaber',
          aadeQR: 'AADE QR-Code',
          invoiceType: 'Rechnungstyp',
          invoiceTypes: {
            '1.1': 'Verkaufsrechnung',
            '2.1': 'Dienstleistungsrechnung',
            '2.2': 'Dienstleistungsrechnung (EU)',
            '5.1': 'Gutschrift (Zugeordnet)',
            '5.2': 'Gutschrift (Nicht zugeordnet)'
          }
        }
      }
    };

    return translations[language] || translations.en;
  }

  async initialize() {
    if (!this.browser) {
      const isProduction = process.env.NODE_ENV === 'production';

      let launchOptions;

      if (isProduction) {
        // Use @sparticuz/chromium for cloud deployment
        launchOptions = {
          args: chromium.args,
          defaultViewport: chromium.defaultViewport,
          executablePath: await chromium.executablePath(),
          headless: chromium.headless,
        };
        console.log('🚀 Launching Puppeteer with @sparticuz/chromium');
      } else {
        // Local development - use system Chrome
        const possiblePaths = [
          '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
          '/Applications/Chromium.app/Contents/MacOS/Chromium',
          'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
          '/usr/bin/google-chrome',
          '/usr/bin/chromium-browser'
        ];

        let executablePath = null;
        for (const chromePath of possiblePaths) {
          if (fsSync.existsSync(chromePath)) {
            executablePath = chromePath;
            break;
          }
        }

        launchOptions = {
          headless: 'new',
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
          executablePath
        };
        console.log('🚀 Launching Puppeteer with local Chrome at:', executablePath);
      }

      this.browser = await puppeteer.launch(launchOptions);
    }
  }

  async generateInvoicePDF(invoiceData, theme = 'light', isPreview = false, language = 'en') {
    console.log('🎨 PDFService: Starting PDF generation with theme:', theme, 'language:', language);
    console.log('📊 PDFService: Invoice data preview:', {
      invoiceNumber: invoiceData.invoiceNumber,
      issuerName: invoiceData.issuer?.name,
      counterpartName: invoiceData.counterpart?.name,
      itemsCount: invoiceData.invoiceDetails?.length || 0,
      totals: invoiceData.totals,
      isPreview,
      language
    });

    await this.initialize();
    console.log('🌐 PDFService: Browser initialized');

    const page = await this.browser.newPage();
    console.log('📄 PDFService: New page created');

    try {
      // Generate HTML content from invoice data
      console.log('🔄 PDFService: Generating HTML content...');
      const html = await this.generateInvoiceHTML(invoiceData, theme, isPreview, language);
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

  async generateInvoiceHTML(invoice, theme = 'light', isPreview = false, language = 'en') {
    if (invoice.documentBrand === 'sitemou') return require('./sitemouDocument').html(invoice,language,isPreview);
    console.log('📄 PDFService: Starting HTML generation...');
    console.log('📋 PDFService: Invoice details:', {
      invoiceNumber: invoice.invoiceNumber,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      vatRegulation: invoice.vatRegulation,
      isPreview,
      language
    });

    // Load translations
    const translations = this.getTranslations(language);
    const t = translations.pdf || {};

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
        accent: '#111827',
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
        accent: '#ffffff',
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
        accent: '#111827',
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

    // Get KAD codes if available
    const activityCodes = invoice.issuer?.activityCodes || [];
    const activityCodesDisplay = activityCodes.length > 0 ? 'block' : 'none';
    const activityCodesFormatted = activityCodes.map(kad => `${kad.code} - ${kad.description || kad.descriptionEN || ''}`).join(', ');

    // Only show VAT regulation if it's not standard
    const vatRegulationText = getVatRegulationText(invoice.vatRegulation);
    const vatRegulationDisplay = (invoice.vatRegulation && invoice.vatRegulation !== 'standard') ? 'block' : 'none';

    // Banking information - support both single object (legacy) and array (new)
    let bankingArray = [];
    if (Array.isArray(invoice.issuer?.banking)) {
      bankingArray = invoice.issuer.banking;
    } else if (invoice.issuer?.banking && typeof invoice.issuer.banking === 'object') {
      // Legacy: single banking object
      bankingArray = [invoice.issuer.banking];
    }

    const hasBanking = bankingArray.length > 0 && bankingArray.some(b => b.iban && b.bankName);
    const bankingDisplay = (hasBanking && !invoice.hideBankDetails) ? 'block' : 'none';

    // Generate HTML for all bank accounts
    const bankingDetailsHTML = bankingArray.map(bank => {
      const swiftLine = bank.swift ? `
            <div class="banking-row">
              <span class="banking-label">SWIFT/BIC:</span>
              <span class="banking-value">${bank.swift}</span>
            </div>` : '';

      return `
          <div class="bank-account">
            <strong>${bank.bankName || 'Bank'}</strong>
            <div class="banking-row">
              <span class="banking-label">${t.accountHolder || 'Account Holder'}:</span>
              <span class="banking-value">${bank.accountName || ''}</span>
            </div>
            <div class="banking-row">
              <span class="banking-label">IBAN:</span>
              <span class="banking-value">${bank.iban || ''}</span>
            </div>${swiftLine}
          </div>`;
    }).join('');

    // AADE QR Code - use actual QR code from AADE response
    const aadeQRCode = invoice.aadeInfo?.qrUrl ?
      `<img src="${invoice.aadeInfo.qrUrl}" alt="AADE QR Code" style="width: 100%; height: 100%; object-fit: contain;">` :
      `<div class="qr-placeholder-content"><span class="qr-icon">⊞</span><div class="qr-text">AADE<br>QR CODE</div></div>`;

    // Issued through an e-invoicing provider: show provider, UID and authentication code
    const esc = (v) => String(v || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const providerLine = invoice.providerInfo?.provider === 'parochos' && invoice.aadeInfo?.mark
      ? `<div style="margin-top: 6px; font-size: 7px; color: #666; text-align: center; word-break: break-all;">`
        + `Πάροχος: PAROCHOS (ΑΦΜ 802023570)`
        + (invoice.aadeInfo.uid ? `<br>UID: ${esc(invoice.aadeInfo.uid)}` : '')
        + (invoice.aadeInfo.authenticationCode ? `<br>Auth: ${esc(invoice.aadeInfo.authenticationCode)}` : '')
        + `</div>`
      : '';

    // Legal form mapping
    const legalFormMap = {
      'individual': '',
      'oe': 'O.E.',
      'ee': 'E.E.',
      'epe': 'E.P.E.',
      'ae': 'A.E.',
      'ike': 'I.K.E.',
      'other': ''
    };

    const legalForm = invoice.issuer?.legalForm ? legalFormMap[invoice.issuer.legalForm] || '' : '';
    const issuerNameWithLegalForm = legalForm ? `${invoice.issuer.name} ${legalForm}` : invoice.issuer.name;

    // Company Logo - use custom logo from settings or default logo
    const defaultLogo = this.getDefaultLogo();
    let companyLogo;
    let logoContainerClass;

    if (invoice.issuer?.logo) {
      // Use custom logo from settings - no dashed border
      companyLogo = `<img src="${invoice.issuer.logo}" alt="Company Logo" style="width: 100%; height: 100%; object-fit: contain;">`;
      logoContainerClass = 'logo-container';
    } else if (defaultLogo) {
      // Use default logo - no dashed border
      companyLogo = `<img src="${defaultLogo}" alt="Company Logo" style="width: 100%; height: 100%; object-fit: contain;">`;
      logoContainerClass = 'logo-container';
    } else {
      // Fallback to placeholder - with dashed border
      companyLogo = `<div class="qr-placeholder-content"><span class="qr-icon">🏢</span><div class="qr-text">COMPANY<br>LOGO</div></div>`;
      logoContainerClass = 'logo-placeholder';
    }

    // Footer text
    const footerText = invoice.footerText || '';
    const footerTextDisplay = footerText ? 'block' : 'none';

    // Invoice type label
    const invoiceTypeLabel = t.invoiceTypes?.[invoice.invoiceType] || invoice.invoiceType || 'N/A';

    // Replace placeholders
    const replacements = {
      '{{language}}': language,
      '{{theme.background}}': currentTheme.background,
      '{{theme.foreground}}': currentTheme.foreground,
      '{{theme.muted}}': currentTheme.muted,
      '{{theme.border}}': currentTheme.border,
      '{{theme.accent}}': currentTheme.accent,
      '{{theme.cardBg}}': currentTheme.cardBg,
      '{{t_invoice}}': t.invoice || 'INVOICE',
      '{{t_from}}': t.from || 'FROM',
      '{{t_billTo}}': t.billTo || 'BILL TO',
      '{{t_invoiceNumber}}': t.invoiceNumber || 'Invoice #',
      '{{t_issueDate}}': t.issueDate || 'Issue Date',
      '{{t_dueDate}}': t.dueDate || 'Due Date',
      '{{t_description}}': t.description || 'Description',
      '{{t_quantity}}': t.quantity || 'Qty',
      '{{t_unit}}': t.unit || 'Unit',
      '{{t_price}}': t.price || 'Price',
      '{{t_vat}}': t.vat || 'VAT',
      '{{t_total}}': t.total || 'Total',
      '{{t_subtotal}}': t.subtotal || 'Subtotal',
      '{{t_vatTotal}}': t.vatTotal || 'VAT Total',
      '{{t_grandTotal}}': t.grandTotal || 'Total Amount',
      '{{t_vatNumber}}': t.vatNumber || 'VAT',
      '{{t_taxOffice}}': t.taxOffice || 'Tax Office',
      '{{t_activityCodes}}': t.activityCodes || 'Activity Codes',
      '{{t_thankYou}}': t.thankYou || 'Thank you for your business',
      '{{t_vatRegulation}}': t.vatRegulation || 'VAT Regulation',
      '{{t_notes}}': t.notes || 'Notes',
      '{{t_bankingInfo}}': t.bankingInfo || 'Banking Information',
      '{{t_accountHolder}}': t.accountHolder || 'Account Holder',
      '{{t_aadeQR}}': t.aadeQR || 'AADE QR Code',
      '{{t_invoiceType}}': t.invoiceType || 'Invoice Type',
      '{{invoiceNumber}}': invoice.invoiceNumber || 'DRAFT',
      '{{aadeMark}}': invoice.aadeInfo?.mark || '',
      '{{markDisplay}}': invoice.aadeInfo?.mark ? 'block' : 'none',
      '{{invoiceTypeLabel}}': invoiceTypeLabel,
      '{{issueDate}}': formatDate(invoice.issueDate),
      '{{dueDate}}': formatDate(invoice.dueDate),
      '{{issuer.name}}': issuerNameWithLegalForm || '',
      '{{issuer.afm}}': invoice.issuer?.taxInfo?.afm || '',
      '{{issuer.doy}}': invoice.issuer?.taxInfo?.doy?.name || '',
      '{{issuer.gemi}}': invoice.issuer?.taxInfo?.gemi || '',
      '{{issuer.address}}': invoice.issuer?.address ?
        `${invoice.issuer.address.street || ''} ${invoice.issuer.address.number || ''}, ${invoice.issuer.address.city || ''} ${invoice.issuer.address.postalCode || ''}`.trim() : '',
      '{{counterpart.name}}': invoice.counterpart?.name || '',
      '{{counterpart.afm}}': invoice.counterpart?.taxInfo?.afm || '',
      '{{counterpart.address}}': invoice.counterpart?.address ?
        `${invoice.counterpart.address.street || ''} ${invoice.counterpart.address.number || ''}, ${invoice.counterpart.address.city || ''} ${invoice.counterpart.address.postalCode || ''}`.trim() : '',
      '{{totalNetValue}}': totals.totalNetValue?.toFixed(2) || '0.00',
      '{{totalVatAmount}}': totals.totalVatAmount?.toFixed(2) || '0.00',
      '{{totalAmount}}': totals.totalAmount?.toFixed(2) || '0.00',
      '{{notes}}': invoice.notes || '',
      '{{notesDisplay}}': invoice.notes ? 'block' : 'none',
      '{{vatRegulation}}': vatRegulationText,
      '{{vatRegulationDisplay}}': vatRegulationDisplay,
      '{{activityCodes}}': activityCodesFormatted,
      '{{activityCodesDisplay}}': activityCodesDisplay,
      '{{bankingDisplay}}': bankingDisplay,
      '{{bankingDetailsHTML}}': bankingDetailsHTML,
      '{{aadeQRCode}}': aadeQRCode,
      '{{providerLine}}': providerLine,
      '{{companyLogo}}': companyLogo,
      '{{logoContainerClass}}': logoContainerClass,
      '{{footerText}}': footerText,
      '{{footerTextDisplay}}': footerTextDisplay,
      '{{invoiceItems}}': invoiceItemsHTML,
      '{{previewWatermark}}': isPreview ? '<div class="preview-watermark">PREVIEW</div>' : ''
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

      // Convert line breaks to <br> tags for multi-line descriptions
      const descriptionHTML = (item.description || 'Item').replace(/\n/g, '<br>');
      const itemDescriptionHTML = item.itemDescription ? item.itemDescription.replace(/\n/g, '<br>') : '';

      return `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid ${theme.border};">${index + 1}</td>
          <td style="padding: 12px; border-bottom: 1px solid ${theme.border};">
            <div style="font-weight: 500; color: ${theme.foreground}; white-space: pre-line;">${descriptionHTML}</div>
            ${itemDescriptionHTML ? `<div style="color: ${theme.muted}; font-size: 12px; margin-top: 4px; white-space: pre-line;">${itemDescriptionHTML}</div>` : ''}
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

  /**
   * Generate a simplified receipt PDF for B2C transactions (GuestCode)
   */
  async generateReceiptPDF(receiptData, language = 'en') {
    console.log('🧾 PDFService: Starting receipt PDF generation');

    await this.initialize();
    const page = await this.browser.newPage();

    try {
      const html = await this.generateReceiptHTML(receiptData, language);
      await page.setContent(html, { waitUntil: 'networkidle0' });

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

      console.log('✅ PDFService: Receipt PDF generated, size:', pdf.length, 'bytes');
      return pdf;
    } finally {
      await page.close();
    }
  }

  async generateReceiptHTML(receipt, language = 'en') {
    if (receipt.documentBrand === 'sitemou') return require('./sitemouDocument').html(receipt,language);
    const translations = this.getTranslations(language);
    const t = translations.pdf || {};

    // Load receipt template
    const templatePath = path.join(__dirname, '../templates/receiptTemplate.html');
    let template = await fs.readFile(templatePath, 'utf8');

    // Get logo
    const logo = this.getDefaultLogo();

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

    // Payment method labels
    const paymentMethods = {
      '1': 'Cash',
      '2': 'Check',
      '3': 'Bank Transfer',
      '4': 'Credit Card',
      '5': 'Web Banking',
      '6': 'POS',
      '7': 'IRIS'
    };

    // Legal form mapping
    const legalFormMap = {
      'individual': '',
      'oe': 'O.E.',
      'ee': 'E.E.',
      'epe': 'E.P.E.',
      'ae': 'A.E.',
      'ike': 'I.K.E.',
      'other': ''
    };

    const legalForm = receipt.issuer?.legalForm ? legalFormMap[receipt.issuer.legalForm] || '' : '';
    const issuerNameWithLegalForm = legalForm ? `${receipt.issuer.name} ${legalForm}` : receipt.issuer.name;

    // Generate receipt items HTML
    const receiptItemsHTML = (receipt.invoiceDetails || []).map((item, index) => {
      const totalPrice = ((item.netValue || 0) + (item.vatAmount || 0)).toFixed(2);
      return `
        <tr>
          <td>${index + 1}</td>
          <td>${item.description || 'Item'}</td>
          <td>${item.quantity || 1}</td>
          <td>€${totalPrice}</td>
        </tr>`;
    }).join('');

    // AADE QR Code
    const aadeQRCode = receipt.aadeInfo?.qrUrl ?
      `<img src="${receipt.aadeInfo.qrUrl}" alt="AADE QR Code">` :
      '';

    const totals = receipt.totals || { totalNetValue: 0, totalVatAmount: 0, totalAmount: 0 };

    // Calculate VAT rate from totals
    let vatRate = '24%'; // Default
    if (totals.totalNetValue && totals.totalVatAmount) {
      const rate = (totals.totalVatAmount / totals.totalNetValue) * 100;
      vatRate = `${Math.round(rate)}%`;
    }

    // Format event date and time
    const eventDetails = receipt.eventDetails || {};
    let eventDateTime = '';
    if (eventDetails.date) {
      eventDateTime = formatDate(eventDetails.date);
      if (eventDetails.time) {
        eventDateTime += ` at ${eventDetails.time}`;
        if (eventDetails.endTime) {
          eventDateTime += ` - ${eventDetails.endTime}`;
        }
      }
    }

    // Replace placeholders
    const replacements = {
      '{{language}}': language,
      '{{receiptNumber}}': receipt.invoiceNumber || 'DRAFT',
      '{{issueDate}}': formatDate(receipt.issueDate),
      '{{issuer.name}}': issuerNameWithLegalForm || '',
      '{{issuer.afm}}': receipt.issuer?.taxInfo?.afm || '',
      '{{issuer.doy}}': receipt.issuer?.taxInfo?.doy?.name || '',
      '{{issuer.gemi}}': receipt.issuer?.taxInfo?.gemi || '',
      '{{issuer.address}}': receipt.issuer?.address ?
        `${receipt.issuer.address.street || ''} ${receipt.issuer.address.number || ''}, ${receipt.issuer.address.city || ''} ${receipt.issuer.address.postalCode || ''}`.trim() : '',
      '{{customer.name}}': receipt.counterpart?.name || '',
      '{{customer.email}}': receipt.counterpart?.email || '',
      '{{paymentMethod}}': paymentMethods[receipt.payment?.method] || 'Credit Card',
      '{{totalNetValue}}': totals.totalNetValue?.toFixed(2) || '0.00',
      '{{totalVatAmount}}': totals.totalVatAmount?.toFixed(2) || '0.00',
      '{{totalAmount}}': totals.totalAmount?.toFixed(2) || '0.00',
      '{{vatRate}}': vatRate,
      '{{receiptItems}}': receiptItemsHTML,
      '{{aadeQRCode}}': aadeQRCode,
      '{{aadeMark}}': receipt.aadeInfo?.mark || '',
      '{{aadeDisplay}}': receipt.aadeInfo?.mark ? 'flex' : 'none',
      '{{t_vatNumber}}': t.vatNumber || 'VAT',
      '{{t_taxOffice}}': t.taxOffice || 'Tax Office',
      '{{logo}}': logo || '',
      '{{logoDisplay}}': logo ? 'block' : 'none',
      '{{eventName}}': eventDetails.name || '',
      '{{eventDateTime}}': eventDateTime,
      '{{eventLocation}}': eventDetails.location || '',
      '{{eventDisplay}}': eventDetails.name ? 'block' : 'none',
      '{{eventLocationDisplay}}': eventDetails.location ? 'block' : 'none',
      '{{brandLogo}}': eventDetails.brandLogo || '',
      '{{brandLogoDisplay}}': eventDetails.brandLogo ? 'block' : 'none'
    };

    for (const [placeholder, value] of Object.entries(replacements)) {
      template = template.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
    }

    return template;
  }
}

module.exports = new PDFService();