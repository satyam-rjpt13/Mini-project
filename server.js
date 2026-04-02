const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware (express)

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Routes

const autocompleteRouter = require('./routes/autocomplete');
app.use('/api', autocompleteRouter);

app.get('/', (req, res) => {
  res.send('Trie Autocomplete Server is Running!');
});

// Connect to MongoDB, seed Trie with persisted words, then start server
const PORT = process.env.PORT || 3000;

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log('✅ MongoDB Connected to triedb');

    // Load all persisted words into the in-memory Trie
    
    const Word = require('./models/Word');
    const { trie } = require('./modules/trieInstance');
    const words = await Word.find({}).select('word -_id');
    words.forEach(({ word }) => trie.insert(word));
    console.log(`📖 Loaded ${words.length} word(s) into Trie from MongoDB`);

    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB Connection Error:', err);
    process.exit(1);
  });
