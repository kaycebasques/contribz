// TODO ignore stuff before first quarter of web.dev launch
// TODO Make a note that it's a rough estimate and explain edge cases
// e.g. web.dev/covid19 actually had lots of authors

const puppeteer = require('puppeteer');
const xml2js = require('xml2js');
const axios = require('axios');
const fs = require('fs');
const exceptions = require('./exceptions.json');

async function date(page) {
  const dateNode = await page.$('.w-author__published time');
  if (!dateNode) return null;
  const dateTextContent = await dateNode.getProperty('textContent');
  if (!dateTextContent) return null;
  const dateValue = await dateTextContent.jsonValue();
  if (!dateValue) return null;
  return dateValue;
}

function categorize(data, report) {
  function update(year, quarter) {
    if (!report.data[year][quarter]) report.data[year][quarter] = { authors: [], urls: [] };
    report.data[year][quarter].urls.push(data);
    data.authors.forEach(author => {
      if (!report.data[year][quarter].authors.includes(author)) report.data[year][quarter].authors.push(author);
    });
  }
  const date = new Date(data.date);
  const year = date.getFullYear();
  if (!report.data[year]) report.data[year] = {};
  const month = date.getMonth();
  switch (month) {
    case 0:
    case 1:
    case 2:
      update(year, 'Q1');
      break;
    case 3:
    case 4:
    case 5:
      update(year, 'Q2');
      break;
    case 6:
    case 7:
    case 8:
      update(year, 'Q3');
      break;
    case 9:
    case 10:
    case 11:
      update(year, 'Q4');
      break;
  }
  return report;
}

async function authors(page) {
  const data = [];
  const authorNodes = await page.$$('.w-author__name-link');
  for (let i = 0; i < authorNodes.length; i++) { 
    const authorNode = authorNodes[i];
    if (!authorNode) continue;
    const href = await authorNode.getProperty('href');
    if (!href) continue;
    const value = await href.jsonValue();
    if (!value) continue;
    if (!value.includes('https://web.dev/authors/')) {
      throw `Invalid author URL: ${value}`;
    }
    data.push(value.replace('https://web.dev/authors/', ''));
  };
  return data;
}

async function content(page) {
  const codelabNode = await page.$('web-codelab');
  const postNode = await page.$('.w-post-content');
  const valid = codelabNode || postNode;
  return valid;
}

function exclude(url) {
  let target = new URL(url).pathname.replace(/\//g, '');
  for (page in exceptions) {
    if (page === target && exceptions[page].ignore) return true;
  }
  return false;
}

(async () => {
  try {
    const browser = await puppeteer.launch({
      args: ['--no-sandbox']
    });
    const page = await browser.newPage();
    const response = await axios.get('https://web.dev/sitemap.xml');
    const json = await xml2js.parseStringPromise(response.data);
    const authorsList = [];
    let report = {
      data: {},
      ignored: {
        authorless: [],
        noncontent: []
      }
    };
    // for (let i = 300; i < 400; i++) {
    for (let i = 0; i < json.urlset.url.length; i++) {
      const url = json.urlset.url[i].loc[0];
      if (exclude(url)) continue;
      console.info(`Scraping ${url} (${i + 1} of ${json.urlset.url.length})`);
      await page.goto(url, {
        waitUntil: 'networkidle2'
      });
      const valid = await content(page);
      if (!valid) {
        report.ignored.noncontent.push(url);
        continue;
      }
      const pageAuthors = await authors(page);
      if (pageAuthors.length === 0) {
        report.ignored.authorless.push(url);
        continue;
      }
      const data = {
        date: await date(page), 
        authors: pageAuthors,
        url
      };
      report = categorize(data, report);
      //report.push(data);
      // pageAuthors.forEach(author => {
      //   if (!authorsList.includes(author)) {
      //     authorsList.push(author);
      //     //console.log('new author:', author);
      //   }
      // });
    }
    let output = '# report\n\n';
    const [m, d, y] = (new Date()).toLocaleDateString().split("/");
    output += `Auto-generated on ${y}/${m}/${d} (YYYY/MM/DD)\n\n`;
    output += '## summary\n\n';
    for (year in report.data) {
      for (quarter in report.data[year]) {
        output += `* ${year} ${quarter}\n`;
        output += `  * authors: ${report.data[year][quarter].authors.length}\n`;
        output += `  * pages: ${report.data[year][quarter].urls.length}\n`;
      }
    }
    output += '\n## details\n';
    for (year in report.data) {
      for (quarter in report.data[year]) {
        output += `\n### ${year} ${quarter}\n\n`;
        report.data[year][quarter].urls.forEach(url => {
          output += `* ${url.url}\n`;
          url.authors.forEach(author => output += `  * ${author}\n`);
        });
      }
    }
    output += '\n## ignored\n\n### author-less\n\n';
    output += 'The following pages were ignored because they do not have authors:\n\n';
    report.ignored.authorless.forEach(url => {
      output += `* ${url}\n`;
    });
    output += '\n### non-content\n\n';
    output += 'The following pages were ignored because they are not content pages:\n\n';
    report.ignored.noncontent.forEach(url => {
      output += `* ${url}\n`;
    });
    output += '\n### exceptions\n\n';
    output += 'The following pages were included or ignored for special reasons:\n\n';
    for (exception in exceptions) {
      const info = exceptions[exception];
      output += `* https://web.dev/${exception}\n`
      output += `  * ${info.ignore === true ? 'ignored' : 'included'}\n`;
      output += `  * ${info.message}\n`;
    }
    fs.writeFileSync('report.md', output);
    await browser.close();
  } catch (error) {
    console.error(error);
  }
})();