# KAD Extraction Scripts

This directory contains scripts for extracting Greek Activity Codes (KAD) from PDF documents and importing them into the database.

## Setup

1. Install dependencies:
```bash
cd scripts
npm install
```

2. Make sure your MongoDB connection is configured in `../server/.env`

## Available Scripts

### 1. extractKADWithPdfParse.js
Uses `pdf-parse` library to extract KAD codes from PDF.

```bash
node extractKADWithPdfParse.js /path/to/kad.pdf
```

### 2. extractKADFromPDF.js
Alternative implementation using `pdf-extract`.

```bash
node extractKADFromPDF.js /path/to/kad.pdf
```

## PDF Format Requirements

The PDF should contain KAD codes in one of these formats:
- `XX.XX.XX Description in Greek`
- `XXXXXX Description in Greek`
- `XX.XX Description in Greek`

The scripts will automatically:
- Normalize codes to XX.XX format (4-digit)
- Detect the section (A-U) based on code ranges
- Assign appropriate categories
- Extract keywords from descriptions
- Skip duplicate entries

## Alternative: Excel Format

If the PDF extraction doesn't work well, consider converting to Excel:
1. Use an online PDF to Excel converter
2. Ensure columns: Code | Description
3. Use the Excel import script (to be created)

## Output

- **Database**: KADs are saved directly to MongoDB
- **JSON File**: `extracted_kads.json` for review
- **Console**: Progress and summary statistics

## Next Steps

After extraction:
1. Review the extracted data in `extracted_kads.json`
2. Add English translations (can use Google Translate API)
3. Mark popular KADs manually
4. Verify data integrity in the database