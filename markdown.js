const config = require('./config.json');
const yamlParser = require('markdown-yaml-metadata-parser');
const { resolve } = require('path');
const { readdir, readFile, writeFile } = require('fs').promises;

// https://stackoverflow.com/a/45130990
async function getFiles(dir) {
  const dirents = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(dirents.map((dirent) => {
    const res = resolve(dir, dirent.name);
    return dirent.isDirectory() ? getFiles(res) : res;
  }));
  return Array.prototype.concat(...files);
}

async function test() {
  const files = await getFiles(`${config.path}/src/site/content/en`);
  const markdown = files.filter(file => file.endsWith('index.md'));
  const data = {};
  await Promise.all(markdown.map(async file => {
    const content = await readFile(file, 'utf8');
    const metadata = yamlParser(content).metadata;
    data[file] = metadata;
    return Promise.resolve();
  }));
  let output = 'URL|Pageviews|Avg. Time On Page|Authors|Tags|Date|Updated\n';
  for (file in data) {
    const target = data[file];
    const end = file.indexOf('/index.md');
    const start = file.substring(0, end).lastIndexOf('/') + 1;
    let id = file.substring(start);
    id = id.substring(0, id.lastIndexOf('/index.md'));
    let values = [];
    values.push(`=HYPERLINK("https://web.dev/${id}", "/${id}/")`);
    values.push('');
    values.push('');
    target.authors ? values.push(`${target.authors.join(',')}`) : values.push('');
    target.tags ? values.push(`${target.tags.join(',')}`) : values.push('');
    target.date ? values.push(`${new Date(target.date).toISOString().split('T')[0]}`) : values.push('');
    target.updated ? values.push(`${new Date(target.updated).toISOString().split('T')[0]}`) : values.push('');
    output += `${values.join('|')}\n`;
  }
  writeFile('results.csv', output);
  // const output = {};
  // for (file in data) {
  //   const end = file.indexOf('/index.md');
  //   const start = file.substring(0, end).lastIndexOf('/') + 1;
  //   let id = file.substring(start);
  //   id = id.substring(0, id.lastIndexOf('/index.md'));
  //   output[id] = {};
  //   if (data[file].title) output[id].title = data[file].title;
  //   if (data[file].authors) output[id].authors = data[file].authors;
  //   if (data[file].date) output[id].date = data[file].date;
  //   if (data[file].updated) output[id].updated = data[file].updated;
  //   if (data[file].tags) output[id].tags = data[file].tags;
  // }
  // writeFile('results.json', JSON.stringify(output, null, 2));
}

test();