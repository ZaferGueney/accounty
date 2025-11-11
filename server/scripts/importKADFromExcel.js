const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const XLSX = require('xlsx');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Import KAD model
const KAD = require('../src/models/kadModel');

// Function to normalize KAD code to preserve full detail
function normalizeKADCode(code) {
  // Convert to string and remove any spaces or dots
  const cleaned = String(code).replace(/[\s.]/g, '');
  
  // Skip header rows or invalid codes
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

// Function to get section from code
function getSection(code) {
  const firstTwo = parseInt(code.substring(0, 2));
  
  if (firstTwo >= 1 && firstTwo <= 3) return 'A';
  if (firstTwo >= 5 && firstTwo <= 9) return 'B';
  if (firstTwo >= 10 && firstTwo <= 33) return 'C';
  if (firstTwo >= 35 && firstTwo <= 35) return 'D';
  if (firstTwo >= 36 && firstTwo <= 39) return 'E';
  if (firstTwo >= 41 && firstTwo <= 43) return 'F';
  if (firstTwo >= 45 && firstTwo <= 47) return 'G';
  if (firstTwo >= 49 && firstTwo <= 53) return 'H';
  if (firstTwo >= 55 && firstTwo <= 56) return 'I';
  if (firstTwo >= 58 && firstTwo <= 63) return 'J';
  if (firstTwo >= 64 && firstTwo <= 66) return 'K';
  if (firstTwo >= 68 && firstTwo <= 68) return 'L';
  if (firstTwo >= 69 && firstTwo <= 75) return 'M';
  if (firstTwo >= 77 && firstTwo <= 82) return 'N';
  if (firstTwo >= 84 && firstTwo <= 84) return 'O';
  if (firstTwo >= 85 && firstTwo <= 85) return 'P';
  if (firstTwo >= 86 && firstTwo <= 88) return 'Q';
  if (firstTwo >= 90 && firstTwo <= 93) return 'R';
  if (firstTwo >= 94 && firstTwo <= 96) return 'S';
  if (firstTwo >= 97 && firstTwo <= 98) return 'T';
  if (firstTwo >= 99 && firstTwo <= 99) return 'U';
  
  return 'C';
}

// Function to get category
function getCategory(section) {
  const categories = {
    'A': 'Γεωργία, Δασοκομία και Αλιεία',
    'B': 'Ορυχεία και Λατομεία',
    'C': 'Μεταποίηση',
    'D': 'Παροχή Ηλεκτρικού Ρεύματος, Φυσικού Αερίου',
    'E': 'Παροχή Νερού, Επεξεργασία Λυμάτων',
    'F': 'Κατασκευές',
    'G': 'Χονδρικό και Λιανικό Εμπόριο',
    'H': 'Μεταφορά και Αποθήκευση',
    'I': 'Δραστηριότητες Υπηρεσιών Παροχής Καταλύματος και Υπηρεσιών Εστίασης',
    'J': 'Ενημέρωση και Επικοινωνία',
    'K': 'Χρηματοπιστωτικές και Ασφαλιστικές Δραστηριότητες',
    'L': 'Διαχείριση Ακίνητης Περιουσίας',
    'M': 'Επαγγελματικές, Επιστημονικές και Τεχνικές Δραστηριότητες',
    'N': 'Διοικητικές και Υποστηρικτικές Δραστηριότητες',
    'O': 'Δημόσια Διοίκηση και Άμυνα',
    'P': 'Εκπαίδευση',
    'Q': 'Δραστηριότητες Ανθρώπινης Υγείας και Κοινωνικής Μέριμνας',
    'R': 'Τέχνες, Διασκέδαση και Ψυχαγωγία',
    'S': 'Άλλες Δραστηριότητες Παροχής Υπηρεσιών',
    'T': 'Δραστηριότητες Νοικοκυριών',
    'U': 'Δραστηριότητες Ετερόδικων Οργανισμών'
  };
  
  return categories[section] || 'Άλλες Δραστηριότητες';
}

// Import from CSV
async function importFromCSV(filePath) {
  const results = [];
  
  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => {
        // Adjust these field names based on your CSV columns
        const code = data['Code'] || data['code'] || data['ΚΑΔ'] || data['KAD'];
        const description = data['Description'] || data['description'] || data['Περιγραφή'] || data['ΠΕΡΙΓΡΑΦΗ'];
        const descriptionEN = data['DescriptionEN'] || data['English'] || '';
        
        if (code && description) {
          results.push({ code, description, descriptionEN });
        }
      })
      .on('end', () => resolve(results))
      .on('error', reject);
  });
}

