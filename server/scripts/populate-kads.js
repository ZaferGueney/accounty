const mongoose = require('mongoose');
const KAD = require('../src/models/kadModel');
const kadsData = require('../data/greek-kad-codes.json');
const additionalKadsData = require('../data/additional-kad-codes.json');
require('dotenv').config();

const populateKADs = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://dbFyped:bat8fugi4@cluster0.9ire6.mongodb.net/Accounty?retryWrites=true&w=majority');
    console.log('Connected to MongoDB');

    // Clear existing KADs (optional - remove this line to keep existing data)
    // await KAD.deleteMany({});
    // console.log('Cleared existing KADs');

    // Combine all KAD data
    const allKadsData = [...kadsData, ...additionalKadsData];

    // Insert new KADs
    let created = 0;
    let updated = 0;
    let errors = [];

    for (const kadData of allKadsData) {
      try {
        const existingKAD = await KAD.findOne({ code: kadData.code });

        if (existingKAD) {
          // Update existing KAD
          await KAD.findOneAndUpdate(
            { code: kadData.code },
            { ...kadData, updatedAt: new Date() },
            { runValidators: true }
          );
          updated++;
          console.log(`Updated KAD: ${kadData.code}`);
        } else {
          // Create new KAD
          await KAD.create(kadData);
          created++;
          console.log(`Created KAD: ${kadData.code}`);
        }
      } catch (error) {
        const errorMsg = `Error processing KAD ${kadData.code}: ${error.message}`;
        errors.push(errorMsg);
        console.error(errorMsg);
      }
    }

    console.log('\n--- Population Results ---');
    console.log(`Total processed: ${allKadsData.length}`);
    console.log(`Created: ${created}`);
    console.log(`Updated: ${updated}`);
    console.log(`Errors: ${errors.length}`);

    if (errors.length > 0) {
      console.log('\nErrors:');
      errors.forEach(error => console.log(`- ${error}`));
    }

    console.log('\nKAD population completed successfully!');
  } catch (error) {
    console.error('Error populating KADs:', error);
  } finally {
    // Close the connection
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
};

// Run the script
populateKADs();