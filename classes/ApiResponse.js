'use strict';


/**
* ApiResponse
*
* This class provides util functions to create uniform,
* beautifull JSON api responses.
*/
class ApiResponse {

  /**
  * sendData() sends a
  * set of data to the
  * provided response object
  * and correctly formats all
  * headers.
  *
  * @param {http.ServerResponse} res
  * @param {any} data
  * @param {bool} error
  */
  static sendData(res, data = null, error = false) {
    // The var to hold the response body
    let responseBody = '';
    let responseError = !!error;
    // Construct the response body
    try {
      responseBody = JSON.stringify({
        error,
        data,
      });
    } catch (e) {
      responseBody = '{"error":true,"data":null}';
      responseError = false;
    }

    // Send the response
    res.writeHead(responseError ? 400 : 200, {
      'Content-type': 'application/json',
    });
    res.end(responseBody);
  }

}

module.exports = ApiResponse;
