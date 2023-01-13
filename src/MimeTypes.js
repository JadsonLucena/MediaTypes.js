const fs = require('fs');
const { parse } = require('path');
const EventEmitter = require('events');

// https://www.rfc-editor.org/rfc/rfc6838#section-4.2
/*
https://github.com/jshttp/media-typer/blob/master/index.js
const SUBTYPE_NAME_REGEXP = new Regex('^[a-z0-9][a-z0-9!#$&^_.-]{0,126}$', 'i')
const TYPE_NAME_REGEXP = new Regex('^[a-z0-9][a-z0-9!#$&^_-]{0,126}$', 'i')
const TYPE_REGEXP = new Regex('^\s*([a-z0-9][a-z0-9!#$&^_-]{0,126})\/([a-z0-9][a-z0-9!#$&^_.+-]{0,126})\s*$', 'i')
*/
class MimeTypes extends EventEmitter {

    #mimeTypes;
    #versions;
    #updateInterval;
    #updateLoop;

    constructor(updateInterval = 86400000) {

        super({captureRejections: true});

        this.setMaxListeners(0);


        try {

            this.#mimeTypes = JSON.parse(fs.readFileSync(__dirname +'/mimetypes.json').toString('utf8'));

        } catch (err) {

            this.#mimeTypes = {};

        }


        try {

            this.#versions = JSON.parse(fs.readFileSync(__dirname +'/versions.json').toString('utf8'));

        } catch (err) {

            this.#versions = {
                apache: null,
                debian:  null,
                iana: {
                    application: null,
                    audio: null,
                    font: null,
                    image: null,
                    message: null,
                    model: null,
                    multipart: null,
                    text: null,
                    video: null
                },
                nginx: null
            };

        }


        /*try {

            this.update();

        } catch (err) {

            console.error(err);

        }*/


