const puppeteer = require('puppeteer');
const xml2js = require('xml2js');
const axios = require('axios');

const ignore = [
  'https://web.dev/pl/'
]

(async () => {
  try {
    const browser = await puppeteer.launch({
      args: ['--no-sandbox']
    });
    const page = await browser.newPage();
    const response = await axios.get('https://web.dev/sitemap.xml');
    const json = await xml2js.parseStringPromise(response.data);
    const report = [];
    for (let i = 0; i < json.urlset.url.length; i++) {
      const url = `https://web.dev${json.urlset.url[i].loc[0]}`;
      const data = {authors: [], date: undefined, url};
      await page.goto(url, {
        waitUntil: 'networkidle2'
      });
      const dateNode = await page.$('.w-author__published time');
      if (!dateNode) continue;
      const dateTextContent = await dateNode.getProperty('textContent');
      if (!dateTextContent) continue;
      const dateValue = await dateTextContent.jsonValue();
      if (!dateValue) continue;
      data.date = dateValue;
      // new
      const authorNodes = await page.$$('.w-author__name-link');
      for (let j = 0; j < authorNodes.length; j++) { 
        const authorNode = authorNodes[j];
        if (!authorNode) continue;
        const href = await authorNode.getProperty('href');
        if (!href) continue;
        const value = await href.jsonValue();
        if (!value) continue;
        data.authors.push(value);
      };
      console.log(data);
    }
    await browser.close();
  } catch (error) {
    console.log(error);
  }
})();