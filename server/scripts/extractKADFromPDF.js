const fs = require('fs');
const path = require('path');
const { PDFExtract } = require('pdf-extract');
const mongoose = require('mongoose');
require('dotenv').config({ path: '../server/.env' });

// Import KAD model
const KAD = require('../server/src/models/kadModel');

// PDF extraction configuration
const pdfExtract = new PDFExtract();
const options = {}; // Default options

// Regular expression to match KAD codes (format: XX.XX.XX or XX.XX)
const KAD_REGEX = /^(\d{2})\.(\d{2})(?:\.(\d{2}))?/;

// Function to extract section from KAD code
function getSection(code) {
  const firstTwo = code.substring(0, 2);
  const num = parseInt(firstTwo);
  
  // Section mapping based on KAD code ranges
  if (num >= 1 && num <= 3) return 'A'; // Agriculture
  if (num >= 5 && num <= 9) return 'B'; // Mining
  if (num >= 10 && num <= 33) return 'C'; // Manufacturing
  if (num >= 35 && num <= 35) return 'D'; // Electricity
  if (num >= 36 && num <= 39) return 'E'; // Water supply
  if (num >= 41 && num <= 43) return 'F'; // Construction
  if (num >= 45 && num <= 47) return 'G'; // Wholesale/retail
  if (num >= 49 && num <= 53) return 'H'; // Transportation
  if (num >= 55 && num <= 56) return 'I'; // Accommodation
  if (num >= 58 && num <= 63) return 'J'; // Information
  if (num >= 64 && num <= 66) return 'K'; // Financial
  if (num >= 68 && num <= 68) return 'L'; // Real estate
  if (num >= 69 && num <= 75) return 'M'; // Professional
  if (num >= 77 && num <= 82) return 'N'; // Administrative
  if (num >= 84 && num <= 84) return 'O'; // Public administration
  if (num >= 85 && num <= 85) return 'P'; // Education
  if (num >= 86 && num <= 88) return 'Q'; // Health
  if (num >= 90 && num <= 93) return 'R'; // Arts
  if (num >= 94 && num <= 96) return 'S'; // Other services
  if (num >= 97 && num <= 98) return 'T'; // Households
  if (num >= 99 && num <= 99) return 'U'; // Extraterritorial
  
  return 'C'; // Default to C (Manufacturing) if unclear
}

// Function to determine category based on section
function getCategory(section, description) {
  const categoryMap = {
    'A': 'Agriculture, Forestry and Fishing',
    'B': 'Mining and Quarrying',
    'C': 'Manufacturing',
    'D': 'Electricity, Gas, Steam',
    'E': 'Water Supply, Sewerage',
    'F': 'Construction',
    'G': 'Wholesale and Retail Trade',
    'H': 'Transportation and Storage',
    'I': 'Accommodation and Food Service',
    'J': 'Information and Communication',
    'K': 'Financial and Insurance',
    'L': 'Real Estate Activities',
    'M': 'Professional, Scientific and Technical',
    'N': 'Administrative and Support Service',
    'O': 'Public Administration and Defence',
    'P': 'Education',
    'Q': 'Human Health and Social Work',
    'R': 'Arts, Entertainment and Recreation',
    'S': 'Other Service Activities',
    'T': 'Household Activities',
    'U': 'Extraterritorial Organizations'
  };
  
  return categoryMap[section] || 'Other';
}

