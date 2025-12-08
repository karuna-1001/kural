const express = require('express');
const router = express.Router();
const Datastore = require('nedb');
const path = require('path');
const { validateLanguage } = require('../middleware/validators');

// Monkey patch for Node.js >= 15
const util = require('util');
if (!util.isDate && typeof util.types?.isDate === 'function') {
  util.isDate = util.types.isDate;
}

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

// Get all available translators
router.get('/', validateLanguage, async (req, res, next) => {
  try {
    const lang = req.query.lang;

    const couplets = await new Promise((resolve, reject) => {
      db.find({}, (err, docs) => err ? reject(err) : resolve(docs));
    });

    if (!couplets || couplets.length === 0) {
      return res.json({
        success: true,
        translators: { en: [], hi: [], ta: [] }
      });
    }

    const translatorsMap = { en: new Map(), hi: new Map(), ta: new Map() };

    couplets.forEach(couplet => {
      if (couplet.translations) {
        Object.entries(couplet.translations).forEach(([language, translations]) => {
          translations.forEach(translation => {
            if (translation.author) {
              const id = translation.author.toLowerCase().replace(/[^a-z0-9]/g, '');
              if (!translatorsMap[language].has(id)) {
                translatorsMap[language].set(id, {
                  id: id,
                  name: translation.author,
                  year: translation.year,
                  language: language,
                  type: 'translation'
                });
              }
            }
          });
        });
      }

      if (couplet.tamil_interpretations) {
        couplet.tamil_interpretations.forEach(interpretation => {
          if (interpretation.author) {
            const id = interpretation.author.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (!translatorsMap.ta.has(id)) {
              translatorsMap.ta.set(id, {
                id: id,
                name: interpretation.author,
                year: interpretation.year,
                language: 'ta',
                type: 'commentary'
              });
            }
          }
        });
      }
    });

    const result = {
      en: Array.from(translatorsMap.en.values()).sort((a, b) => a.year - b.year),
      hi: Array.from(translatorsMap.hi.values()).sort((a, b) => a.year - b.year),
      ta: Array.from(translatorsMap.ta.values()).sort((a, b) => a.year - b.year)
    };

    if (lang && ['en', 'hi', 'ta'].includes(lang)) {
      return res.json({
        success: true,
        translators: { [lang]: result[lang] }
      });
    }

    res.json({
      success: true,
      translators: result
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
