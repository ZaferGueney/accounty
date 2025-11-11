const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const KAD = require('../src/models/kadModel');

// Paste your Excel data here as an array
// Format: [code, description]
const kadData = [
  ["10000", "ΕΛΛΗΝΗ ΔΡΑΣΤΗΡΙΟΤΗΤΑΣ, ΛΟΓΩ ΜΗ ΔΡΑΣΤΗΡΙΟΠΟΙΗΣΗΣ ΜΕΧΡΙ ΣΗΜΕΡΑ"],
  ["20000", "ΕΛΛΗΝΗ ΔΡΑΣΤΗΡΙΟΤΗΤΑΣ, ΛΟΓΩ ΑΔΡΑΝΟΠΟΙΗΣΗΣ"],
  ["30000", "ΕΛΛΗΝΗ ΔΡΑΣΤΗΡΙΟΤΗΤΑΣ, ΛΟΓΩ ΔΡΑΣΤΗΡΙΟΠΟΙΗΣΗΣ ΜΟΝΟ ΕΚΤΟΣ ΕΛΛΑΔΑΣ"],
  ["1000000", "ΑΓΡΟΤΗΣ ΕΙΔΙΚΟΥ ΚΑΘΕΣΤΩΤΟΣ"],
  ["1110000", "ΚΑΛΛΙΕΡΓΕΙΑ ΔΗΜΗΤΡΙΑΚΩΝ (ΕΚΤΟΣ ΡΥΖΙΟΥ), ΟΣΠΡΙΩΝ ΚΑΙ ΕΛΑΙΟΥΧΩΝ ΣΠΟΡΩΝ"],
  ["1111000", "ΚΑΛΛΙΕΡΓΕΙΑ ΣΙΤΑΡΙΟΥ"],
  ["1111100", "ΚΑΛΛΙΕΡΓΕΙΑ ΣΚΛΗΡΟΥ ΣΙΤΑΡΙΟΥ"],
  ["1111200", "ΚΑΛΛΙΕΡΓΕΙΑ ΣΙΤΑΡΙΟΥ, ΕΚΤΟΣ ΑΠΟ ΤΟ ΣΚΛΗΡΟ ΣΙΤΑΡΙ"],
  ["1111201", "ΚΑΛΛΙΕΡΓΕΙΑ ΜΑΛΑΚΟΥ ΣΙΤΑΡΙΟΥ"],
  ["1112000", "ΚΑΛΛΙΕΡΓΕΙΑ ΑΡΑΒΟΣΙΤΟΥ"],
  ["1112001", "ΚΑΛΛΙΕΡΓΕΙΑ ΧΛΩΡΟΥ ΑΡΑΒΟΣΙΤΟΥ"],
  ["1113000", "ΚΑΛΛΙΕΡΓΕΙΑ ΚΡΙΘΑΡΙΟΥ, ΣΙΚΑΛΗΣ ΚΑΙ ΒΡΩΜΗΣ"],
  ["1113100", "ΚΑΛΛΙΕΡΓΕΙΑ ΚΡΙΘΑΡΙΟΥ"],
  ["1113200", "ΚΑΛΛΙΕΡΓΕΙΑ ΣΙΚΑΛΗΣ"],
  ["1113300", "ΚΑΛΛΙΕΡΓΕΙΑ ΒΡΩΜΗΣ"],
  ["1114000", "ΚΑΛΛΙΕΡΓΕΙΑ ΣΟΡΓΟΥ, ΚΕΧΡΙΟΥ ΚΑΙ ΑΛΛΩΝ ΔΗΜΗΤΡΙΑΚΩΝ"],
  ["1114100", "ΚΑΛΛΙΕΡΓΕΙΑ ΣΟΡΓΟΥ"],
  ["1114200", "ΚΑΛΛΙΕΡΓΕΙΑ ΚΕΧΡΙΟΥ"],
  ["1114300", "ΚΑΛΛΙΕΡΓΕΙΑ ΑΛΛΩΝ ΔΗΜΗΤΡΙΑΚΩΝ"],
  ["1115000", "ΚΑΛΛΙΕΡΓΕΙΑ ΑΧΥΡΟΥ ΚΑΙ ΦΛΟΙΩΝ ΔΗΜΗΤΡΙΑΚΩΝ"],
  ["1116000", "ΚΑΛΛΙΕΡΓΕΙΑ ΟΣΠΡΙΩΝ, ΠΟΥ ΔΙΑΔΕΔΟΝΤΑΙ ΝΩΠΑ"],
  ["1116100", "ΚΑΛΛΙΕΡΓΕΙΑ ΦΑΣΟΛΙΩΝ, ΠΟΥ ΔΙΑΔΕΔΟΝΤΑΙ ΝΩΠΑ"],
  ["1116101", "ΚΑΛΛΙΕΡΓΕΙΑ ΦΑΣΟΛΙΩΝ ΜΕΣΟΣΠΕΡΜΩΝ"],
  ["1116200", "ΚΑΛΛΙΕΡΓΕΙΑ ΜΠΙΖΕΛΙΩΝ, ΠΟΥ ΔΙΑΔΕΔΟΝΤΑΙ ΝΩΠΑ"],
  ["1116900", "ΚΑΛΛΙΕΡΓΕΙΑ ΑΛΛΩΝ ΟΣΠΡΙΩΝ, ΠΟΥ ΔΙΑΔΕΔΟΝΤΑΙ ΑΠΟΞΗΡΑΜΕΝΑ"],
  ["1117000", "ΚΑΛΛΙΕΡΓΕΙΑ ΟΣΠΡΙΩΝ, ΠΟΥ ΔΙΑΔΕΔΟΝΤΑΙ ΑΠΟΞΗΡΑΜΕΝΑ"],
  ["1117100", "ΚΑΛΛΙΕΡΓΕΙΑ ΦΑΣΟΛΙΩΝ, ΠΟΥ ΔΙΑΔΕΔΟΝΤΑΙ ΑΠΟΞΗΡΑΜΕΝΑ"],
  ["1117200", "ΚΑΛΛΙΕΡΓΕΙΑ ΚΟΥΚΙΩΝ, ΠΟΥ ΔΙΑΔΕΔΟΝΤΑΙ ΑΠΟΞΗΡΑΜΕΝΑ"],
  ["1117300", "ΚΑΛΛΙΕΡΓΕΙΑ ΡΕΒΙΘΙΩΝ, ΠΟΥ ΔΙΑΔΕΔΟΝΤΑΙ ΑΠΟΞΗΡΑΜΕΝΑ"],
  ["1117400", "ΚΑΛΛΙΕΡΓΕΙΑ ΦΑΚΩΝ, ΠΟΥ ΔΙΑΔΕΔΟΝΤΑΙ ΑΠΟΞΗΡΑΜΕΝΑ"],
  ["1117500", "ΚΑΛΛΙΕΡΓΕΙΑ ΜΠΙΖΕΛΙΩΝ, ΠΟΥ ΔΙΑΔΕΔΟΝΤΑΙ ΑΠΟΞΗΡΑΜΕΝΑ"],
  ["1117900", "ΚΑΛΛΙΕΡΓΕΙΑ ΑΛΛΩΝ ΟΣΠΡΙΩΝ, ΠΟΥ ΔΙΑΔΕΔΟΝΤΑΙ ΑΠΟΞΗΡΑΜΕΝΑ"],
  ["1118000", "ΚΑΛΛΙΕΡΓΕΙΑ ΣΠΟΡΩΝ ΣΟΓΙΑΣ, ΑΡΑΠΙΚΩΝ ΦΙΣΤΙΚΙΩΝ ΚΑΙ ΒΑΜΒΑΚΟΣΠΟΡΩΝ"],
  ["1118100", "ΚΑΛΛΙΕΡΓΕΙΑ ΣΠΟΡΩΝ ΣΟΓΙΑΣ"],
  ["1118200", "ΚΑΛΛΙΕΡΓΕΙΑ ΑΡΑΠΙΚΩΝ ΦΙΣΤΙΚΙΩΝ, ΠΟΥ ΔΙΑΔΕΔΟΝΤΑΙ ΜΕ ΚΕΛΥΦΟΣ"],
  ["1118300", "ΚΑΛΛΙΕΡΓΕΙΑ ΑΡΑΠΙΚΩΝ ΦΙΣΤΙΚΙΩΝ, ΠΟΥ ΔΙΑΔΕΔΟΝΤΑΙ ΑΠΟΦΛΟΙΩΜΕΝΑ (ΧΩΡΙΣ ΚΕΛΥΦΟΣ)"],
  ["1118400", "ΚΑΛΛΙΕΡΓΕΙΑ ΒΑΜΒΑΚΟΣΠΟΡΩΝ"],
  ["1119000", "ΚΑΛΛΙΕΡΓΕΙΑ ΑΛΛΩΝ ΕΛΑΙΟΥΧΩΝ ΣΠΟΡΩΝ ΠΟΥ ΔΕΝ ΚΑΤΟΝΟΜΑΖΟΝΤΑΙ ΑΛΛΟΥ (Π.Δ.Κ.Α)"],
  ["1120000", "ΚΑΛΛΙΕΡΓΕΙΑ ΡΥΖΙΟΥ"],
  ["1121000", "ΚΑΛΛΙΕΡΓΕΙΑ ΡΥΖΙΟΥ, ΠΟΥ ΔΙΑΔΕΤΑΙ ΜΗ ΑΠΟΦΛΟΙΩΜΕΝΟ"],
  ["1121001", "ΚΑΛΛΙΕΡΓΕΙΑ ΜΑΚΡΟΣΠΕΡΜΟΥ ΡΥΖΙΟΥ"],
  ["1130000", "ΚΑΛΛΙΕΡΓΕΙΑ ΛΑΧΑΝΙΚΩΝ ΚΑΙ ΜΕΛΟΝΟΕΙΔΩΝ, ΡΙΖΩΝ ΚΑΙ ΚΟΝΔΥΛΩΝ"]
  // Add more rows here by copying from your Excel
];

