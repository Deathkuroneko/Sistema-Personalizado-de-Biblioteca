const fs = require('fs');
const path = require('path');
const attDir = path.join(process.env.USERPROFILE || process.env.HOME, 'Documents', 'DevSnippets', 'attachments');
let prev = null;

function snapshot() {
  try {
    if (!fs.existsSync(attDir)) return null;
    return new Set(fs.readdirSync(attDir));
  } catch (e) {
    console.error('snapshot error', e.message);
    return null;
  }
}

console.log('Watching attachments dir:', attDir);
setInterval(() => {
  try {
    const cur = snapshot();
    if (!cur) return;
    if (!prev) {
      prev = cur;
      console.log('Initial attachments snapshot:', [...cur].length, 'files');
      return;
    }
    // detect removals
    for (const f of prev) {
      if (!cur.has(f)) console.log(new Date().toISOString(), 'ATTACHMENT REMOVED:', f);
    }
    for (const f of cur) {
      if (!prev.has(f)) console.log(new Date().toISOString(), 'ATTACHMENT ADDED:', f);
    }
    prev = cur;
  } catch (e) {
    console.error('watch error', e.message);
  }
}, 1500);