// Function to process extracted text and find KAD entries
function processExtractedData(data) {
  const kadEntries = [];
  let currentKAD = null;
  let currentDescription = '';
  
  // Iterate through all pages
  data.pages.forEach((page, pageIndex) => {
    console.log(`Processing page ${pageIndex + 1}...`);
    
    page.content.forEach((item) => {
      const text = item.str.trim();
      
      // Check if this line starts with a KAD code
      const kadMatch = text.match(KAD_REGEX);
      
      if (kadMatch) {
        // Save previous KAD if exists
        if (currentKAD && currentDescription) {
          kadEntries.push({
            code: currentKAD,
            description: currentDescription.trim(),
            section: getSection(currentKAD),
            category: getCategory(getSection(currentKAD), currentDescription)
          });
        }
        
        // Start new KAD
        currentKAD = kadMatch[0];
        // Remove KAD code from text to get description
        currentDescription = text.substring(kadMatch[0].length).trim();
      } else if (currentKAD && text) {
        // Continue building description for current KAD
        currentDescription += ' ' + text;
      }
    });
  });
  
  // Don't forget the last KAD
  if (currentKAD && currentDescription) {
    kadEntries.push({
      code: currentKAD,
      description: currentDescription.trim(),
      section: getSection(currentKAD),
      category: getCategory(getSection(currentKAD), currentDescription)
    });
  }
  
  return kadEntries;
}

// Function to convert 6-digit KAD to 4-digit format (XX.XX)
function normalizeKADCode(code) {
  // If it's already in XX.XX format, return as is
  if (/^\d{2}\.\d{2}$/.test(code)) {
    return code;
  }
  
  // If it's in XX.XX.XX format, take only the first two parts
  const match = code.match(/^(\d{2})\.(\d{2})/);
  if (match) {
    return `${match[1]}.${match[2]}`;
  }
  
  return null;
}

// Main function to extract and save KADs
async function extractAndSaveKADs(pdfPath) {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    console.log(`Extracting data from PDF: ${pdfPath}`);
    
    pdfExtract.extract(pdfPath, options, async (err, data) => {
      if (err) {
        console.error('Error extracting PDF:', err);
        return;
      }
      
      console.log(`Extracted ${data.pages.length} pages from PDF`);
      
      // Process the extracted data
      const kadEntries = processExtractedData(data);
      console.log(`Found ${kadEntries.length} KAD entries`);
      
      // Group by 4-digit code and save to database
      const uniqueKADs = new Map();
      
      kadEntries.forEach(entry => {
        const normalizedCode = normalizeKADCode(entry.code);
        if (normalizedCode && !uniqueKADs.has(normalizedCode)) {
          uniqueKADs.set(normalizedCode, {
            code: normalizedCode,
            description: entry.description,
            descriptionEN: '', // Will need translation later
            category: entry.category,
            section: entry.section,
            isActive: true,
            vatRate: 24, // Default Greek VAT
            isPopular: false,
            keywords: entry.description.split(' ').filter(word => word.length > 4)
          });
        }
      });
      
      console.log(`Unique 4-digit KADs to save: ${uniqueKADs.size}`);
      
      // Save to database
      let savedCount = 0;
      let errorCount = 0;
      
      for (const [code, kadData] of uniqueKADs) {
        try {
          // Check if KAD already exists
          const existing = await KAD.findOne({ code: kadData.code });
          if (!existing) {
            await KAD.create(kadData);
            savedCount++;
            console.log(`Saved KAD: ${kadData.code} - ${kadData.description.substring(0, 50)}...`);
          } else {
            console.log(`KAD already exists: ${kadData.code}`);
          }
        } catch (error) {
          errorCount++;
          console.error(`Error saving KAD ${kadData.code}:`, error.message);
        }
      }
      
      console.log(`\nImport completed!`);
      console.log(`Total KADs processed: ${uniqueKADs.size}`);
      console.log(`Successfully saved: ${savedCount}`);
      console.log(`Errors: ${errorCount}`);
      
      // Save extracted data to JSON for review
      const jsonPath = path.join(__dirname, 'extracted_kads.json');
      fs.writeFileSync(jsonPath, JSON.stringify(Array.from(uniqueKADs.values()), null, 2));
      console.log(`\nExtracted data saved to: ${jsonPath}`);
      
      mongoose.connection.close();
    });
    
  } catch (error) {
    console.error('Error:', error);
    mongoose.connection.close();
  }
}

// Run the extraction
const pdfPath = process.argv[2] || '/mnt/c/Users/zafer/Downloads/currentRegistryJasperKad.pdf';
extractAndSaveKADs(pdfPath);