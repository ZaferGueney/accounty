const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const KAD = require('../src/models/kadModel');

async function testExactMatch() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected successfully');
    
    // Test if 7022 should match 70221000
    console.log('\n=== Testing if 7022 should match 70221000 ===');
    
    const originalCode = '70221000';
    const searchQuery = '7022';
    
    console.log(`Original code: ${originalCode}`);
    console.log(`Search query: ${searchQuery}`);
    console.log(`Does "${originalCode}" start with "${searchQuery}"? ${originalCode.startsWith(searchQuery)}`);
    
    // Find your specific KAD
    const yourKAD = await KAD.findOne({ originalCode: '70221000' });
    if (yourKAD) {
      console.log(`\nFound your KAD:`);
      console.log(`  Code: ${yourKAD.code}`);
      console.log(`  Original: ${yourKAD.originalCode}`);
      console.log(`  Description: ${yourKAD.description}`);
    }
    
    // Test various searches that should find it
    const testSearches = ['7022', '70221000', '70.22.10.00', '70.22'];
    
    for (const search of testSearches) {
      console.log(`\n--- Testing search: "${search}" ---`);
      const results = await KAD.search(search);
      
      const yourKADIndex = results.findIndex(kad => kad.originalCode === '70221000');
      
      if (yourKADIndex >= 0) {
        console.log(`✅ Found your KAD at position ${yourKADIndex + 1} out of ${results.length} results`);
        console.log(`   Priority: ${results[yourKADIndex].priority || 'no priority'}`);
      } else {
        console.log(`❌ Your KAD NOT found in ${results.length} results`);
        
        // Check first few results to see what's there
        console.log(`First 3 results:`);
        results.slice(0, 3).forEach((kad, i) => {
          console.log(`   ${i + 1}. ${kad.code} (${kad.originalCode}) - ${kad.description.substring(0, 40)}...`);
        });
      }
    }
    
    await mongoose.connection.close();
    console.log('\nConnection closed');
    
  } catch (error) {
    console.error('Test error:', error);
    process.exit(1);
  }
}

testExactMatch();