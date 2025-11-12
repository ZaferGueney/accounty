const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from parent directory
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function addAccountantField() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    const db = mongoose.connection.db;
    
    // Get the users collection
    const usersCollection = db.collection('users');
    
    // Find all users missing the isAccountant field
    const usersWithoutField = await usersCollection.find({
      isAccountant: { $exists: false }
    }).toArray();
    
    console.log(`Found ${usersWithoutField.length} users without isAccountant field`);
    
    if (usersWithoutField.length === 0) {
      console.log('✅ All users already have isAccountant field. Database is up to date!');
      process.exit(0);
    }
    
    // Add isAccountant field with default value false
    console.log('\n📝 Adding isAccountant field to users...');
    const updateResult = await usersCollection.updateMany(
      { isAccountant: { $exists: false } },
      { $set: { isAccountant: false } }
    );
    
    console.log(`\n📊 Update Summary:`);
    console.log(`- Users found without isAccountant field: ${usersWithoutField.length}`);
    console.log(`- Users updated: ${updateResult.modifiedCount}`);
    console.log(`- Matched documents: ${updateResult.matchedCount}`);
    
    // Log some user emails for verification (first 5)
    if (usersWithoutField.length > 0) {
      console.log(`\n📧 Updated users (first 5):`);
      usersWithoutField.slice(0, 5).forEach((user, index) => {
        console.log(`  ${index + 1}. ${user.email}`);
      });
      
      if (usersWithoutField.length > 5) {
        console.log(`  ... and ${usersWithoutField.length - 5} more`);
      }
    }
    
    console.log('\n✅ isAccountant field added successfully to all users!');
    console.log('💡 Note: All users are set as non-accountants by default. Update individual users as needed.');
    
  } catch (error) {
    console.error('❌ Error during update:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

// Run the update
addAccountantField();