const XLSX = require('xlsx');

function normalizeKADCode(code) {
  const cleaned = String(code).replace(/[\s.]/g, '');
  
  if (isNaN(cleaned) || cleaned.length < 4) {
    return null;
  }
  
  if (cleaned.length === 8) {
    return `${cleaned.substring(0, 2)}.${cleaned.substring(2, 4)}.${cleaned.substring(4, 6)}.${cleaned.substring(6, 8)}`;
  } else if (cleaned.length === 7) {
    return `${cleaned.substring(0, 2)}.${cleaned.substring(2, 4)}.${cleaned.substring(4, 7)}`;
  } else if (cleaned.length === 6) {
    return `${cleaned.substring(0, 2)}.${cleaned.substring(2, 4)}.${cleaned.substring(4, 6)}`;
  } else if (cleaned.length === 5) {
    return `${cleaned.substring(0, 2)}.${cleaned.substring(2, 5)}`;
  } else if (cleaned.length === 4) {
    return `${cleaned.substring(0, 2)}.${cleaned.substring(2, 4)}`;
  }
  
  return null;
}

function debugMissingRows(filePath) {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  
  // Find start row
  let startRow = 0;
  for (let i = 0; i < Math.min(5, data.length); i++) {
    const row = data[i];
    if (row && row.length >= 2 && !isNaN(row[0])) {
      startRow = i;
      break;
    }
  }
  
  console.log(`=== DEBUGGING MISSING ROWS ===`);
  console.log(`Total rows: ${data.length}`);
  console.log(`Start processing from row: ${startRow + 1}`);
  console.log(`Rows to process: ${data.length - startRow}`);
  
  let validRows = 0;
  let invalidRows = 0;
  let skippedRows = [];
  let duplicateChecks = new Map(); // Check for actual duplicates
  let uniqueCodes = new Set();
  
  for (let i = startRow; i < data.length; i++) {
    const row = data[i];
    const rowNumber = i + 1;
    
    if (!row || row.length < 2) {
      invalidRows++;
      skippedRows.push({
        rowNumber,
        reason: 'Row has less than 2 columns',
        data: row
      });
      continue;
    }
    
    const originalCode = String(row[0]).replace(/[\s.]/g, '');
    const description = row[1];
    const normalizedCode = normalizeKADCode(row[0]);
    
    if (!normalizedCode) {
      invalidRows++;
      skippedRows.push({
        rowNumber,
        reason: 'Code normalization failed',
        originalCode: row[0],
        data: row
      });
      continue;
    }
    
    // Check for exact duplicates
    const key = `${originalCode}|${description}`;
    if (duplicateChecks.has(key)) {
      invalidRows++;
      skippedRows.push({
        rowNumber,
        reason: 'Exact duplicate (same code and description)',
        originalCode: row[0],
        duplicateOf: duplicateChecks.get(key),
        data: row
      });
      continue;
    }
    
    duplicateChecks.set(key, rowNumber);
    uniqueCodes.add(normalizedCode);
    validRows++;
  }
  
  console.log(`\nValid rows processed: ${validRows}`);
  console.log(`Invalid/skipped rows: ${invalidRows}`);
  console.log(`Unique normalized codes: ${uniqueCodes.size}`);
  
  if (skippedRows.length > 0) {
    console.log(`\n=== SKIPPED ROWS DETAILS ===`);
    skippedRows.forEach((skip, index) => {
      console.log(`\n${index + 1}. Row ${skip.rowNumber}:`);
      console.log(`   Reason: ${skip.reason}`);
      if (skip.originalCode) {
        console.log(`   Original code: "${skip.originalCode}"`);
      }
      if (skip.duplicateOf) {
        console.log(`   Duplicate of row: ${skip.duplicateOf}`);
      }
      console.log(`   Data: ${JSON.stringify(skip.data)}`);
    });
  }
  
  // Check if any normalized codes appear multiple times
  console.log(`\n=== CHECKING FOR NORMALIZED CODE DUPLICATES ===`);
  const normalizedFrequency = new Map();
  
  for (let i = startRow; i < data.length; i++) {
    const row = data[i];
    if (row && row.length >= 2) {
      const normalizedCode = normalizeKADCode(row[0]);
      if (normalizedCode) {
        normalizedFrequency.set(normalizedCode, (normalizedFrequency.get(normalizedCode) || 0) + 1);
      }
    }
  }
  
  const duplicateNormalized = Array.from(normalizedFrequency.entries())
    .filter(([code, count]) => count > 1)
    .sort((a, b) => b[1] - a[1]);
  
  if (duplicateNormalized.length > 0) {
    console.log(`Found ${duplicateNormalized.length} normalized codes that appear multiple times:`);
    duplicateNormalized.slice(0, 10).forEach(([code, count]) => {
      console.log(`  ${code}: appears ${count} times`);
      
      // Find examples
      let found = 0;
      for (let i = startRow; i < data.length && found < 3; i++) {
        const row = data[i];
        if (row && row.length >= 2) {
          const normalizedCode = normalizeKADCode(row[0]);
          if (normalizedCode === code) {
            console.log(`    Row ${i + 1}: ${row[0]} -> "${row[1].substring(0, 50)}..."`);
            found++;
          }
        }
      }
    });
  } else {
    console.log(`No normalized code duplicates found - all ${uniqueCodes.size} codes are unique!`);
  }
}

debugMissingRows('kad-codes.xlsx');