// Import from Excel
async function importFromExcel(filePath) {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  
  // Get data with header option to handle headerless files
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  
  const results = [];
  
  // Skip header rows - look for the first numeric row
  let startRow = 0;
  for (let i = 0; i < Math.min(5, data.length); i++) {
    const row = data[i];
    if (row && row.length >= 2 && !isNaN(row[0])) {
      startRow = i;
      break;
    }
  }
  
  // Process data rows
  for (let i = startRow; i < data.length; i++) {
    const row = data[i];
    if (row && row.length >= 2) {
      const code = row[0]; // Column A
      const description = row[1]; // Column B
      const descriptionEN = row[2] || ''; // Column C if exists
      
      if (code && description) {
        results.push({
          code: String(code).trim(),
          description: String(description).trim(),
          descriptionEN: descriptionEN ? String(descriptionEN).trim() : ''
        });
      }
    }
  }
  
  return results;
}

// Main import function
async function importKADs(filePath) {
  try {
    console.log(`Importing from: ${filePath}`);
    
    // Determine file type and import data
    let rawData = [];
    const ext = path.extname(filePath).toLowerCase();
    
    if (ext === '.csv') {
      rawData = await importFromCSV(filePath);
    } else if (ext === '.xlsx' || ext === '.xls') {
      rawData = await importFromExcel(filePath);
    } else {
      throw new Error('Unsupported file format. Use .csv, .xlsx, or .xls');
    }
    
    console.log(`Found ${rawData.length} rows in file`);
    
    // Process and normalize data
    const kadMap = new Map();
    
    for (const row of rawData) {
      const normalizedCode = normalizeKADCode(row.code);
      if (normalizedCode && !kadMap.has(normalizedCode)) {
        kadMap.set(normalizedCode, {
          originalCode: row.code.trim(),
          description: row.description.trim(),
          descriptionEN: row.descriptionEN ? row.descriptionEN.trim() : ''
        });
      }
    }
    
    console.log(`Unique KAD codes after normalization: ${kadMap.size}`);
    
    // Connect to MongoDB
    console.log('\nConnecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected successfully');
    
    // Import to database
    let savedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    for (const [code, data] of kadMap) {
      try {
        const section = getSection(code);
        const kadDoc = {
          code,
          originalCode: data.originalCode,
          description: data.description,
          descriptionEN: data.descriptionEN,
          category: getCategory(section),
          section,
          isActive: true,
          vatRate: 24,
          isPopular: false,
          keywords: data.description.split(' ')
            .filter(word => word.length > 4)
            .slice(0, 10)
        };
        
        // Check if exists
        const existing = await KAD.findOne({ code });
        
        if (!existing) {
          await KAD.create(kadDoc);
          savedCount++;
        } else if (data.descriptionEN && !existing.descriptionEN) {
          // Update with English description if we have it
          existing.descriptionEN = data.descriptionEN;
          await existing.save();
          updatedCount++;
        } else {
          skippedCount++;
        }
        
        if ((savedCount + updatedCount) % 100 === 0) {
          console.log(`Progress: ${savedCount + updatedCount} KADs processed...`);
        }
        
      } catch (error) {
        errorCount++;
        console.error(`Error processing KAD ${code}: ${error.message}`);
      }
    }
    
    // Save processed data for review
    const outputPath = path.join(__dirname, 'imported_kads.json');
    const exportData = Array.from(kadMap.entries()).map(([code, data]) => ({
      code,
      originalCode: data.originalCode,
      description: data.description,
      descriptionEN: data.descriptionEN,
      section: getSection(code),
      category: getCategory(getSection(code))
    }));
    fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2));
    
    console.log('\n=== Import Summary ===');
    console.log(`Total unique KADs: ${kadMap.size}`);
    console.log(`New KADs saved: ${savedCount}`);
    console.log(`KADs updated: ${updatedCount}`);
    console.log(`Already existed: ${skippedCount}`);
    console.log(`Errors: ${errorCount}`);
    console.log(`\nProcessed data saved to: ${outputPath}`);
    
    await mongoose.connection.close();
    console.log('\nDatabase connection closed.');
    
  } catch (error) {
    console.error('Fatal error:', error);
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
    process.exit(1);
  }
}

// Check arguments
const filePath = process.argv[2];
if (!filePath) {
  console.log('Usage: node importKADFromExcel.js <path-to-file>');
  console.log('Supported formats: .csv, .xlsx, .xls');
  console.log('\nExample CSV format:');
  console.log('Code,Description');
  console.log('01.11,Καλλιέργεια δημητριακών (εκτός από ρύζι)...');
  console.log('\nExample Excel format:');
  console.log('| Code | Description | DescriptionEN (optional) |');
  process.exit(1);
}

// Check if file exists
if (!fs.existsSync(filePath)) {
  console.error(`Error: File not found: ${filePath}`);
  process.exit(1);
}

// Run import
importKADs(filePath);