'use strict';


/**
* Url
*
* This util class allows to split up urls
* into path and param information. The url
* must be formated in the following way:
* [/]path/path2[/]?key=val&key2=val
*/
class Url {

  constructor(urlString) {
    // Store a copy of the string
    this.string = urlString || '';
    // Store the path
    this.path = [];
    urlString.split('?')[0].split('/').forEach(part => {
      if (typeof part === 'string' && part !== '') this.path.push(part);
    });
    // Store the key / value request data
    this.data = {};
    this.dataKeys = [];
    if (urlString.indexOf('?') !== -1) {
      urlString.split('?')[1].split('&').forEach(part => {
        let set = part.split('=');
        if (set.length === 2 && set[0] !== '' && this.dataKeys.indexOf(set[0]) === -1) {
          this.data[set[0]] = set[1];
          this.dataKeys.push(set[0]);
        }
      });
    }
  }

  /**
  * hasData() tests if
  * the url had data attached.
  */
  get hasData() {
    return this.dataKeys.length > 0;
  }

}

// Export
module.exports = Url;
