#!/usr/bin/env node
/* Simple generator for requirement/design/task markdown files */
const fs = require('fs');
const path = require('path');

const [,, kind, slugOrParent, maybeSlug] = process.argv;
if(!kind || !['req','design','task'].includes(kind)) {
  console.error('Usage: new.js <req|design|task> <slug|REQ-ID> [slug]');
  process.exit(1);
}

function randSeq(){return Math.floor(Math.random()*9000+1000);}
const year = new Date().getFullYear();

function ensureDir(p){ if(!fs.existsSync(p)) fs.mkdirSync(p,{recursive:true}); }

const root = process.cwd();
const docsDir = path.join(root,'docs');
ensureDir(docsDir);

if(kind==='req') {
  const slug = slugOrParent || 'feature';
  const id = `REQ-${year}-${randSeq()}`;
  const dir = path.join(docsDir,'requirements'); ensureDir(dir);
  const file = path.join(dir, `${id}-${slug}.md`);
  const content = `---\nid: ${id}\nstatus: draft\nproblem: \nmetrics: []\nrisks: []\n---\n# ${id} ${slug}\n`;
  fs.writeFileSync(file, content); console.log(file); process.exit(0);
}

if(kind==='design') {
  const reqId = slugOrParent; if(!reqId) { console.error('Need requirement id'); process.exit(1);} 
  const id = `DES-${year}-${randSeq()}`;
  const dir = path.join(docsDir,'designs'); ensureDir(dir);
  const file = path.join(dir, `${id}.md`);
  const content = `---\nid: ${id}\nrequirement: ${reqId}\nstatus: draft\ndecisions: []\n---\n# ${id}\n`;
  fs.writeFileSync(file, content); console.log(file); process.exit(0);
}

if(kind==='task') {
  const reqId = slugOrParent; const slug = maybeSlug || 'task'; if(!reqId){ console.error('Need requirement id'); process.exit(1);} 
  const id = `TASK-${year}-${randSeq()}`;
  const dir = path.join(docsDir,'tasks'); ensureDir(dir);
  const file = path.join(dir, `${id}-${slug}.md`);
  const content = `---\nid: ${id}\nrequirement: ${reqId}\ndesign: \nstatus: todo\nacceptance: []\n---\n# ${id} ${slug}\n`;
  fs.writeFileSync(file, content); console.log(file); process.exit(0);
}
