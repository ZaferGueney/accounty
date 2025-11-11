// Test the updated normalization function
function normalizeKADCode(code) {
  const cleaned = String(code).replace(/[\s.]/g, '');
  
  if (isNaN(cleaned) || cleaned.length < 4) {
    return null;
  }
  
  if (cleaned.length >= 4) {
    return `${cleaned.substring(0, 2)}.${cleaned.substring(2, 4)}`;
  }
  
  return null;
}

// Test cases from your Excel
const testCases = [
  'Κωδικός Δραστηριότητας', // Header
  10000,
  20000,
  30000,
  1000000,
  1110000,
  1111000,
  1111100,
  46421114,
  46421115
];

console.log('=== NORMALIZATION TEST ===');
testCases.forEach(code => {
  const result = normalizeKADCode(code);
  console.log(`${code} -> ${result}`);
});

// Count unique normalized codes
const uniqueCodes = new Set();
testCases.forEach(code => {
  const normalized = normalizeKADCode(code);
  if (normalized) {
    uniqueCodes.add(normalized);
  }
});

console.log(`\nUnique codes: ${uniqueCodes.size}`);
console.log('Codes:', Array.from(uniqueCodes));