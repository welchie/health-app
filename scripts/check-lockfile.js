const fs = require('fs');
const path = require('path');

const lockfilePath = path.join(__dirname, '../package-lock.json');
const forbiddenHost = 'artifacts.livingwith.net';

function isForbiddenHost(hostname) {
  return hostname === forbiddenHost || hostname.endsWith(`.${forbiddenHost}`);
}

function containsForbiddenRegistryUrl(value) {
  if (typeof value === 'string') {
    try {
      const parsed = new URL(value);
      return isForbiddenHost(parsed.hostname);
    } catch (e) {
      return false;
    }
  }

  if (Array.isArray(value)) {
    return value.some(containsForbiddenRegistryUrl);
  }

  if (value && typeof value === 'object') {
    return Object.values(value).some(containsForbiddenRegistryUrl);
  }

  return false;
}

if (fs.existsSync(lockfilePath)) {
  const content = fs.readFileSync(lockfilePath, 'utf8');
  let lockfile;

  try {
    lockfile = JSON.parse(content);
  } catch (e) {
    console.error('\x1b[31mError: package-lock.json is not valid JSON.\x1b[0m');
    process.exit(1);
  }

  if (containsForbiddenRegistryUrl(lockfile)) {
    console.error('\x1b[31mError: package-lock.json contains forbidden registry URL (artifacts.livingwith.net).\x1b[0m');
    process.exit(1);
  }
  console.log('\x1b[32mpackage-lock.json check passed: no forbidden registry URLs found.\x1b[0m');
} else {
  console.log('No package-lock.json found to check.');
}