        this.updateInterval = updateInterval;

    }

    #updateList(content) {

        let list = {};

        for (let mimeType in content) {

            mimeType = mimeType.trim().toLowerCase();

            if (mimeType in this.#mimeTypes) {

                content[mimeType].forEach(extension => {

                    extension = extension.trim().toLowerCase();

                    if (!this.#mimeTypes[mimeType].includes(extension)) {

                        this.#mimeTypes[mimeType].push(extension);

                        list[mimeType] = (list[mimeType] || []).concat(extension);

                    }

                });

            } else {

                this.#mimeTypes[mimeType] = content[mimeType].map(extension => extension.trim().toLowerCase());

                list[mimeType] = this.#mimeTypes[mimeType];

            }

        }

        return list;

    }

    #loadApache = async res => {

        try {

            return {
                version: res.headers.get('etag'),
                content: (await res.text()).split(/\n+/).filter(line => !/^#.*/.test(line) && line.trim() != '').reduce((curr, line) => {

                    line = line.split(/\t+/);

                    if (line.length > 1) {

                       let mimeType = line[0].trim().toLowerCase();
                       let extensions = line[1].split(/\s+/).map(ext => ext.trim().toLowerCase()).filter(ext => ext);

                        if (mimeType != '' && extensions.length) {

                            curr[mimeType] = extensions;

                        }

                    }

                    return curr;

                }, {})
            };

        } catch (err) {

            console.error(err);

            return null;

        }

    }

    #loadDebian = async res => {

        return await this.#loadApache(res);

    }

    #loadNGINX = async res => {

        try {

            return {
                version: res.headers.get('etag'),
                content: (await res.text()).replace(/(\s*types\s*{\s*|\s*}\s*)/ig, '').split(';').filter(line => !/^#.*/.test(line) && line.trim() != '').reduce((curr, line) => {

                    line = line.match(/^\s*(?<mimeType>[^\s]+)\s+(?<extensions>.*)\s*$/);

                    let mimeType = line.groups.mimeType.trim().toLowerCase();
                    let extensions = line.groups.extensions.split(/\s+/).map(ext => ext.trim().toLowerCase()).filter(ext => ext);

                    if (mimeType != '' && extensions.length) {

                        curr[mimeType] = extensions;

                    }

                    return curr;

                }, {})
            };

        } catch (err) {

            console.error(err);

            return null;

        }

    }

    #loadIANA = async res => {

        try {

            return {
                version: res.headers.get('last-modified'),
                content: (await res.text()).split(/\n+/).slice(1).filter(line => !/^#.*/.test(line) && line.trim() != '').reduce((curr, line) => {

                    line = line.split(',');

                    if (line.length > 1) {

                        let extension = line[0].trim().toLowerCase();
                        let mimeType = line[1].trim().toLowerCase();

                        if (mimeType != '' && extension != '' && !/^.*(obsoleted?|deprecated?).*$/i.test(extension)) {

                            if (!(mimeType in curr)) {

                                curr[mimeType] = [ extension ];

                            } else if (!curr[mimeType].includes(extension)) {

                                curr[mimeType].push(extension);

                            }

                        }

                    }

                    return curr;

                }, {})
            };

        } catch (err) {

            console.error(err);

            return null;

        }

    }

    update = () => {

        return Promise.allSettled([
            fetch('https://raw.githubusercontent.com/apache/httpd/trunk/docs/conf/mime.types', { // https://github.com/apache/httpd/blob/trunk/docs/conf/mime.types
                method: 'HEAD',
                headers: {
                    'Accept-Encoding': 'identity'
                }
            }).then(res => {

                if (res.status == 200 && res.headers.get('etag') != this.#versions.apache) {

                    return fetch('https://raw.githubusercontent.com/apache/httpd/trunk/docs/conf/mime.types', {
                        headers: {
                            'Accept-Encoding': 'identity'
                        }
                    });

                }

            }),
            fetch('https://salsa.debian.org/debian/media-types/-/raw/master/mime.types', { // https://salsa.debian.org/debian/media-types/-/blob/master/mime.types
                method: 'HEAD',
                headers: {
                    'Accept-Encoding': 'identity'
                }
            }).then(res => {

                if (res.status == 200 && res.headers.get('etag') != this.#versions.debian) {

                    return fetch('https://salsa.debian.org/debian/media-types/-/raw/master/mime.types', {
                        headers: {
                            'Accept-Encoding': 'identity'
                        }
                    });

                }

            }),
            fetch('https://raw.githubusercontent.com/nginx/nginx/master/conf/mime.types', { // https://github.com/nginx/nginx/blob/master/conf/mime.types
                method: 'HEAD',
                headers: {
                    'Accept-Encoding': 'identity'
                }
            }).then(res => {

                if (res.status == 200 && res.headers.get('etag') != this.#versions.nginx) {

                    return fetch('https://raw.githubusercontent.com/nginx/nginx/master/conf/mime.types', {
                        headers: {
                            'Accept-Encoding': 'identity'
                        }
                    });

                }

            })
        ].concat([ // https://www.iana.org/assignments/media-types/media-types.xhtml
            'https://www.iana.org/assignments/media-types/application.csv',
            'https://www.iana.org/assignments/media-types/audio.csv',
            'https://www.iana.org/assignments/media-types/font.csv',
            'https://www.iana.org/assignments/media-types/image.csv',
            'https://www.iana.org/assignments/media-types/message.csv',
            'https://www.iana.org/assignments/media-types/model.csv',
            'https://www.iana.org/assignments/media-types/multipart.csv',
            'https://www.iana.org/assignments/media-types/text.csv',
            'https://www.iana.org/assignments/media-types/video.csv'
        ].map(url => fetch(url, {
            method: 'HEAD',
            headers: {
                'Accept-Encoding': 'identity',
                'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.103 Safari/537.36'
            }
        }).then(res => {

            let type = url.split('/').pop().replace('.csv', '');

            if (res.status == 200 && res.headers.get('last-modified') != this.#versions.iana?.[type]) {

                return fetch(url, {
                    headers: {
                        'Accept-Encoding': 'identity',
                        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.103 Safari/537.36'
                    }
                });

            }

        })))).then(async results => {

            let list = {};

            if (results[0].status == 'fulfilled' && results[0].value) {

                let load = await this.#loadApache(results[0].value);

                if (load) {

                    this.#versions.apache = load.version;

                    list.apache = {
                        content: this.#updateList(load.content),
                        version: load.version
                    };

                }

            }

            if (results[1].status == 'fulfilled' && results[1].value) {

                let load = await this.#loadDebian(results[1].value);

                if (load) {

                    this.#versions.debian = load.version;

                    list.debian = {
                        content: this.#updateList(load.content),
                        version: load.version
                    };

                }

            }

            if (results[2].status == 'fulfilled' && results[2].value) {

                let load = await this.#loadNGINX(results[2].value);

                if (load) {

                    this.#versions.nginx = load.version;

                    list.nginx = {
                        content: this.#updateList(load.content),
                        version: load.version
                    };

                }

            }

            for (let res of results.slice(3)) {

                if (res.status == 'fulfilled' && res.value) {

                    let load = await this.#loadIANA(res.value);

                    if (load) {

                        this.#versions.iana[res.value.url.split('/').pop().replace('.csv', '')] = load.version;

                        list.iana = {
                            content: this.#updateList(load.content),
                            version: load.version
                        };

                    }

                }

            }


            if (Object.keys(list).length) {

                fs.writeFileSync(__dirname +'/mimetypes.json', JSON.stringify(this.#mimeTypes));
                fs.writeFileSync(__dirname +'/versions.json', JSON.stringify(this.#versions));

                this.emit('update', list);

            }

            return list;

        });

    }


    get list() { return this.#mimeTypes; }
    get updateInterval() { return this.#updateInterval; }


    set updateInterval(updateInterval = 86400000) {

        if (
            typeof updateInterval != 'number'
            || !Number.isFinite(updateInterval)
            || Number.isNaN(updateInterval)
        ) {
            throw new TypeError('Invalid updateInterval')
        }

        this.#updateInterval = updateInterval;

        clearInterval(this.#updateLoop);

        if (updateInterval >= 0) {

            this.#updateLoop = setInterval(async () => {

                try {

                    await this.update();

                } catch (err) {

                    console.error(err);

                }

            }, this.#updateInterval);

        }

    }


    get(path) {

        let pathinfo = parse(path);
        let extension = pathinfo.ext.replace('.', '').trim().toLowerCase();
        let mimeTypes = [];

        for (let mimeType in this.#mimeTypes) {

            if (!mimeTypes.includes(mimeType) && this.#mimeTypes[mimeType].includes(extension)) {

                mimeTypes.push(mimeType);

            }

        }

        return mimeTypes;

    }

    append(mimeType, extension) {

        extension = [].concat(extension);

        if (typeof mimeType != 'string' || !mimeType.trim() || !/^.+\/.+$/i.test(mimeType)) {

            throw new TypeError('Unsupported mimeType');

        } else if (!extension.every(extension => typeof extension == 'string' && extension.trim() && /^[a-z0-9-_+.~%]+$/i.test(extension))) {

            throw new TypeError('Unsupported extension');

        }


        let content = {};
        content[mimeType] = extension;


        if (this.#updateList(content)) {

            fs.writeFileSync(__dirname +'/mimetypes.json', JSON.stringify(this.#mimeTypes));

        }

    }

}


module.exports = MimeTypes;