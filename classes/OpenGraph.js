'use strict';


// Imports
const http = require('http');
const https = require('https');
const Log = require('./Log.js');


/**
* OpenGraph
*
* This class implements a simple open graph / twitter cards
* parser to generate previews for urls.
* It is also capable to extract urls from a string and asses
* the imprtance of each url (it will only check the most
* important one for open graph content).
*/
class OpenGraph {

  /**
  * decodeHtml() is a helper
  * function that replaces any
  * html formattet chars.
  *
  * @param {string} html
  * @return {string}
  */
  static decodeHtml(html) {
    const entities = [
      ['amp', '&'],
      ['apos', '\''],
      ['#x27', '\''],
      ['#x2F', '/'],
      ['#39', '\''],
      ['#47', '/'],
      ['lt', '<'],
      ['gt', '>'],
      ['nbsp', ' '],
      ['quot', '"']
    ];
    for (let i = 0, max = entities.length; i < max; ++i) {
      html = html.replace(new RegExp('&'+entities[i][0]+';', 'g'), entities[i][1]);
    }
    return html;
  }

  /**
  * findVal() is an internal
  * function used to find an
  * open embed value in an html
  * string.
  *
  * @param {string} name
  * @param {string} html
  * @return {string} content of vali of false if none
  */
  static findVal(name, html) {
    // This regexp matches the html tag
    const tags = RegExp(`<meta\\s+[^>]*((property)|(name))=["']((og)|(twitter)):${ ''.concat(name) }["']\\s+[^>]*\\s*\\/?>`, 'i').exec(''.concat(html));
    if (tags !== null) {
      // Find the value of the (first) found tag
      const values = /content=["'].*["']/i.exec(tags[0]);
      if (values !== null) {
        // Get the value and return it, this imposes the limit of 1000 chars per value
        const value = this.decodeHtml(values[0].substr(9, values[0].length - 10).substr(0, 1000));
        if (value.length > 0) return value;
      }
    }
    // No value could be found
    return false;
  }

  /**
  * findTitle() is an internal
  * function used to find the
  * title tag in an html string.
  *
  * @param {string} html
  * @return {string} content of title tag or false
  */
  static findTitle(html) {
    // This regexp matches the html title tag
    const titleTag = /<title>.+<\/title>/i.exec(''.concat(html));
    if (titleTag !== null) {
      // Get the value and return it, this imposes the limit of 1000 chars per value
      const value = this.decodeHtml(titleTag[0].substr(7, titleTag[0].length - 15).substr(0, 100));
      if (value.length > 0) return value;
    }
    // No value could be found
    return false;
  }

  /**
  * parseHtml() will take
  * an html input and extract
  * any open graph data found.
  *
  * @param {string} html
  * @return {object} result { title, description*, image* } (*=optional) OR false if none found
  */
  static parseHtml(html) {
    // Find the supported values
    const title = this.findVal('title', html);
    const description = this.findVal('description', html);
    const image = this.findVal('image', html);
    // Test if the tags are sufficient
    if (title !== false) {
      let result = { title };
      // Add optional tags
      if (description !== false) result.description = description;
      if (image !== false) result.image = image;
      // Return the result
      return result;
    } else {
      // Try to find the standart html title tag
      const htmlTitle = this.findTitle(html);
      if (htmlTitle) {
        return { title: htmlTitle };
      }
    }
    // The html did not contain sufficent tags
    return false;
  }

  /**
  * crawlSite() will try to
  * fetch the html contents
  * of a given url and return
  * the embed-result in a callback.
  * TODO: Maybe impose a limit on the amount of data loaded?
  *
  * @param {string} url (must be http(s)://)
  * @param {function} callback
  * @param {number} redirectCount (optional, caps at 3)
  */
  static crawlSite(url, callback, redirectCount) {
    // Process redirect count
    if (typeof redirectCount !== 'number') {
      redirectCount = 0;
    } else if (redirectCount > 3) {
      // More than 3 redirects are not allowed, cancle the crawl
      callback(false);
      return;
    }
    // Retrive the html content of the url
    if (''.concat(url).substr(0, 7).toLowerCase() === 'http://' || ''.concat(url).substr(0, 8).toLowerCase() === 'https://') {
      // Make the request
      let req = (''.concat(url).substr(0, 7).toLowerCase() === 'http://' ? http : https).get(''.concat(url), res => {
        // Make sure this is a valid html document
        if (res.statusCode === 200 && /^text\/html/i.test(res.headers['content-type'])) {
          // Process the html content of the resource
          let html = '';
          res.setEncoding('utf8');
          res.on('data', chunk => html = html.concat(chunk));
          res.on('end', () => {
            // Parse the site for OpenGraph / Twitter card data
            let result = this.parseHtml(html);
            if (result !== false) result.url = ''.concat(url);
            callback(result);
          });
        } else if (res.statusCode > 300 && res.statusCode < 400) {
          // Get new url and consume the current response
          res.resume();
          const redirectUrl = ''.concat(res.headers['location']);
          // Validate th supplied url
          if (/^(https?:\/\/)?([\da-z\.-]{1,20}\.)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w\.\-\?\&\=\#]*)*$/i.test(redirectUrl)) {
            // Try a new crawl
            this.crawlSite(redirectUrl, callback, redirectCount + 1);
          } else {
            // Malformed redirect url
            callback(false);
          }
        } else {
          // The request has a problem to it, consume the response and fire callback
          res.resume();
          callback(false);
        }
      }).on('error', () => {
        // Something went wrong
        callback(false);
      });
      // Set (short) timeout
      req.setTimeout(3000, () => {
        // The timeout was reached
        callback(false);
      });
    } else {
      // Malformed url
      callback(false);
    }
  }


  /**
  * crawlFromString() takes a
  * string that may, or may not,
  * contain any number of urls.
  * It determines the most important
  * url and crawls it for embed
  * data. (currently the first).
  *
  * @param {string} text
  * @param {function} callback result { title, url, description*, image* } (*=optional) OR false if none found
  */
  static crawlFromString(text, callback) {
    // Find urls in text
    const urls = /(https?:\/\/)?([\da-z\.-]{1,20}\.)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w\.\-\?\&\=\#]*)*/i.exec(''.concat(text));
    if (urls !== null) {
      // Crawl the site
      this.crawlSite(''.concat(urls[0].substr(0, 4).toLowerCase() === 'http' ? '' : 'http://').concat(urls[0]), callback);
    } else {
      // No urls found
      callback(false);
    }
  }

}


// Exports
module.exports = OpenGraph;
