const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const KAD = require('../src/models/kadModel');

// Test the search functionality
async function testKADSearch() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected successfully');
    
    const testQueries = [
      '7022',
      '70.22',
      '70221000',
      'ΥΠΗΡΕΣΙΕΣ ΠΑΡΟΧΗΣ ΕΠΙΧΕΙΡΗΜΑΤΙΚΩΝ ΣΥΜΒΟΥΛΩΝ'
    ];
    
    for (const query of testQueries) {
      console.log(`\n=== Searching for: "${query}" ===`);
      
      try {
        const results = await KAD.search(query);
        console.log(`Found ${results.length} results`);
        
        // Show top 5 results
        results.slice(0, 5).forEach((kad, index) => {
          console.log(`${index + 1}. Code: ${kad.code} (Original: ${kad.originalCode})`);
          console.log(`   Description: ${kad.description.substring(0, 80)}...`);
          if (kad.searchScore) {
            console.log(`   Score: ${kad.searchScore}`);
          }
          console.log('');
        });
      } catch (error) {
        console.error(`Error searching for "${query}":`, error.message);
      }
    }
    
    await mongoose.connection.close();
    console.log('Connection closed');
    
  } catch (error) {
    console.error('Test error:', error);
    process.exit(1);
  }
}

testKADSearch();