function normalizeKADCode(code) {
  const cleaned = String(code).replace(/[\s.]/g, '');
  
  if (cleaned.length === 6) {
    return `${cleaned.substring(0, 2)}.${cleaned.substring(2, 4)}`;
  } else if (cleaned.length === 5) {
    return `${cleaned.substring(0, 2)}.${cleaned.substring(2, 4)}`;
  } else if (cleaned.length === 4) {
    return `${cleaned.substring(0, 2)}.${cleaned.substring(2, 4)}`;
  }
  
  return null;
}

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

async function importKADs() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected successfully');
    
    let savedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    console.log(`Processing ${kadData.length} KADs...`);
    
    for (const [code, description] of kadData) {
      try {
        const normalizedCode = normalizeKADCode(code);
        if (!normalizedCode) {
          console.log(`Skipping invalid code: ${code}`);
          continue;
        }
        
        const existing = await KAD.findOne({ code: normalizedCode });
        if (existing) {
          skippedCount++;
          continue;
        }
        
        const section = getSection(normalizedCode);
        const kadDoc = {
          code: normalizedCode,
          originalCode: code,
          description: description,
          descriptionEN: '',
          category: getCategory(section),
          section,
          isActive: true,
          vatRate: 24,
          isPopular: false,
          keywords: description.split(' ').filter(word => word.length > 4).slice(0, 10)
        };
        
        await KAD.create(kadDoc);
        savedCount++;
        
        console.log(`Saved: ${normalizedCode} - ${description.substring(0, 50)}...`);
        
      } catch (error) {
        errorCount++;
        console.error(`Error saving KAD ${code}: ${error.message}`);
      }
    }
    
    console.log('\n=== Import Summary ===');
    console.log(`Total KADs processed: ${kadData.length}`);
    console.log(`New KADs saved: ${savedCount}`);
    console.log(`Already existed: ${skippedCount}`);
    console.log(`Errors: ${errorCount}`);
    
    await mongoose.connection.close();
    console.log('Database connection closed.');
    
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

importKADs();