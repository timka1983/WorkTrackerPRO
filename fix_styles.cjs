const fs = require('fs');
const path = require('path');

const dirs = ['./components', './'];
const filesToProcess = [];

function findFiles(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (dir === './') continue; // Don't recurse root
      findFiles(fullPath);
    } else if (fullPath.endsWith('.tsx')) {
      filesToProcess.push(fullPath);
    }
  }
}

dirs.forEach(findFiles);

const replacements = [
  { regex: /shadow-sm(?!\s+dark:shadow)/g, replace: 'shadow-md dark:shadow-slate-900/20' },
  { regex: /shadow-md(?!\s+dark:shadow)/g, replace: 'shadow-lg dark:shadow-slate-900/20' },
  { regex: /shadow-lg(?!\s+dark:shadow)/g, replace: 'shadow-xl dark:shadow-slate-900/20' },
  { regex: /shadow-xl(?!\s+dark:shadow)/g, replace: 'shadow-2xl dark:shadow-slate-900/20' },
  { regex: /shadow-2xl(?!\s+dark:shadow)/g, replace: 'shadow-2xl dark:shadow-slate-900/40' },
  
  { regex: /text-slate-500(?!\s+dark:text-slate)/g, replace: 'text-slate-500 dark:text-slate-400' },
  { regex: /text-slate-600(?!\s+dark:text-slate)/g, replace: 'text-slate-600 dark:text-slate-300' },
  { regex: /text-slate-700(?!\s+dark:text-slate)/g, replace: 'text-slate-700 dark:text-slate-200' },
  { regex: /text-slate-800(?!\s+dark:text-slate)/g, replace: 'text-slate-800 dark:text-slate-100' },
  { regex: /text-slate-900(?!\s+dark:text-slate)/g, replace: 'text-slate-900 dark:text-slate-50' },
  
  { regex: /text-blue-600(?!\s+dark:text-blue)/g, replace: 'text-blue-600 dark:text-blue-400' },
  { regex: /text-blue-700(?!\s+dark:text-blue)/g, replace: 'text-blue-700 dark:text-blue-300' },
  { regex: /text-indigo-600(?!\s+dark:text-indigo)/g, replace: 'text-indigo-600 dark:text-indigo-400' },
  { regex: /text-green-600(?!\s+dark:text-green)/g, replace: 'text-green-600 dark:text-green-400' },
  { regex: /text-red-600(?!\s+dark:text-red)/g, replace: 'text-red-600 dark:text-red-400' },
  { regex: /text-amber-600(?!\s+dark:text-amber)/g, replace: 'text-amber-600 dark:text-amber-400' },
  { regex: /text-emerald-600(?!\s+dark:text-emerald)/g, replace: 'text-emerald-600 dark:text-emerald-400' },
  { regex: /text-rose-600(?!\s+dark:text-rose)/g, replace: 'text-rose-600 dark:text-rose-400' },
];

let changedFiles = 0;

for (const file of filesToProcess) {
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;
  
  for (const { regex, replace } of replacements) {
    content = content.replace(regex, replace);
  }
  
  if (content !== originalContent) {
    fs.writeFileSync(file, content, 'utf8');
    changedFiles++;
    console.log(`Updated ${file}`);
  }
}

console.log(`Done. Changed ${changedFiles} files.`);
