const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const dbPath = path.join(__dirname, '..', 'data', 'thirukkural.db');

// Check if database exists
if (!fs.existsSync(dbPath)) {
  console.log('Database not found, building...');
  try {
    execSync('npm run build:db', { stdio: 'inherit' });
    console.log('Database built successfully');
  } catch (err) {
    console.error('Failed to build database:', err);
    process.exit(1);
  }
} else {
  console.log('Database already exists');
}
