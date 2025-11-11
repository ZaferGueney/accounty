const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Import KAD model
const KAD = require('../src/models/kadModel');

// Function to normalize KAD code to XX.XX format
function normalizeKADCode(code) {
  // Convert to string and remove any spaces or dots
  const cleaned = String(code).replace(/[\s.]/g, '');
  
  // Handle 6-digit codes (like 111000)
  if (cleaned.length === 6) {
    return `${cleaned.substring(0, 2)}.${cleaned.substring(2, 4)}`;
  }
  // Handle 5-digit codes (like 10000)
  else if (cleaned.length === 5) {
    return `${cleaned.substring(0, 2)}.${cleaned.substring(2, 4)}`;
  }
  // Handle 4-digit codes
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

// Sample KAD data - you can replace this with your Excel data
const sampleKADs = [
  { code: "10000", description: "ΕΛΛΗΝΗ ΔΡΑΣΤΗΡΙΟΤΗΤΑΣ, ΛΟΓΩ ΜΗ ΔΡΑΣΤΗΡΙΟΠΟΙΗΣΗΣ ΜΕΧΡΙ ΣΗΜΕΡΑ" },
  { code: "20000", description: "ΕΛΛΗΝΗ ΔΡΑΣΤΗΡΙΟΤΗΤΑΣ, ΛΟΓΩ ΑΔΡΑΝΟΠΟΙΗΣΗΣ" },
  { code: "30000", description: "ΕΛΛΗΝΗ ΔΡΑΣΤΗΡΙΟΤΗΤΑΣ, ΛΟΓΩ ΔΡΑΣΤΗΡΙΟΠΟΙΗΣΗΣ ΜΟΝΟ ΕΚΤΟΣ ΕΛΛΑΔΑΣ" },
  { code: "1000000", description: "ΑΓΡΟΤΗΣ ΕΙΔΙΚΟΥ ΚΑΘΕΣΤΩΤΟΣ" },
  { code: "1110000", description: "ΚΑΛΛΙΕΡΓΕΙΑ ΔΗΜΗΤΡΙΑΚΩΝ (ΕΚΤΟΣ ΡΥΖΙΟΥ), ΟΣΠΡΙΩΝ ΚΑΙ ΕΛΑΙΟΥΧΩΝ ΣΠΟΡΩΝ" },
  { code: "1111000", description: "ΚΑΛΛΙΕΡΓΕΙΑ ΣΙΤΑΡΙΟΥ" },
  // ... add more sample data or read from a file
];

// Main import function
async function importKADs() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected successfully');
    
    let savedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    console.log(`Processing ${sampleKADs.length} KADs...`);
    
    for (const item of sampleKADs) {
      try {
        const normalizedCode = normalizeKADCode(item.code);
        if (!normalizedCode) {
          console.log(`Skipping invalid code: ${item.code}`);
          continue;
        }
        
        // Check if exists
        const existing = await KAD.findOne({ code: normalizedCode });
        if (existing) {
          skippedCount++;
          continue;
        }
        
        const section = getSection(normalizedCode);
        const kadDoc = {
          code: normalizedCode,
          description: item.description,
          descriptionEN: '',
          category: getCategory(section),
          section,
          isActive: true,
          vatRate: 24,
          isPopular: false,
          keywords: item.description.split(' ')
            .filter(word => word.length > 4)
            .slice(0, 10)
        };
        
        await KAD.create(kadDoc);
        savedCount++;
        
        if (savedCount % 100 === 0) {
          console.log(`Progress: ${savedCount} KADs saved...`);
        }
        
      } catch (error) {
        errorCount++;
        console.error(`Error saving KAD ${item.code}: ${error.message}`);
      }
    }
    
    console.log('\n=== Import Summary ===');
    console.log(`Total KADs processed: ${sampleKADs.length}`);
    console.log(`New KADs saved: ${savedCount}`);
    console.log(`Already existed: ${skippedCount}`);
    console.log(`Errors: ${errorCount}`);
    
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

// Run import
importKADs();