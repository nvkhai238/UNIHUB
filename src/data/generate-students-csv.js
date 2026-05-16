#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);

function getArg(name, defaultValue) {
  const index = args.findIndex((arg) => arg === `--${name}`);
  if (index === -1 || index === args.length - 1) return defaultValue;
  return args[index + 1];
}

const count = Number(getArg('count', 200));
const startId = Number(getArg('startId', 22000001));
const output = getArg('output', `students_${new Date().toISOString().slice(0, 10)}.csv`);

if (!Number.isInteger(count) || count <= 0) {
  console.error('Invalid --count. It must be a positive integer.');
  process.exit(1);
}

if (!Number.isInteger(startId) || startId < 0) {
  console.error('Invalid --startId. It must be a non-negative integer.');
  process.exit(1);
}

const rows = ['student_id,full_name,email'];

for (let i = 0; i < count; i++) {
  const studentNumber = startId + i;
  const studentId = String(studentNumber).padStart(8, '0');
  const fullName = `Sinh Vien ${i + 1}`;
  const email = `${studentId}@student.unihub.vn`;
  rows.push(`${studentId},${fullName},${email}`);
}

const outputPath = path.resolve(process.cwd(), output);
fs.writeFileSync(outputPath, `${rows.join('\n')}\n`, 'utf8');

console.log(`Generated ${count} students at: ${outputPath}`);
