const XLSX = require('xlsx');

// Debug function to understand why we only get ~700 unique codes
function debugUniqueness(filePath) {
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
  
  console.log(`=== UNIQUENESS DEBUG ===`);
  console.log(`Total rows: ${data.length}`);
  console.log(`Start processing from row: ${startRow + 1}`);
  
  const codeFrequency = new Map();
  const originalCodes = [];
  const normalizedCodes = new Set();
  
  // Process all rows
  for (let i = startRow; i < data.length; i++) {
    const row = data[i];
    if (row && row.length >= 2) {
      const originalCode = String(row[0]).replace(/[\s.]/g, '');
      const description = row[1];
      
      if (!isNaN(originalCode) && originalCode.length >= 4) {
        const normalizedCode = `${originalCode.substring(0, 2)}.${originalCode.substring(2, 4)}`;
        
        originalCodes.push(originalCode);
        normalizedCodes.add(normalizedCode);
        
        // Count frequency of normalized codes
        codeFrequency.set(normalizedCode, (codeFrequency.get(normalizedCode) || 0) + 1);
      }
    }
  }
  
  console.log(`\nValid original codes found: ${originalCodes.length}`);
  console.log(`Unique normalized codes: ${normalizedCodes.size}`);
  
  // Show most common normalized codes
  console.log(`\n=== TOP 20 MOST FREQUENT NORMALIZED CODES ===`);
  const sortedFrequency = Array.from(codeFrequency.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);
  
  sortedFrequency.forEach(([code, count]) => {
    console.log(`${code}: ${count} times`);
  });
  
  // Show some examples of codes that map to the same normalized code
  console.log(`\n=== EXAMPLES OF COLLISION ===`);
  const exampleCode = sortedFrequency[0][0]; // Take the most frequent one
  const examplesForCode = [];
  
  for (let i = startRow; i < Math.min(startRow + 1000, data.length); i++) {
    const row = data[i];
    if (row && row.length >= 2) {
      const originalCode = String(row[0]).replace(/[\s.]/g, '');
      if (!isNaN(originalCode) && originalCode.length >= 4) {
        const normalizedCode = `${originalCode.substring(0, 2)}.${originalCode.substring(2, 4)}`;
        
        if (normalizedCode === exampleCode) {
          examplesForCode.push({
            original: originalCode,
            description: row[1]
          });
          
          if (examplesForCode.length >= 5) break;
        }
      }
    }
  }
  
  console.log(`Examples that all normalize to "${exampleCode}":`);
  examplesForCode.forEach(item => {
    console.log(`  ${item.original} -> ${item.description.substring(0, 60)}...`);
  });
  
  // Show distribution of code lengths
  console.log(`\n=== ORIGINAL CODE LENGTH DISTRIBUTION ===`);
  const lengthDistribution = {};
  originalCodes.forEach(code => {
    lengthDistribution[code.length] = (lengthDistribution[code.length] || 0) + 1;
  });
  
  Object.keys(lengthDistribution).sort().forEach(length => {
    console.log(`${length} digits: ${lengthDistribution[length]} codes`);
  });
}

// Run the debug
debugUniqueness('kad-codes.xlsx');