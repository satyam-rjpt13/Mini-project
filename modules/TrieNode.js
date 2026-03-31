class TrieNode {
  constructor() {
    this.children = {};
    this.isEnd = false;
  }
}

class Trie {
  constructor() {
    this.root = new TrieNode();
  }

  insert(word) {
    let node = this.root;
    for (const char of word.toLowerCase()) {
      if (!node.children[char]) {
        node.children[char] = new TrieNode();
      }
      node = node.children[char];
    }
    node.isEnd = true;
  }

  delete(word) {
    const _delete = (node, word, depth) => {
      if (!node) return false;
      if (depth === word.length) {
        if (!node.isEnd) return false;
        node.isEnd = false;
        return Object.keys(node.children).length === 0;
      }
      const char = word[depth];
      if (!node.children[char]) return false;
      const shouldDelete = _delete(node.children[char], word, depth + 1);
      if (shouldDelete) {
        delete node.children[char];
        return Object.keys(node.children).length === 0 && !node.isEnd;
      }
      return false;
    };
    _delete(this.root, word.toLowerCase(), 0);
  }

  search(word) {
    let node = this.root;
    for (const char of word.toLowerCase()) {
      if (!node.children[char]) return false;
      node = node.children[char];
    }
    return node.isEnd;
  }

  getSuggestions(prefix, limit = 10) {
    let node = this.root;
    for (const char of prefix.toLowerCase()) {
      if (!node.children[char]) return [];
      node = node.children[char];
    }
    const results = [];
    const dfs = (node, current) => {
      if (results.length >= limit) return;
      if (node.isEnd) results.push(current);
      for (const char of Object.keys(node.children).sort()) {
        if (results.length >= limit) return;
        dfs(node.children[char], current + char);
      }
    };
    dfs(node, prefix.toLowerCase());
    return results;
  }

  getAllWords() {
    const results = [];
    const dfs = (node, current) => {
      if (node.isEnd) results.push(current);
      for (const char of Object.keys(node.children)) {
        dfs(node.children[char], current + char);
      }
    };
    dfs(this.root, '');
    return results;
  }
}

module.exports = { Trie, TrieNode };
