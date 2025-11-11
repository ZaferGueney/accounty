const XLSX = require('xlsx');
const path = require('path');

// Debug function to see what's in the Excel file
function debugExcelFile(filePath) {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  
  // Get raw data
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  
  console.log('=== EXCEL FILE DEBUG ===');
  console.log(`Total rows: ${data.length}`);
  console.log('\n=== First 10 rows ===');
  
  for (let i = 0; i < Math.min(10, data.length); i++) {
    const row = data[i];
    console.log(`Row ${i + 1}:`, row);
    
    if (row && row.length >= 2) {
      const code = row[0];
      const description = row[1];
      console.log(`  -> Code: "${code}" (type: ${typeof code})`);
      console.log(`  -> Description: "${description}"`);
      console.log(`  -> Normalized would be: "${normalizeKADCode(code)}"`);
    }
    console.log('---');
  }
  
  // Check some random rows in middle
  console.log('\n=== Sample rows from middle ===');
  const midStart = Math.floor(data.length / 2);
  for (let i = midStart; i < Math.min(midStart + 5, data.length); i++) {
    const row = data[i];
    if (row && row.length >= 2) {
      console.log(`Row ${i + 1}: Code="${row[0]}" -> Normalized="${normalizeKADCode(row[0])}"`);
    }
  }
  
  // Test the normalization function
  console.log('\n=== Testing normalization ===');
  const testCodes = ['10000', '111000', '1110000', 10000, 111000, 1110000];
  testCodes.forEach(code => {
    console.log(`"${code}" (${typeof code}) -> "${normalizeKADCode(code)}"`);
  });
}

// Copy the normalization function from the import script
function normalizeKADCode(code) {
  // Convert to string and remove any spaces or dots
  const cleaned = String(code).replace(/[\s.]/g, '');
  
  console.log(`  Normalizing: "${code}" -> cleaned: "${cleaned}" (length: ${cleaned.length})`);
  
  // Handle 6-digit codes (like 111000)
  if (cleaned.length === 6) {
    const result = `${cleaned.substring(0, 2)}.${cleaned.substring(2, 4)}`;
    console.log(`  6-digit: "${result}"`);
    return result;
  }
  // Handle 5-digit codes (like 10000)
  else if (cleaned.length === 5) {
    const result = `${cleaned.substring(0, 2)}.${cleaned.substring(2, 4)}`;
    console.log(`  5-digit: "${result}"`);
    return result;
  }
  // Handle 4-digit codes
  else if (cleaned.length === 4) {
    const result = `${cleaned.substring(0, 2)}.${cleaned.substring(2, 4)}`;
    console.log(`  4-digit: "${result}"`);
    return result;
  }
  
  console.log(`  Invalid length: ${cleaned.length}`);
  return null;
}

// Run the debug
const filePath = 'kad-codes.xlsx';
debugExcelFile(filePath);