#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const targetDir = path.join(__dirname, '../src');
const dryRun = process.argv.includes('--dry-run');

function getAllFiles(dirPath, arrayOfFiles) {
  if (!fs.existsSync(dirPath)) return [];
  const files = fs.readdirSync(dirPath);
  arrayOfFiles = arrayOfFiles || [];

  files.forEach(function(file) {
    if (fs.statSync(dirPath + "/" + file).isDirectory()) {
      arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles);
    } else {
      if (file.endsWith('.js') || file.endsWith('.jsx') || file.endsWith('.ts') || file.endsWith('.tsx')) {
        arrayOfFiles.push(path.join(dirPath, "/", file));
      }
    }
  });

  return arrayOfFiles;
}

const files = getAllFiles(targetDir);
let totalFilesChanged = 0;

console.log(`Scanning ${files.length} files in ${targetDir}...`);

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  
  // Regex explanation:
  // console\.log\s*\(    : matches "console.log" followed by optional space and opening paren
  // (?:                  : non-capturing group for the content inside parens
  //   [^()]*             : matches any char except parens
  //   |                  : or
  //   \((?:[^()]*|\([^()]*\))*\) : matches balanced nested parens (up to 1 level deep)
  // )*                   : repeat for complex expressions
  // \)                   : matching closing paren
  // \s*;?                : optional trailing space and semicolon
  const logRegex = /console\.log\s*\((?:[^()]*|\((?:[^()]*|\([^()]*\))*\))*\)\s*;?/g;

  const newContent = content.replace(logRegex, '');

  if (content !== newContent) {
    totalFilesChanged++;
    if (!dryRun) {
      fs.writeFileSync(file, newContent, 'utf8');
      console.log(`[CLEANED] ${path.relative(targetDir, file)}`);
    } else {
      console.log(`[DRY RUN] Would clean: ${path.relative(targetDir, file)}`);
    }
  }
});

if (dryRun) {
  console.log(`\nDRY RUN COMPLETE. ${totalFilesChanged} files would be modified.`);
} else {
  console.log(`\nCLEANUP COMPLETE. ${totalFilesChanged} files were modified.`);
}
