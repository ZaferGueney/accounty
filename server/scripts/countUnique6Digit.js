const XLSX = require('xlsx');

function normalizeKADCode(code) {
  const cleaned = String(code).replace(/[\s.]/g, '');
  
  if (isNaN(cleaned) || cleaned.length < 4) {
    return null;
  }
  
  if (cleaned.length >= 6) {
    return `${cleaned.substring(0, 2)}.${cleaned.substring(2, 4)}.${cleaned.substring(4, 6)}`;
  } else if (cleaned.length >= 4) {
    const padded = cleaned.padEnd(6, '0');
    return `${padded.substring(0, 2)}.${padded.substring(2, 4)}.${padded.substring(4, 6)}`;
  }
  
  return null;
}

// Count unique 6-digit codes
function countUnique6Digit(filePath) {
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
  
  for (let i = startRow; i < data.length; i++) {
    const row = data[i];
    if (row && row.length >= 2) {
      const normalizedCode = normalizeKADCode(row[0]);
      if (normalizedCode) {
        uniqueCodes.add(normalizedCode);
      }
    }
  }
  
  console.log(`Total rows processed: ${data.length - startRow}`);
  console.log(`Unique 6-digit codes: ${uniqueCodes.size}`);
  
  // Show first 20 codes as examples
  console.log('\nFirst 20 unique codes:');
  Array.from(uniqueCodes).slice(0, 20).forEach(code => {
    console.log(`  ${code}`);
  });
}

countUnique6Digit('kad-codes.xlsx');