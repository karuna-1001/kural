const express = require('express');
const { param, query, validationResult } = require('express-validator');
const router = express.Router();
const Datastore = require('nedb');
const path = require('path');

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

// Initialize database with options
const dbPath = path.join(__dirname, '../../data/thirukkural.db');
console.log('Loading database from:', dbPath);

const db = new Datastore({ 
  filename: dbPath,
  autoload: true,
  // Serialize dates as ISO strings to avoid util.isDate issues
  serialize: (obj) => {
    return JSON.stringify(obj, (key, value) => {
      if (value instanceof Date) {
        return value.toISOString();
      }
      return value;
    });
  },
  // Parse dates back from ISO strings
  deserialize: (str) => {
    return JSON.parse(str, (key, value) => {
      if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/.test(value)) {
        return new Date(value);
      }
      return value;
    });
  }
});

// Promisify database operations
const findAsync = (query) => new Promise((resolve, reject) => {
  db.find(query, (err, docs) => {
    if (err) reject(err);
    else resolve(docs);
  });
});

const countAsync = (query) => new Promise((resolve, reject) => {
  db.count(query, (err, count) => {
    if (err) reject(err);
    else resolve(count);
  });
});

// Create indexes for faster queries
db.ensureIndex({ fieldName: 'number', unique: true });
db.ensureIndex({ fieldName: 'division_number' });
db.ensureIndex({ fieldName: 'section_number' });
db.ensureIndex({ fieldName: 'chapter_number' });

// Get all couplets with pagination
router.get('/', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  try {
    console.log('Attempting database query...');
    
    const couplets = await findAsync({})
      .then(docs => {
        console.log('Found documents:', docs?.length || 0);
        return docs.sort((a, b) => a.number - b.number)
          .slice(skip, skip + limit);
      })
      .catch(err => {
        console.error('Database find error:', err);
        throw err;
      });

    const total = await countAsync({})
      .then(count => {
        console.log('Total documents:', count);
        return count;
      })
      .catch(err => {
        console.error('Database count error:', err);
        throw err;
      });

    res.json({
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
    console.error('Route error:', err);
    res.status(500).json({ 
      error: 'Database error',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// Get a specific couplet by number
// Helper function for finding one document
const findOneAsync = (query) => new Promise((resolve, reject) => {
  db.findOne(query, (err, doc) => {
    if (err) reject(err);
    else resolve(doc);
  });
});

router.get('/:number',
  param('number').isInt({ min: 1, max: 1330 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const coupletNumber = parseInt(req.params.number);
    console.log(`Looking for couplet number: ${coupletNumber}`);

    try {
      const couplet = await findOneAsync({ number: coupletNumber })
        .then(doc => {
          console.log('Found couplet:', doc ? 'yes' : 'no');
          return doc;
        })
        .catch(err => {
          console.error('Database findOne error:', err);
          throw err;
        });

      if (!couplet) {
        return res.status(404).json({ error: 'Couplet not found' });
      }

      res.json(couplet);
    } catch (err) {
      console.error('Route error:', err);
      res.status(500).json({ 
        error: 'Database error',
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
  });

// Get chapters list
router.get('/chapters', async (req, res) => {
  try {
    const chapters = await new Promise((resolve, reject) => {
      db.find({})
        .sort({ 'chapter.number': 1 })
        .exec((err, docs) => {
          if (err) reject(err);
          else {
            // Extract unique chapters
            const uniqueChapters = [...new Map(docs.map(doc => [
              doc.chapter.number,
              {
                number: doc.chapter.number,
                name: doc.chapter.name,
                transliteration: doc.chapter.transliteration,
                translation: doc.chapter.translation,
                coupletCount: docs.filter(k => k.chapter.number === doc.chapter.number).length
              }
            ])).values()];
            resolve(uniqueChapters);
          }
        });
    });

    res.json(chapters);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Get sections list
router.get('/sections', async (req, res) => {
  try {
    const sections = await new Promise((resolve, reject) => {
      db.find({})
        .sort({ 'section.number': 1 })
        .exec((err, docs) => {
          if (err) reject(err);
          else {
            // Extract unique sections
            const uniqueSections = [...new Map(docs.map(doc => [
              doc.section.number,
              {
                number: doc.section.number,
                name: doc.section.name,
                transliteration: doc.section.transliteration,
                translation: doc.section.translation,
                coupletCount: docs.filter(k => k.section.number === doc.section.number).length
              }
            ])).values()];
            resolve(uniqueSections);
          }
        });
    });

    res.json(sections);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Search couplets with enhanced filtering
router.get('/search', 
  query('q').optional().isString().trim(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const searchTerm = req.query.q?.toLowerCase();
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Additional filters
    const chapterNumber = req.query.chapter ? parseInt(req.query.chapter) : null;
    const sectionNumber = req.query.section ? parseInt(req.query.section) : null;
    const divisionNumber = req.query.division ? parseInt(req.query.division) : null;

    try {
      let query = {};

      // Build query conditions
      if (searchTerm) {
        query.$or = [
          { tamil: new RegExp(searchTerm, 'i') },
          { tamil_explanation: new RegExp(searchTerm, 'i') },
          { 'translations.en.text': new RegExp(searchTerm, 'i') },
          { 'translations.en.explanation': new RegExp(searchTerm, 'i') },
          { 'tamil_interpretations.text': new RegExp(searchTerm, 'i') },
          { keywords: new RegExp(searchTerm, 'i') }
        ];
      }

      // Add chapter and section filters if provided
      if (chapterNumber) {
        query['chapter.number'] = chapterNumber;
      }
      if (sectionNumber) {
        query['section.number'] = sectionNumber;
      }

      const [couplets, total] = await Promise.all([
        new Promise((resolve, reject) => {
          db.find(query)
            .sort({ number: 1 })
            .skip(skip)
            .limit(limit)
            .exec((err, docs) => {
              if (err) reject(err);
              else resolve(docs);
            });
        }),
        new Promise((resolve, reject) => {
          db.count(query, (err, count) => {
            if (err) reject(err);
            else resolve(count);
          });
        })
      ]);

      res.json({
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
          searchTerm
        }
      });
    } catch (err) {
      res.status(500).json({ error: 'Database error' });
    }
  }
);

module.exports = router;