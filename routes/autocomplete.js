const express = require('express');
const router = express.Router();
const Word = require('../models/Word'); // Mongoose model for words collection
const { trie } = require('../modules/trieInstance'); // Trie instance for fast prefix search


// Autocomplete backend using Express, MongoDB and Trie
// Stores words with frequency and provides fast prefix-based suggestions
// GET /api/autocomplete — return suggestions based on prefix
router.get('/autocomplete', async (req, res) => {
  const { prefix, limit } = req.query;

  // Validate prefix input
  if (!prefix || prefix.trim() === '') {
    return res.status(400).json({ error: 'prefix query param is required' });
  }

  // Get suggestions from Trie (fast lookup)
  const words = trie.getSuggestions(prefix.trim(), parseInt(limit) || 10);

  // Fetch corresponding frequencies from database
  const docs = await Word.find({ word: { $in: words } }).select('word frequency -_id');

  // Create a map of word -> frequency
  const freqMap = {};
  docs.forEach(d => (freqMap[d.word] = d.frequency));

  // Combine trie results with DB frequency
  const suggestions = words.map(w => ({ word: w, frequency: freqMap[w] || 0 }));

  // Return suggestions
  res.json({ prefix: prefix.trim().toLowerCase(), suggestions });
});


// POST /api/autocomplete/search — track a search (increments frequency)
router.post('/autocomplete/search', async (req, res) => {
  const { word } = req.body;

  // Validate input
  if (!word || word.trim() === '') {
    return res.status(400).json({ error: 'word is required' });
  }

  // Normalize word (trim + lowercase)
  const normalized = word.trim().toLowerCase();

  // Increment frequency or create new word if not exists
  const doc = await Word.findOneAndUpdate(
    { word: normalized },
    { $inc: { frequency: 1 } },
    { new: true, upsert: true } // upsert creates document if not found
  );

  // Insert into trie for future suggestions
  trie.insert(normalized);

  // Return updated frequency
  res.json({ word: normalized, frequency: doc.frequency });
});


// GET /api/words — list all words sorted by frequency
router.get('/words', async (req, res) => {
  // Fetch all words sorted by frequency (descending) and alphabetically
  const words = await Word.find({}).sort({ frequency: -1, word: 1 }).select('word frequency -_id');

  res.json({ count: words.length, words });
});


// POST /api/words — insert a single word
router.post('/words', async (req, res) => {
  const { word } = req.body;

  // Validate input
  if (!word || word.trim() === '') {
    return res.status(400).json({ error: 'word is required in request body' });
  }

  // Normalize word
  const normalized = word.trim().toLowerCase();

  try {
    // Check if word already exists
    const existing = await Word.findOne({ word: normalized });

    if (existing) {
      // If exists, increment frequency
      existing.frequency += 1;
      await existing.save();

      // Ensure word is in trie
      trie.insert(normalized);

      return res.json({ message: 'Word frequency updated', word: normalized, frequency: existing.frequency });
    }

    // Create new word
    const doc = await Word.create({ word: normalized });

    // Insert into trie
    trie.insert(normalized);

    res.status(201).json({ message: 'Word inserted', word: doc.word, frequency: doc.frequency });
  } catch (err) {
    // Handle duplicate key error
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Word already exists' });
    }

    // Handle other errors
    res.status(500).json({ error: err.message });
  }
});


// POST /api/words/bulk — insert multiple words at once
router.post('/words/bulk', async (req, res) => {
  const { words } = req.body;

  // Validate input array
  if (!Array.isArray(words) || words.length === 0) {
    return res.status(400).json({ error: 'words must be a non-empty array' });
  }

  // Normalize, remove duplicates, and filter invalid values
  const normalized = [...new Set(words.map(w => String(w).trim().toLowerCase()).filter(Boolean))];

  const results = { inserted: [], skipped: [] };

  // Insert each word individually
  for (const word of normalized) {
    try {
      await Word.create({ word });

      // Add to trie
      trie.insert(word);

      results.inserted.push(word);
    } catch (err) {
      // Skip duplicates
      if (err.code === 11000) {
        results.skipped.push(word);
      } else {
        return res.status(500).json({ error: err.message });
      }
    }
  }

  // Return summary
  res.status(201).json({ ...results, insertedCount: results.inserted.length, skippedCount: results.skipped.length });
});


// DELETE /api/words/:word — remove a word
router.delete('/words/:word', async (req, res) => {
  const word = req.params.word.toLowerCase();

  // Delete word from DB
  const deleted = await Word.findOneAndDelete({ word });

  // If word not found
  if (!deleted) {
    return res.status(404).json({ error: 'Word not found' });
  }

  // Remove from trie
  trie.delete(word);

  res.json({ message: 'Word deleted', word });
});


// GET /api/words/search/:word — check if a word exists
router.get('/words/search/:word', async (req, res) => {
  const word = req.params.word.toLowerCase();

  // Check existence in trie (fast lookup)
  const exists = trie.search(word);

  res.json({ word, exists });
});

module.exports = router;