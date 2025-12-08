const express = require('express');
const router = express.Router();
const Datastore = require('nedb');
const path = require('path');
const {
  validateCoupletNumber,
  validatePagination,
  validateFilters,
  validateTranslators,
  validateSearch
} = require('../middleware/validators');

// Monkey patch for Node.js >= 15
const util = require('util');
if (!util.isDate && typeof util.types?.isDate === 'function') {
  util.isDate = util.types.isDate;
}
if (!util.isRegExp) {
  util.isRegExp = function isRegExp(obj) {
    return Object.prototype.toString.call(obj) === '[object RegExp]';
  };
}

// Initialize database
const dbPath = path.join(__dirname, '../../data/thirukkural.db');
const db = new Datastore({
  filename: dbPath,
  autoload: true,
  serialize: (obj) => JSON.stringify(obj, (key, value) =>
    value instanceof Date ? value.toISOString() : value
  ),
  deserialize: (str) => JSON.parse(str, (key, value) =>
    typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/.test(value)
      ? new Date(value) : value
  )
});

// Database helpers
const findAsync = (query) => new Promise((resolve, reject) => {
  db.find(query, (err, docs) => err ? reject(err) : resolve(docs));
});

const countAsync = (query) => new Promise((resolve, reject) => {
  db.count(query, (err, count) => err ? reject(err) : resolve(count));
});

const findOneAsync = (query) => new Promise((resolve, reject) => {
  db.findOne(query, (err, doc) => err ? reject(err) : resolve(doc));
});

// Helper to filter translations
const filterTranslations = (couplet, translatorIds) => {
  if (!translatorIds || translatorIds.length === 0) return couplet;

  const filtered = { ...couplet };

  if (filtered.translations) {
    const filteredTranslations = {};
    Object.entries(filtered.translations).forEach(([lang, translations]) => {
      const langFiltered = translations.filter(t => {
        const authorId = t.author.toLowerCase().replace(/[^a-z0-9]/g, '');
        return translatorIds.includes(authorId);
      });
      if (langFiltered.length > 0) {
        filteredTranslations[lang] = langFiltered;
      }
    });
    filtered.translations = filteredTranslations;
  }

  if (filtered.tamil_interpretations) {
    filtered.tamil_interpretations = filtered.tamil_interpretations.filter(interp => {
      const authorId = interp.author.toLowerCase().replace(/[^a-z0-9]/g, '');
      return translatorIds.includes(authorId);
    });
  }

  return filtered;
};

// Indexes
db.ensureIndex({ fieldName: 'number', unique: true });
db.ensureIndex({ fieldName: 'division.number' });
db.ensureIndex({ fieldName: 'section.number' });
db.ensureIndex({ fieldName: 'chapter.number' });

// Get all couplets with pagination
router.get('/',
  validatePagination,
  validateTranslators,
  async (req, res, next) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const translators = req.query.translators ? req.query.translators.split(',').map(t => t.trim()) : [];

    try {
      let couplets = await findAsync({});
      couplets = couplets
        .sort((a, b) => a.number - b.number)
        .slice(skip, skip + limit);

      if (translators.length > 0) {
        couplets = couplets.map(c => filterTranslations(c, translators));
      }

      const total = await countAsync({});

      res.json({
        success: true,
        couplets,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalCouplets: total,
          hasNext: skip + limit < total,
          hasPrev: page > 1
        }
      });
    } catch (err) {
      next(err);
    }
  });

// Get a specific couplet
router.get('/:number',
  validateCoupletNumber,
  validateTranslators,
  async (req, res, next) => {
    const coupletNumber = parseInt(req.params.number);
    const translators = req.query.translators ? req.query.translators.split(',').map(t => t.trim()) : [];

    try {
      let couplet = await findOneAsync({ number: coupletNumber });

      if (!couplet) {
        return res.status(404).json({
          success: false,
          error: 'Couplet not found'
        });
      }

      if (translators.length > 0) {
        couplet = filterTranslations(couplet, translators);
      }

      res.json({ success: true, ...couplet });
    } catch (err) {
      next(err);
    }
  });

// Search couplets
router.get('/search',
  validateSearch,
  validatePagination,
  validateFilters,
  validateTranslators,
  async (req, res, next) => {
    const searchTerm = req.query.q?.toLowerCase();
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const translators = req.query.translators ? req.query.translators.split(',').map(t => t.trim()) : [];
    const chapterNumber = req.query.chapter ? parseInt(req.query.chapter) : null;
    const sectionNumber = req.query.section ? parseInt(req.query.section) : null;
    const divisionNumber = req.query.division ? parseInt(req.query.division) : null;

    try {
      let query = {};

      if (searchTerm) {
        query.$or = [
          { tamil: new RegExp(searchTerm, 'i') },
          { 'translations.en.text': new RegExp(searchTerm, 'i') },
          { 'translations.en.explanation': new RegExp(searchTerm, 'i') },
          { 'tamil_interpretations.text': new RegExp(searchTerm, 'i') }
        ];
      }

      if (chapterNumber) query['chapter.number'] = chapterNumber;
      if (sectionNumber) query['section.number'] = sectionNumber;
      if (divisionNumber) query['division.number'] = divisionNumber;

      const [allCouplets, total] = await Promise.all([
        findAsync(query),
        countAsync(query)
      ]);

      let couplets = allCouplets
        .sort((a, b) => a.number - b.number)
        .slice(skip, skip + limit);

      if (translators.length > 0) {
        couplets = couplets.map(c => filterTranslations(c, translators));
      }

      res.json({
        success: true,
        couplets,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalResults: total,
          hasNext: skip + limit < total,
          hasPrev: page > 1
        },
        filters: {
          division: divisionNumber,
          chapter: chapterNumber,
          section: sectionNumber,
          searchTerm,
          translators: translators.length > 0 ? translators : null
        }
      });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;