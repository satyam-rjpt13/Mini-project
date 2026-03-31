const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Word = require('../models/Word');
const { trie } = require('../modules/trieInstance');

const CSV_PATH = process.argv[2];

if (!CSV_PATH) {
  console.error('Usage: node scripts/importCSV.js <path-to-csv>');
  process.exit(1);
}

function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').slice(1); // skip header

  const suggestions = new Set();
  for (const line of lines) {
    if (!line.trim()) continue;
    const cols = line.split(',');
    // auto_complete_suggestion is column index 4
    const suggestion = cols[4]?.trim().replace(/^"|"$/g, '').toLowerCase();
    if (suggestion && suggestion.length > 1 && suggestion.length <= 100) {
      suggestions.add(suggestion);
    }
  }
  return [...suggestions];
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ MongoDB connected');

  const words = parseCSV(CSV_PATH);
  console.log(`📄 Found ${words.length} unique suggestions in CSV`);

  let inserted = 0, skipped = 0;

  for (const word of words) {
    try {
      await Word.create({ word });
      trie.insert(word);
      inserted++;
    } catch (err) {
      if (err.code === 11000) skipped++;
      else console.error(`Error inserting "${word}":`, err.message);
    }
  }

  console.log(`✅ Done! Inserted: ${inserted}, Skipped (duplicates): ${skipped}`);
  await mongoose.disconnect();
}

main().catch(console.error);
