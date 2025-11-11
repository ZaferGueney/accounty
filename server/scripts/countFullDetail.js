const XLSX = require('xlsx');

function normalizeKADCode(code) {
  const cleaned = String(code).replace(/[\s.]/g, '');
  
  if (isNaN(cleaned) || cleaned.length < 4) {
    return null;
  }
  
  // For 8-digit codes, use XX.XX.XX.XX format
  if (cleaned.length === 8) {
    return `${cleaned.substring(0, 2)}.${cleaned.substring(2, 4)}.${cleaned.substring(4, 6)}.${cleaned.substring(6, 8)}`;
  }
  // For 7-digit codes, use XX.XX.XXX format
  else if (cleaned.length === 7) {
    return `${cleaned.substring(0, 2)}.${cleaned.substring(2, 4)}.${cleaned.substring(4, 7)}`;
  }
  // For 6-digit codes, use XX.XX.XX format
  else if (cleaned.length === 6) {
    return `${cleaned.substring(0, 2)}.${cleaned.substring(2, 4)}.${cleaned.substring(4, 6)}`;
  }
  // For 5-digit codes, use XX.XXX format
  else if (cleaned.length === 5) {
    return `${cleaned.substring(0, 2)}.${cleaned.substring(2, 5)}`;
  }
  // For 4-digit codes, use XX.XX format
  else if (cleaned.length === 4) {
    return `${cleaned.substring(0, 2)}.${cleaned.substring(2, 4)}`;
  }
  
  return null;
}

// Count unique codes with full detail
function countFullDetail(filePath) {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  
  let startRow = 0;
  for (let i = 0; i < Math.min(5, data.length); i++) {
    const row = data[i];
    if (row && row.length >= 2 && !isNaN(row[0])) {
      startRow = i;
      break;
    }
  }
  
  const uniqueCodes = new Set();
  const lengthStats = {};
  
  for (let i = startRow; i < data.length; i++) {
    const row = data[i];
    if (row && row.length >= 2) {
      const originalCode = String(row[0]).replace(/[\s.]/g, '');
      const normalizedCode = normalizeKADCode(row[0]);
      
      if (normalizedCode) {
        uniqueCodes.add(normalizedCode);
        lengthStats[originalCode.length] = (lengthStats[originalCode.length] || 0) + 1;
      }
    }
  }
  
  console.log(`Total rows processed: ${data.length - startRow}`);
  console.log(`Unique codes with full detail: ${uniqueCodes.size}`);
  
  console.log('\nCode length distribution:');
  Object.keys(lengthStats).sort().forEach(length => {
    console.log(`  ${length} digits: ${lengthStats[length]} codes`);
  });
  
  // Show examples for each length
  console.log('\nExamples by length:');
  const examples = {};
  
  for (let i = startRow; i < Math.min(startRow + 100, data.length); i++) {
    const row = data[i];
    if (row && row.length >= 2) {
      const originalCode = String(row[0]).replace(/[\s.]/g, '');
      const normalizedCode = normalizeKADCode(row[0]);
      
      if (normalizedCode && !examples[originalCode.length]) {
        examples[originalCode.length] = { original: originalCode, normalized: normalizedCode };
      }
    }
  }
  
  Object.keys(examples).sort().forEach(length => {
    const ex = examples[length];
    console.log(`  ${length} digits: ${ex.original} -> ${ex.normalized}`);
  });
}

countFullDetail('kad-codes.xlsx');