const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '../server/.env') });

// Import KAD model
const KAD = require('../server/src/models/kadModel');

// Regular expressions for parsing
const KAD_LINE_REGEX = /^(\d{2}\.?\d{2}\.?\d{2})\s+(.+)$/; // Matches "XX.XX.XX Description" or "XXXXXX Description"
const KAD_CODE_REGEX = /^(\d{2})\.?(\d{2})\.?(\d{2})$/; // Extracts parts of KAD code

// Function to normalize KAD code to XX.XX format
function normalizeKADCode(code) {
  const match = code.match(/(\d{2})\.?(\d{2})/);
  if (match) {
    return `${match[1]}.${match[2]}`;
  }
  return null;
}

// Function to extract section from KAD code
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
  
  return 'C'; // Default
}

// Function to get category name
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

// Function to parse PDF text and extract KAD entries
function parseKADText(text) {
  const lines = text.split('\n');
  const kadMap = new Map();
  
  let currentKAD = null;
  let currentDescription = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (!line) continue;
    
    // Check if line starts with a KAD code pattern
    const match = line.match(KAD_LINE_REGEX);
    
    if (match) {
      // Save previous KAD if exists
      if (currentKAD && currentDescription) {
        const normalizedCode = normalizeKADCode(currentKAD);
        if (normalizedCode && !kadMap.has(normalizedCode)) {
          kadMap.set(normalizedCode, currentDescription.trim());
        }
      }
      
      // Start new KAD
      currentKAD = match[1];
      currentDescription = match[2];
    } else if (currentKAD) {
      // This might be a continuation of the previous description
      // Only add if it doesn't look like a header or page number
      if (!/^(Σελίδα|Page|\d+)/.test(line) && line.length > 3) {
        currentDescription += ' ' + line;
      }
    }
  }
  
  // Don't forget the last KAD
  if (currentKAD && currentDescription) {
    const normalizedCode = normalizeKADCode(currentKAD);
    if (normalizedCode && !kadMap.has(normalizedCode)) {
      kadMap.set(normalizedCode, currentDescription.trim());
    }
  }
  
  return kadMap;
}

// Main extraction function
async function extractKADsFromPDF(pdfPath) {
  try {
    console.log('Reading PDF file...');
    const dataBuffer = fs.readFileSync(pdfPath);
    
    console.log('Parsing PDF content...');
    const data = await pdf(dataBuffer);
    
    console.log(`Total pages: ${data.numpages}`);
    console.log(`Extracting KAD codes...`);
    
    // Parse the text to extract KAD codes
    const kadMap = parseKADText(data.text);
    
    console.log(`Found ${kadMap.size} unique KAD codes`);
    
    // Connect to MongoDB
    console.log('\nConnecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected successfully');
    
    // Prepare KAD documents for database
    const kadDocuments = [];
    for (const [code, description] of kadMap) {
      const section = getSection(code);
      kadDocuments.push({
        code,
        description,
        descriptionEN: '', // Will need translation later
        category: getCategory(section),
        section,
        isActive: true,
        vatRate: 24,
        isPopular: false,
        keywords: description.split(' ')
          .filter(word => word.length > 4)
          .slice(0, 10) // Limit keywords
      });
    }
    
    // Save to database
    console.log('\nSaving to database...');
    let savedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    for (const kadDoc of kadDocuments) {
      try {
        const existing = await KAD.findOne({ code: kadDoc.code });
        if (!existing) {
          await KAD.create(kadDoc);
          savedCount++;
          if (savedCount % 100 === 0) {
            console.log(`Progress: ${savedCount} KADs saved...`);
          }
        } else {
          skippedCount++;
        }
      } catch (error) {
        errorCount++;
        console.error(`Error saving KAD ${kadDoc.code}: ${error.message}`);
      }
    }
    
    // Save to JSON file for review
    const outputPath = path.join(__dirname, 'extracted_kads.json');
    fs.writeFileSync(outputPath, JSON.stringify(kadDocuments, null, 2));
    
    console.log('\n=== Import Summary ===');
    console.log(`Total KADs found: ${kadMap.size}`);
    console.log(`Successfully saved: ${savedCount}`);
    console.log(`Already existed: ${skippedCount}`);
    console.log(`Errors: ${errorCount}`);
    console.log(`\nExtracted data saved to: ${outputPath}`);
    
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

// Check if PDF path is provided
const pdfPath = process.argv[2];
if (!pdfPath) {
  console.log('Usage: node extractKADWithPdfParse.js <path-to-pdf>');
  console.log('Example: node extractKADWithPdfParse.js /mnt/c/Users/zafer/Downloads/currentRegistryJasperKad.pdf');
  process.exit(1);
}

// Check if file exists
if (!fs.existsSync(pdfPath)) {
  console.error(`Error: File not found: ${pdfPath}`);
  process.exit(1);
}

// Run the extraction
extractKADsFromPDF(pdfPath);