const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const KAD = require('../src/models/kadModel');

// Debug specific search cases
async function debugSpecificSearch() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected successfully');
    
    // First, let's find what codes actually exist starting with 7022
    console.log('\n=== Direct MongoDB query for codes starting with 7022 ===');
    const directResults = await KAD.find({
      isActive: true,
      $or: [
        { originalCode: /^7022/ },
        { code: /^70\.22/ }
      ]
    }).limit(5);
    
    console.log(`Found ${directResults.length} results with direct query:`);
    directResults.forEach(kad => {
      console.log(`  Code: ${kad.code}, Original: ${kad.originalCode}, Description: ${kad.description.substring(0, 60)}...`);
    });
    
    // Test the specific searches
    const testQueries = ['7022', '702', '70.22'];
    
    for (const query of testQueries) {
      console.log(`\n=== Testing search for: "${query}" ===`);
      
      // Test our search function
      try {
        const results = await KAD.search(query);
        console.log(`Found ${results.length} results with our search:`);
        
        results.slice(0, 3).forEach((kad, index) => {
          console.log(`${index + 1}. Code: ${kad.code}, Original: ${kad.originalCode}`);
          console.log(`   Description: ${kad.description.substring(0, 60)}...`);
          if (kad.priority) {
            console.log(`   Priority: ${kad.priority}`);
          }
        });
        
        // Also test with manual query to see what should match
        console.log(`\nManual query test for "${query}":`);
        const cleanQuery = query.replace(/[\s.]/g, '');
        const manualResults = await KAD.find({
          isActive: true,
          $or: [
            { originalCode: new RegExp(`^${cleanQuery}`, 'i') },
            { code: new RegExp(`^${cleanQuery}`, 'i') }
          ]
        }).limit(3);
        
        console.log(`Manual query found ${manualResults.length} results:`);
        manualResults.forEach(kad => {
          console.log(`  Code: ${kad.code}, Original: ${kad.originalCode}`);
        });
        
      } catch (error) {
        console.error(`Error searching for "${query}":`, error.message);
      }
    }
    
    await mongoose.connection.close();
    console.log('\nConnection closed');
    
  } catch (error) {
    console.error('Test error:', error);
    process.exit(1);
  }
}

debugSpecificSearch();