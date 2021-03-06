/**
 * @license Copyright 2017 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
'use strict';

/* eslint-env mocha */

const ResponseCompression =
    require('../../../../gather/gatherers/dobetterweb/response-compression');
const assert = require('assert');
const mockDriver = require('../../fake-driver.js');

let options;
let responseCompression;
const traceData = {
  networkRecords: [
    {
      _url: 'http://google.com/index.js',
      _statusCode: 200,
      _mimeType: 'text/javascript',
      _requestId: 0,
      _resourceSize: 9,
      _transferSize: 10,
      _resourceType: {
        _isTextType: true,
      },
      _responseHeaders: [{
        name: 'Content-Encoding',
        value: 'gzip',
      }],
      content: 'aaabbbccc',
      finished: true,
    },
    {
      _url: 'http://google.com/index.css',
      _statusCode: 200,
      _mimeType: 'text/css',
      _requestId: 1,
      _resourceSize: 6,
      _transferSize: 7,
      _resourceType: {
        _isTextType: true,
      },
      _responseHeaders: [],
      content: 'abcabc',
      finished: true,
    },
    {
      _url: 'http://google.com/index.json',
      _statusCode: 200,
      _mimeType: 'application/json',
      _requestId: 2,
      _resourceSize: 7,
      _transferSize: 8,
      _resourceType: {
        _isTextType: true,
      },
      _responseHeaders: [],
      content: '1234567',
      finished: true,
    },
    {
      _url: 'http://google.com/index.json',
      _statusCode: 304, // ignore for being a cache not modified response
      _mimeType: 'application/json',
      _requestId: 22,
      _resourceSize: 7,
      _transferSize: 7,
      _resourceType: {
        _isTextType: true,
      },
      _responseHeaders: [],
      content: '1234567',
      finished: true,
    },
    {
      _url: 'http://google.com/other.json',
      _statusCode: 200,
      _mimeType: 'application/json',
      _requestId: 23,
      _resourceSize: 7,
      _transferSize: 8,
      _resourceType: {
        _isTextType: true,
      },
      _responseHeaders: [],
      content: '1234567',
      finished: false, // ignore for not finishing
    },
    {
      _url: 'http://google.com/index.jpg',
      _statusCode: 200,
      _mimeType: 'image/jpg',
      _requestId: 3,
      _resourceSize: 10,
      _transferSize: 10,
      _resourceType: {
        _isTextType: false,
      },
      _responseHeaders: [],
      content: 'aaaaaaaaaa',
      finished: true,
    },
    {
      _url: 'http://google.com/helloworld.mp4',
      _statusCode: 200,
      _mimeType: 'video/mp4',
      _requestId: 4,
      _resourceSize: 100,
      _transferSize: 100,
      _resourceType: {
        _isTextType: false,
      },
      _responseHeaders: [],
      content: 'bbbbbbbb',
      finished: true,
    },
  ],
};

describe('Optimized responses', () => {
  // Reset the Gatherer before each test.
  beforeEach(() => {
    responseCompression = new ResponseCompression();
    const driver = Object.assign({}, mockDriver, {
      getRequestContent(id) {
        return Promise.resolve(traceData.networkRecords[id].content);
      },
    });

    options = {
      url: 'http://google.com/',
      driver,
    };
  });

  it('returns only text and non encoded responses', () => {
    return responseCompression.afterPass(options, createNetworkRequests(traceData))
      .then(artifact => {
        assert.equal(artifact.length, 2);
        assert.ok(/index\.css$/.test(artifact[0].url));
        assert.ok(/index\.json$/.test(artifact[1].url));
      });
  });

  it('computes sizes', () => {
    return responseCompression.afterPass(options, createNetworkRequests(traceData))
      .then(artifact => {
        assert.equal(artifact.length, 2);
        assert.equal(artifact[0].resourceSize, 6);
        assert.equal(artifact[0].gzipSize, 26);
      });
  });

  it('ignores responses from installed Chrome extensions', () => {
    const traceData = {
      networkRecords: [
        {
          _url: 'chrome-extension://index.css',
          _mimeType: 'text/css',
          _requestId: 1,
          _resourceSize: 10,
          _transferSize: 10,
          _resourceType: {
            _isTextType: true,
          },
          _responseHeaders: [],
          content: 'aaaaaaaaaa',
          finished: true,
        },
        {
          _url: 'http://google.com/chrome-extension.css',
          _mimeType: 'text/css',
          _requestId: 1,
          _resourceSize: 123,
          _transferSize: 123,
          _resourceType: {
            _isTextType: true,
          },
          _responseHeaders: [],
          content: 'aaaaaaaaaa',
          finished: true,
        },
      ],
    };

    return responseCompression.afterPass(options, createNetworkRequests(traceData))
      .then(artifact => {
        assert.equal(artifact.length, 1);
        assert.equal(artifact[0].resourceSize, 123);
      });
  });

  // Change into SDK.networkRequest when examples are ready
  function createNetworkRequests(traceData) {
    traceData.networkRecords = traceData.networkRecords.map(record => {
      record.url = record._url;
      record.statusCode = record._statusCode;
      record.mimeType = record._mimeType;
      record.resourceSize = record._resourceSize;
      record.transferSize = record._transferSize;
      record.responseHeaders = record._responseHeaders;
      record.requestId = record._requestId;
      record._resourceType = Object.assign(
        {
          isTextType: () => record._resourceType._isTextType,
        },
        record._resourceType
      );

      return record;
    });

    return traceData;
  }
});
