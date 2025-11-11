// Settings validation utilities for invoice creation requirements

/**
 * Check if user has completed all required settings for invoice creation
 * @param {Object} completionStatus - Settings completion status from Redux store
 * @returns {Object} - Validation result with canCreateInvoices boolean and missing requirements
 */
export const validateInvoiceCreationRequirements = (completionStatus) => {
  if (!completionStatus) {
    return {
      canCreateInvoices: false,
      missingRequirements: ['Settings not loaded'],
      nextSteps: ['Complete business setup']
    };
  }

  const requiredSteps = ['business', 'tax', 'address', 'contact', 'banking'];
  const missingSteps = requiredSteps.filter(step => !completionStatus.completedSteps[step]);
  
  const stepLabels = {
    business: 'Business Information',
    tax: 'Tax Registration Details',
    address: 'Business Address', 
    contact: 'Contact Information',
    banking: 'Banking Details'
  };

  const missingRequirements = missingSteps.map(step => stepLabels[step]);
  
  return {
    canCreateInvoices: completionStatus.canCreateInvoices && missingSteps.length === 0,
    missingRequirements,
    nextSteps: missingSteps.length > 0 
      ? [`Complete ${stepLabels[missingSteps[0]]}`]
      : [],
    nextStep: missingSteps.length > 0 ? missingSteps[0] : null
  };
};

/**
 * Get user-friendly error message for invoice creation attempt
 * @param {Object} completionStatus - Settings completion status from Redux store
 * @returns {string} - User-friendly error message
 */
export const getInvoiceCreationErrorMessage = (completionStatus) => {
  const validation = validateInvoiceCreationRequirements(completionStatus);
  
  if (validation.canCreateInvoices) {
    return null;
  }

  if (validation.missingRequirements.length === 1) {
    return `Please complete your ${validation.missingRequirements[0]} before creating invoices.`;
  }

  if (validation.missingRequirements.length === 2) {
    return `Please complete your ${validation.missingRequirements[0]} and ${validation.missingRequirements[1]} before creating invoices.`;
  }

  return `Please complete your business setup (${validation.missingRequirements.length} sections remaining) before creating invoices.`;
};

/**
 * Check if specific Greek tax requirements are met
 * @param {Object} settings - User settings object
 * @returns {Object} - Greek compliance validation result
 */
export const validateGreekTaxCompliance = (settings) => {
  if (!settings || !settings.tax) {
    return {
      isCompliant: false,
      issues: ['Tax information not provided'],
      warnings: []
    };
  }

  const issues = [];
  const warnings = [];

  // Check AFM (required)
  if (!settings.tax.afm || !/^\d{9}$/.test(settings.tax.afm)) {
    issues.push('Valid 9-digit AFM (Tax Registration Number) is required');
  }

  // Check DOY (required)
  if (!settings.tax.doy || !settings.tax.doy.code || !settings.tax.doy.name) {
    issues.push('Tax Office (DOY) selection is required');
  }

  // Check activity codes (required)
  if (!settings.tax.activityCodes || !Array.isArray(settings.tax.activityCodes) || settings.tax.activityCodes.length === 0) {
    issues.push('At least one activity code (KAD) is required');
  } else {
    // Validate each activity code format
    const invalidKADs = settings.tax.activityCodes.filter(kad => {
      if (!kad.code) return true;
      // Allow various KAD formats: XX.XX, XX.XXX, XX.XX.XX, XX.XX.XXX, XX.XX.XX.XX
      return !/^\d{2}\.\d{2,4}$/.test(kad.code) && 
             !/^\d{2}\.\d{2}\.\d{2,3}$/.test(kad.code) && 
             !/^\d{2}\.\d{2}\.\d{2}\.\d{2}$/.test(kad.code);
    });
    if (invalidKADs.length > 0) {
      issues.push('All activity codes must be in valid KAD format');
    }
  }

  // Check VAT registration
  if (settings.tax.vatRegistered) {
    if (!settings.tax.vatNumber || !/^EL\d{9}$/.test(settings.tax.vatNumber)) {
      issues.push('Valid VAT number in format ELXXXXXXXXX is required for VAT-registered businesses');
    }
  } else {
    warnings.push('Business is not VAT registered - ensure this is correct for your business type');
  }

  // Check business address (required for Greek tax compliance)
  if (!settings.address || !settings.address.street || !settings.address.city || !settings.address.postalCode) {
    issues.push('Complete business address is required for Greek tax compliance');
  }

  return {
    isCompliant: issues.length === 0,
    issues,
    warnings
  };
};

/**
 * Get Greek legal form description
 * @param {string} legalForm - Legal form code
 * @returns {string} - Full description in English and Greek
 */
export const getLegalFormDescription = (legalForm) => {
  const descriptions = {
    individual: 'Individual Business (Ατομική Επιχείρηση)',
    oe: 'General Partnership (Ο.Ε. - Ομόρρυθμη Εταιρία)',
    ee: 'Limited Partnership (Ε.Ε. - Ετερόρρυθμη Εταιρία)',
    epe: 'Limited Liability Company (Ε.Π.Ε. - Εταιρία Περιορισμένης Ευθύνης)',
    ae: 'Corporation (Α.Ε. - Ανώνυμη Εταιρία)',
    ike: 'Private Company (Ι.Κ.Ε. - Ιδιωτική Κεφαλαιουχική Εταιρία)',
    other: 'Other'
  };

  return descriptions[legalForm] || 'Unknown';
};

/**
 * Format Greek phone numbers for display
 * @param {string} phone - Phone number
 * @returns {string} - Formatted phone number
 */
export const formatGreekPhone = (phone) => {
  if (!phone) return '';
  
  // Remove all non-digits
  const digits = phone.replace(/\D/g, '');
  
  // Handle different formats
  if (digits.length === 10) {
    // Mobile: 69X XXX XXXX or Landline: 2XX XXX XXXX
    if (digits.startsWith('69')) {
      return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
    } else if (digits.startsWith('2')) {
      return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
    }
  }
  
  return phone;
};

/**
 * Validate and format Greek IBAN
 * @param {string} iban - IBAN string
 * @returns {Object} - Validation result and formatted IBAN
 */
export const validateGreekIBAN = (iban) => {
  if (!iban) {
    return { isValid: false, formatted: '', error: 'IBAN is required' };
  }

  // Remove spaces and convert to uppercase
  const cleanIban = iban.replace(/\s/g, '').toUpperCase();
  
  // Check Greek IBAN format
  if (!/^GR\d{2}\d{4}\d{4}\d{4}\d{4}\d{4}$/.test(cleanIban)) {
    return { 
      isValid: false, 
      formatted: cleanIban, 
      error: 'Invalid Greek IBAN format. Should be GR + 25 digits' 
    };
  }

  // Format with spaces for readability
  const formatted = cleanIban.replace(/(.{4})/g, '$1 ').trim();

  return {
    isValid: true,
    formatted,
    error: null
  };
};