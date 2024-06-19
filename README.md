# MediaTypes
[![CodeQL](https://github.com/JadsonLucena/MediaTypes.js/actions/workflows/github-code-scanning/codeql/badge.svg)](https://github.com/JadsonLucena/MediaTypes.js/actions/workflows/github-code-scanning/codeql)
[![Test](https://github.com/JadsonLucena/MediaTypes.js/actions/workflows/test.yml/badge.svg)](https://github.com/JadsonLucena/MediaTypes.js/actions/workflows/test.yml)
[![Coverage](https://coveralls.io/repos/github/JadsonLucena/MediaTypes.js/badge.svg)](https://coveralls.io/github/JadsonLucena/MediaTypes.js)
[![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)
[![Conventional Commits](https://img.shields.io/badge/Conventional%20Commits-1.0.0-%23FE5196?logo=conventionalcommits&logoColor=white)](https://conventionalcommits.org)

This is a comprehensive compilation of media types under the [RFC-6838](https://www.rfc-editor.org/rfc/rfc6838) protocol that may be periodically updated through the following projects: [Apache](https://github.com/apache/httpd/blob/trunk/docs/conf/mime.types), [NGINX](https://github.com/nginx/nginx/blob/master/conf/mime.types) and [Debian](https://salsa.debian.org/debian/media-types/-/blob/master/mime.types)


## What is
A file's extension has no meaning on the web. In order for the client to interpret the document correctly, the media type must be sent in the Content-Type header.


## Interface
Although this is a javascript module, we use a typescript interface to maintain interoperability and better readability. See: [src/MediaTypes.d.ts](src/MediaTypes.d.ts)

## Specifications
We strive to maintain complete code coverage in tests. With that, we provide all the necessary use cases for a good understanding of how this module works. See: [test/MediaTypes.spec.js](test/MediaTypes.spec.js)