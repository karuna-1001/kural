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
const COUPLETS_DIR = path.join(DATA_DIR, 'couplets');
const DB_PATH = path.join(DATA_DIR, 'thirukkural.db');

// Initialize NeDB with options
const db = new Datastore({ 
  filename: DB_PATH,
  autoload: true,
  timestampData: true,
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

// Create indexes for faster queries
db.ensureIndex({ fieldName: 'number', unique: true });
db.ensureIndex({ fieldName: 'chapter_number' });
db.ensureIndex({ fieldName: 'section_number' });
db.ensureIndex({ fieldName: 'division_number' });

// Load all metadata
let divisionsData;
let sectionsData;
let chaptersData;

async function loadMetadata() {
  const [divisionsFile, sectionsFile, chaptersFile] = await Promise.all([
    fs.readFile(path.join(DATA_DIR, 'divisions.yml'), 'utf8'),
    fs.readFile(path.join(DATA_DIR, 'sections.yml'), 'utf8'),
    fs.readFile(path.join(DATA_DIR, 'chapters.yml'), 'utf8')
  ]);
  
  divisionsData = yaml.load(divisionsFile).divisions;
  sectionsData = yaml.load(sectionsFile).sections;
  chaptersData = yaml.load(chaptersFile).chapters;
}

async function processCouplet(filePath) {
  try {
    console.log(`Processing couplet file: ${filePath}`);
    const content = await fs.readFile(filePath, 'utf8');
    let coupletData;
    
    try {
      coupletData = yaml.load(content);
      console.log('YAML parsed successfully');
    } catch (yamlError) {
      console.error('YAML parsing error:', yamlError);
      throw yamlError;
    }

    if (!coupletData || !coupletData.couplet) {
      throw new Error(`Invalid couplet data in ${filePath}: Missing couplet root object`);
    }

    const couplet = coupletData.couplet;
    
    // Convert ISO date strings to Date objects
    if (couplet.metadata?.last_updated) {
      couplet.metadata.last_updated = new Date(couplet.metadata.last_updated);
    }
    
    // Validate required fields
    if (!couplet.number || !couplet.division_number || !couplet.section_number || !couplet.chapter_number) {
      throw new Error(`Missing required fields in couplet ${filePath}`);
    }
    
    console.log(`Enriching couplet ${couplet.number} with metadata`);
    
    // Enrich couplet with division, section and chapter data
    const division = divisionsData[couplet.division_number];
    const section = sectionsData[couplet.section_number];
    const chapter = chaptersData[couplet.chapter_number];

    if (!division || !section || !chapter) {
      throw new Error(`Invalid division, section or chapter number in couplet ${couplet.number}`);
    }

    console.log('Creating enriched couplet object');
    const enrichedCouplet = {
      ...couplet,
      division: {
        number: couplet.division_number,
        ...division
      },
      section: {
        number: couplet.section_number,
        ...section
      },
      chapter: {
        number: couplet.chapter_number,
        ...chapter
      }
    };

    // Remove the redundant fields
    delete enrichedCouplet.division_number;
    delete enrichedCouplet.section_number;
    delete enrichedCouplet.chapter_number;
    
    console.log('Storing couplet in database:', enrichedCouplet.number);
    
    // Insert as new document instead of update
    return new Promise((resolve, reject) => {
      db.insert(enrichedCouplet, (err, newDoc) => {
        if (err) {
          console.error('Database insert error:', err);
          reject(err);
        } else {
          console.log('Successfully stored couplet:', newDoc.number);
          resolve(newDoc);
        }
      });
    });
  } catch (err) {
    console.error(`Error processing ${filePath}:`, err);
    throw err;
  }
}

async function buildDatabase() {
  try {
    // Load metadata first
    await loadMetadata();
    console.log('Loaded sections and chapters metadata');

    // Clear the database
    await new Promise((resolve, reject) => {
      db.remove({}, { multi: true }, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Read all YAML files from the couplets directory
    const files = await fs.readdir(COUPLETS_DIR);
    const coupletFiles = files.filter(file => file.endsWith('.yml'));

    console.log(`Found ${coupletFiles.length} couplet files`);

    // Process each file
    for (const file of coupletFiles) {
      await processCouplet(path.join(COUPLETS_DIR, file));
    }

    console.log('Database built successfully!');

    // Compact the database
    db.persistence.compactDatafile();

  } catch (err) {
    console.error('Error building database:', err);
    process.exit(1);
  }
}

buildDatabase();