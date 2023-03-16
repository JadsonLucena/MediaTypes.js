# MediaTypes
This is a comprehensive compilation of media types that is periodically updated through the following projects: [Apache](https://github.com/apache/httpd/blob/trunk/docs/conf/mime.types), [NGINX](https://github.com/nginx/nginx/blob/master/conf/mime.types) and [Debian](https://salsa.debian.org/debian/media-types/-/blob/master/mime.types)


## What is
A file's extension has no meaning on the web. In order for the client to interpret the document correctly, the media type must be sent in the Content-Type header.


## Interfaces
```typescript
// Constructor
constructor(
    updateInterval?: number = 86400000 // Periodic database update in milliseconds. if less than zero, will be disabled
)
```

```typescript
// Getters
list(): { [extension: string]: string[] } // List of all extensions with their media types
updateInterval(): number
versions(): { apache: string, debian: string, nginx: string }
```

```typescript
// Setters
updateInterval(
    updateInterval?: number = 86400000 //  https://developer.mozilla.org/en-US/docs/Web/API/setInterval#delay
)
```

```typescript
// Methods
delete(
    extension: string
    mediaType: string, // https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/MIME_types#structure_of_a_mime_type
) boolean

get(
    path: string // https://nodejs.org/api/path.html#pathparsepath
): string[] // Media type list

set(
    extension: string
    mediaType: string, // https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/MIME_types#structure_of_a_mime_type
) boolean

update(): null | { [extension: string]: string[] } // List of new inserted media types
```

```typescript
// Listeners
on(name: 'update', callback: (list: { [extension: string]: string[] }) => void): void
on(name: 'error', callback: (error: Error) => void): void
```


## QuickStart
[![Edit MediaType.mjs](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/async-cache-6m2we0?autoresize=1&expanddevtools=1&fontsize=14&hidenavigation=1&theme=dark)
