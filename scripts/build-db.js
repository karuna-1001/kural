const fs = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');
const Datastore = require('nedb');

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

const DATA_DIR = path.join(__dirname, '..', 'data');
const TRANSLATIONS_DIR = path.join(DATA_DIR, 'translations');
const DB_PATH = path.join(DATA_DIR, 'thirukkural.db');

// Initialize NeDB database
const coupletsDb = new Datastore({
  filename: DB_PATH,
  autoload: true,
  timestampData: true,
  serialize: (obj) => JSON.stringify(obj, (key, value) =>
    value instanceof Date ? value.toISOString() : value
  ),
  deserialize: (str) => JSON.parse(str, (key, value) =>
    typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/.test(value)
      ? new Date(value) : value
  )
});

// Create indexes for faster queries
coupletsDb.ensureIndex({ fieldName: 'number', unique: true });
coupletsDb.ensureIndex({ fieldName: 'chapter.number' });
coupletsDb.ensureIndex({ fieldName: 'section.number' });
coupletsDb.ensureIndex({ fieldName: 'division.number' });

// Load all metadata
let divisionsData;
let sectionsData;
let chaptersData;
let coupletsData;
let translationsData = {};
let translatorsMetadata = [];

async function loadMetadata() {
  const [divisionsFile, sectionsFile, chaptersFile, coupletsFile] = await Promise.all([
    fs.readFile(path.join(DATA_DIR, 'divisions.yml'), 'utf8'),
    fs.readFile(path.join(DATA_DIR, 'sections.yml'), 'utf8'),
    fs.readFile(path.join(DATA_DIR, 'chapters.yml'), 'utf8'),
    fs.readFile(path.join(DATA_DIR, 'couplets.yml'), 'utf8')
  ]);

  divisionsData = yaml.load(divisionsFile).divisions;
  sectionsData = yaml.load(sectionsFile).sections;
  chaptersData = yaml.load(chaptersFile).chapters;
  coupletsData = yaml.load(coupletsFile).couplets;

  console.log('Loaded divisions, sections, chapters, and couplets metadata');
  console.log(`Total couplets loaded: ${Object.keys(coupletsData).length}`);
}

async function loadTranslations() {
  console.log('Loading translations from:', TRANSLATIONS_DIR);

  try {
    await fs.access(TRANSLATIONS_DIR);
  } catch (err) {
    console.log('Translations directory not found, skipping translation loading');
    return;
  }

  const languages = ['en', 'hi', 'ta'];

  for (const lang of languages) {
    const langDir = path.join(TRANSLATIONS_DIR, lang);

    try {
      const files = await fs.readdir(langDir);
      const yamlFiles = files.filter(file => file.endsWith('.yml'));

      console.log(`Found ${yamlFiles.length} translation files for ${lang}`);

      for (const file of yamlFiles) {
        const filePath = path.join(langDir, file);
        const content = await fs.readFile(filePath, 'utf8');
        const data = yaml.load(content);

        const translator = data.translator || data.commentator;
        if (translator) {
          translatorsMetadata.push({
            ...translator,
            language: lang
          });

          const translations = data.translations || data.interpretations;
          if (translations) {
            translationsData[translator.id] = {
              translator: translator,
              translations: translations,
              language: lang
            };

            console.log(`Loaded ${Object.keys(translations).length} translations from ${translator.name}`);
          }
        }
      }
    } catch (err) {
      console.log(`No translations found for ${lang}:`, err.message);
    }
  }

  console.log(`Total translators loaded: ${translatorsMetadata.length}`);
}

async function processCouplet(coupletNumber, coupletLines) {
  try {
    console.log(`Processing couplet ${coupletNumber}`);

    // Validate couplet data (should be array of 2 lines)
    if (!Array.isArray(coupletLines) || coupletLines.length !== 2) {
      throw new Error(`Invalid couplet data for ${coupletNumber}: Expected array of 2 lines`);
    }

    // Find which chapter this couplet belongs to by checking couplet_range
    let chapterNumber, chapterData, sectionNumber, sectionData, divisionNumber, divisionData;

    for (const [chapNum, chapData] of Object.entries(chaptersData)) {
      const [start, end] = chapData.couplet_range;
      if (coupletNumber >= start && coupletNumber <= end) {
        chapterNumber = parseInt(chapNum);
        chapterData = chapData;
        sectionNumber = chapData.section_number;
        divisionNumber = chapData.division_number;
        sectionData = sectionsData[sectionNumber];
        divisionData = divisionsData[divisionNumber];
        break;
      }
    }

    if (!chapterData || !sectionData || !divisionData) {
      throw new Error(`Could not find chapter/section/division for couplet ${coupletNumber}`);
    }

    // Build translations object
    const translations = {};
    const tamilInterpretations = [];

    for (const [translatorId, translatorData] of Object.entries(translationsData)) {
      const coupletTranslation = translatorData.translations[coupletNumber];

      if (coupletTranslation) {
        const lang = translatorData.language;

        if (lang === 'ta') {
          tamilInterpretations.push({
            text: coupletTranslation.text,
            author: translatorData.translator.name,
            year: translatorData.translator.year
          });
        } else {
          if (!translations[lang]) {
            translations[lang] = [];
          }

          translations[lang].push({
            text: coupletTranslation.text,
            explanation: coupletTranslation.explanation || '',
            author: translatorData.translator.name,
            year: translatorData.translator.year
          });
        }
      }
    }

    const enrichedCouplet = {
      number: parseInt(coupletNumber),
      tamil: coupletLines,
      division: {
        number: divisionNumber,
        ...divisionData
      },
      section: {
        number: sectionNumber,
        ...sectionData
      },
      chapter: {
        number: chapterNumber,
        ...chapterData
      },
      translations: translations,
      tamil_interpretations: tamilInterpretations,
      metadata: {
        last_updated: new Date().toISOString(),
        source: 'build-db.js'
      }
    };

    return new Promise((resolve, reject) => {
      coupletsDb.insert(enrichedCouplet, (err, newDoc) => {
        if (err) {
          console.error('Database insert error:', err);
          reject(err);
        } else {
          resolve(newDoc);
        }
      });
    });
  } catch (err) {
    console.error(`Error processing couplet ${coupletNumber}:`, err);
    throw err;
  }
}

async function buildDatabase() {
  try {
    await loadMetadata();
    await loadTranslations();

    console.log('Loaded all metadata and translations');

    await new Promise((resolve, reject) => {
      coupletsDb.remove({}, { multi: true }, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    console.log('Building database from couplets...');

    const coupletNumbers = Object.keys(coupletsData);
    for (const coupletNumber of coupletNumbers) {
      await processCouplet(coupletNumber, coupletsData[coupletNumber]);
    }

    console.log('Database built successfully!');
    console.log(`Total couplets: ${coupletNumbers.length}`);
    console.log(`Total translators: ${translatorsMetadata.length}`);

    coupletsDb.persistence.compactDatafile();

  } catch (err) {
    console.error('Error building database:', err);
    process.exit(1);
  }
}

buildDatabase();