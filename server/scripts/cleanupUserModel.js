const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from parent directory
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function cleanupUserModel() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    const db = mongoose.connection.db;
    
    // Get the users collection
    const usersCollection = db.collection('users');
    
    // Find all users with taxSettings
    const usersWithTaxSettings = await usersCollection.find({
      taxSettings: { $exists: true }
    }).toArray();
    
    console.log(`Found ${usersWithTaxSettings.length} users with taxSettings to migrate`);
    
    if (usersWithTaxSettings.length === 0) {
      console.log('✅ No users with taxSettings found. Database is already clean!');
      process.exit(0);
    }
    
    // Migrate taxSettings data to settings collection if needed
    const settingsCollection = db.collection('settings');
    let migratedCount = 0;
    let skippedCount = 0;
    
    for (const user of usersWithTaxSettings) {
      // Check if user already has settings document
      const existingSettings = await settingsCollection.findOne({ userId: user._id });
      
      if (existingSettings) {
        console.log(`⚠️ User ${user.email} already has settings document. Skipping migration.`);
        skippedCount++;
      } else if (user.taxSettings && Object.keys(user.taxSettings).length > 0) {
        // Only migrate if taxSettings has actual data
        console.log(`📋 Migrating tax settings for user: ${user.email}`);
        
        // Create a basic settings document with migrated tax data
        const newSettings = {
          userId: user._id,
          business: {
            legalName: user.company || 'Unnamed Business',
            legalForm: 'other' // Default since we don't know
          },
          tax: {
            afm: '000000000', // Placeholder - user will need to update
            doy: { code: '', name: '' },
            activityCodes: [],
            vatRegistered: !!user.taxSettings.vatNumber,
            vatNumber: user.taxSettings.vatNumber || ''
          },
          address: {
            street: user.taxSettings.businessAddress?.street || '',
            number: '',
            city: user.taxSettings.businessAddress?.city || '',
            postalCode: user.taxSettings.businessAddress?.postalCode || '',
            prefecture: '',
            country: user.taxSettings.businessAddress?.country || 'Greece'
          },
          contact: {
            phone: '',
            email: user.email
          },
          banking: {
            accountName: '',
            bankName: '',
            iban: ''
          },
          isComplete: false,
          completedSteps: {
            business: false,
            tax: false,
            address: false,
            contact: false,
            banking: false,
            invoicing: false
          },
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        await settingsCollection.insertOne(newSettings);
        migratedCount++;
        console.log(`✅ Migrated settings for ${user.email}`);
      }
    }
    
    // Remove taxSettings from all users
    console.log('\n🧹 Removing taxSettings field from all users...');
    const updateResult = await usersCollection.updateMany(
      { taxSettings: { $exists: true } },
      { $unset: { taxSettings: '' } }
    );
    
    console.log(`\n📊 Migration Summary:`);
    console.log(`- Total users with taxSettings: ${usersWithTaxSettings.length}`);
    console.log(`- Settings migrated: ${migratedCount}`);
    console.log(`- Users skipped (already have settings): ${skippedCount}`);
    console.log(`- taxSettings field removed from: ${updateResult.modifiedCount} users`);
    
    console.log('\n✅ Cleanup completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

// Run the cleanup
cleanupUserModel();