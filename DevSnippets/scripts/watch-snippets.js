const fs = require('fs');
const path = require('path');
const filePath = path.join(process.env.USERPROFILE || process.env.HOME, 'Documents', 'DevSnippets', 'snippets.json');
let prev = null;

function indexDB(db) {
  const map = { snippets: {}, cards: {} };
  (db.titles || []).forEach((t, tIdx) => {
    if (t.type === 'technical') {
      (t.categories || []).forEach((c, cIdx) => {
        (c.subtitles || []).forEach((s, sIdx) => {
          (s.snippets || []).forEach((sn, snIdx) => {
            map.snippets[sn.id] = { tIdx, cIdx, sIdx, snIdx, title: sn.title };
          });
        });
      });
    }
    if (t.type === 'media') {
      (t.collections || []).forEach((col, colIdx) => {
        (col.cards || []).forEach((card, cardIdx) => {
          map.cards[card.id] = { tIdx, colIdx, cardIdx, title: card.title };
        });
      });
    }
  });
  return map;
}

function showDiffs(prevMap, newMap) {
  const out = [];
  // snippets: detect moved or changed titles
  Object.keys(newMap.snippets).forEach(id => {
    const n = newMap.snippets[id];
    const p = prevMap && prevMap.snippets[id];
    if (!p) {
      out.push(`SNIPPET ADDED: ${id} @ ${n.tIdx}/${n.cIdx}/${n.sIdx}/${n.snIdx} (${n.title})`);
    } else if (p.tIdx!==n.tIdx || p.cIdx!==n.cIdx || p.sIdx!==n.sIdx || p.snIdx!==n.snIdx) {
      out.push(`SNIPPET MOVED: ${id} from ${p.tIdx}/${p.cIdx}/${p.sIdx}/${p.snIdx} -> ${n.tIdx}/${n.cIdx}/${n.sIdx}/${n.snIdx} (${n.title})`);
    }
  });
  Object.keys(prevMap ? prevMap.snippets : {}).forEach(id => {
    if (!newMap.snippets[id]) out.push(`SNIPPET REMOVED: ${id} from ${prevMap.snippets[id].tIdx}/${prevMap.snippets[id].cIdx}/${prevMap.snippets[id].sIdx}/${prevMap.snippets[id].snIdx} (${prevMap.snippets[id].title})`);
  });

  // cards
  Object.keys(newMap.cards).forEach(id => {
    const n = newMap.cards[id];
    const p = prevMap && prevMap.cards[id];
    if (!p) {
      out.push(`CARD ADDED: ${id} @ ${n.tIdx}/${n.colIdx}/${n.cardIdx} (${n.title})`);
    } else if (p.tIdx!==n.tIdx || p.colIdx!==n.colIdx || p.cardIdx!==n.cardIdx) {
      out.push(`CARD MOVED: ${id} from ${p.tIdx}/${p.colIdx}/${p.cardIdx} -> ${n.tIdx}/${n.colIdx}/${n.cardIdx} (${n.title})`);
    }
  });
  Object.keys(prevMap ? prevMap.cards : {}).forEach(id => {
    if (!newMap.cards[id]) out.push(`CARD REMOVED: ${id} from ${prevMap.cards[id].tIdx}/${prevMap.cards[id].colIdx}/${prevMap.cards[id].cardIdx} (${prevMap.cards[id].title})`);
  });

  if (out.length>0) console.log(new Date().toISOString(), '\n', out.join('\n'));
}

console.log('Watching', filePath);
setInterval(() => {
  try {
    if (!fs.existsSync(filePath)) return;
    const raw = fs.readFileSync(filePath, 'utf8');
    const db = JSON.parse(raw);
    const map = indexDB(db);
    if (!prev) {
      prev = map;
      console.log('Initial snapshot taken');
    } else {
      showDiffs(prev, map);
      prev = map;
    }
  } catch (e) {
    console.error('Watcher error', e.message);
  }
}, 1500);
