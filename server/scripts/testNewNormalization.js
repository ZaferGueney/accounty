// Test the 6-digit normalization
function normalizeKADCode(code) {
  const cleaned = String(code).replace(/[\s.]/g, '');
  
  if (isNaN(cleaned) || cleaned.length < 4) {
    return null;
  }
  
  // For codes 6+ digits, use XX.XX.XX format
  if (cleaned.length >= 6) {
    return `${cleaned.substring(0, 2)}.${cleaned.substring(2, 4)}.${cleaned.substring(4, 6)}`;
  }
  // For shorter codes, pad with zeros and use XX.XX.XX format
  else if (cleaned.length >= 4) {
    const padded = cleaned.padEnd(6, '0');
    return `${padded.substring(0, 2)}.${padded.substring(2, 4)}.${padded.substring(4, 6)}`;
  }
  
  return null;
}

// Test cases
const testCases = [
  10000,      // 5 digits
  1110000,    // 7 digits
  46691101,   // 8 digits
  46691102,   // 8 digits
  46491101,   // 8 digits
];

console.log('=== 6-DIGIT NORMALIZATION TEST ===');
testCases.forEach(code => {
  const result = normalizeKADCode(code);
  console.log(`${code} -> ${result}`);
});

const uniqueCodes = new Set();
testCases.forEach(code => {
  const normalized = normalizeKADCode(code);
  if (normalized) {
    uniqueCodes.add(normalized);
  }
});

console.log(`\nUnique codes: ${uniqueCodes.size}`);
console.log('Codes:', Array.from(uniqueCodes));