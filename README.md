# MimeTypes
This is a comprehensive compilation of MIME types that is periodically updated through the following projects: [Apache](https://github.com/apache/httpd/blob/trunk/docs/conf/mime.types), [NGINX](https://github.com/nginx/nginx/blob/master/conf/mime.types), [IANA](https://www.iana.org/assignments/media-types/media-types.xhtml) and [Debian](https://salsa.debian.org/debian/media-types/-/blob/master/mime.types)


## What is
A file's extension has no meaning on the web. In order for the client to interpret the document correctly, the MIME type must be sent in the Content-Type header.


## Interfaces
```typescript
// Constructor
constructor(
    updateInterval?: number = 86400000 // The time, in milliseconds. if less than zero, periodic update will be disabled.
)
```

```typescript
// Getters
list(): { [mimeType: string]: string[] } // List of all MIME types with their extensions
updateInterval(): number
```

```typescript
// Setters
updateInterval(
    updateInterval?: number = 86400000 //  https://developer.mozilla.org/en-US/docs/Web/API/setInterval#delay
)
```

```typescript
// Methods
append(
    mimeType: string, // https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/MIME_types#structure_of_a_mime_type
    extension: string | string[] // new RegExp('^[a-z0-9-_+.~%]+$', 'i');
)

get(
    path: string // https://nodejs.org/api/path.html#pathparsepath
): string[] // MIME type list
```

```typescript
// Listeners
on(name: 'updated', callback: (mimeType: string, extensions: string[]) => void): void
```


## QuickStart
[![Edit MimeType.mjs](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/async-cache-6m2we0?autoresize=1&expanddevtools=1&fontsize=14&hidenavigation=1&theme=dark)
