const fs = require('fs');
const path = require('path');

const lockfilePath = path.join(__dirname, '../package-lock.json');

if (fs.existsSync(lockfilePath)) {
  const content = fs.readFileSync(lockfilePath, 'utf8');
  if (content.includes('artifacts.livingwith.net')) {
    console.error('\x1b[31mError: package-lock.json contains forbidden registry URL (artifacts.livingwith.net).\x1b[0m');
    process.exit(1);
  }
  console.log('\x1b[32mpackage-lock.json check passed: no forbidden registry URLs found.\x1b[0m');
} else {
  console.log('No package-lock.json found to check.');
}
