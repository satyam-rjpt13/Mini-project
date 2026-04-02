const express = require('express');
const router = express.Router();
const Word = require('../models/Word');
const { trie } = require('../modules/trieInstance');

// GET /api/autocomplete?prefix=abc&limit=10
//here we get APi 

router.get('/autocomplete', async (req, res) => {
  const { prefix, limit } = req.query;
  if (!prefix || prefix.trim() === '') {
    return res.status(400).json({ error: 'prefix query param is required' });
  }
  const words = trie.getSuggestions(prefix.trim(), parseInt(limit) || 10);
  const docs = await Word.find({ word: { $in: words } }).select('word frequency -_id');
  const freqMap = {};
  docs.forEach(d => (freqMap[d.word] = d.frequency));
  const suggestions = words.map(w => ({ word: w, frequency: freqMap[w] || 0 }));
  res.json({ prefix: prefix.trim().toLowerCase(), suggestions });
});

// POST /api/autocomplete/search — track a search (increments frequency)


router.post('/autocomplete/search', async (req, res) => {
  const { word } = req.body;
  if (!word || word.trim() === '') {
    return res.status(400).json({ error: 'word is required' });
  }
  const normalized = word.trim().toLowerCase();
  const doc = await Word.findOneAndUpdate(
    { word: normalized },
    { $inc: { frequency: 1 } },
    { new: true, upsert: true }
  );
  trie.insert(normalized);
  res.json({ word: normalized, frequency: doc.frequency });
});

// GET /api/words — list all words

router.get('/words', async (req, res) => {
  const words = await Word.find({}).sort({ frequency: -1, word: 1 }).select('word frequency -_id');
  res.json({ count: words.length, words });
});

// POST /api/words — insert a word

router.post('/words', async (req, res) => {
  const { word } = req.body;
  if (!word || word.trim() === '') {
    return res.status(400).json({ error: 'word is required in request body' });
  }
  const normalized = word.trim().toLowerCase();
  try {
    const existing = await Word.findOne({ word: normalized });
    if (existing) {
      existing.frequency += 1;
      await existing.save();
      trie.insert(normalized);
      return res.json({ message: 'Word frequency updated', word: normalized, frequency: existing.frequency });
    }
    const doc = await Word.create({ word: normalized });
    trie.insert(normalized);
    res.status(201).json({ message: 'Word inserted', word: doc.word, frequency: doc.frequency });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Word already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

// POST /api/words/bulk — insert multiple words at once
router.post('/words/bulk', async (req, res) => {
  const { words } = req.body;
  if (!Array.isArray(words) || words.length === 0) {
    return res.status(400).json({ error: 'words must be a non-empty array' });
  }
  const normalized = [...new Set(words.map(w => String(w).trim().toLowerCase()).filter(Boolean))];
  const results = { inserted: [], skipped: [] };
  for (const word of normalized) {
    try {
      await Word.create({ word });
      trie.insert(word);
      results.inserted.push(word);
    } catch (err) {
      if (err.code === 11000) {
        results.skipped.push(word);
      } else {
        return res.status(500).json({ error: err.message });
      }
    }
  }
  res.status(201).json({ ...results, insertedCount: results.inserted.length, skippedCount: results.skipped.length });
});

// DELETE /api/words/:word — remove a word
router.delete('/words/:word', async (req, res) => {
  const word = req.params.word.toLowerCase();
  const deleted = await Word.findOneAndDelete({ word });
  if (!deleted) {
    return res.status(404).json({ error: 'Word not found' });
  }
  trie.delete(word);
  res.json({ message: 'Word deleted', word });
});

// GET /api/words/search/:word — check if a word exists
router.get('/words/search/:word', async (req, res) => {
  const word = req.params.word.toLowerCase();
  const exists = trie.search(word);
  res.json({ word, exists });
});

module.exports = router;
