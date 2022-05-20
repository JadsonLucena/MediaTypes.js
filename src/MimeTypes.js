const fs = require('fs');
const { parse } = require('path');

class MimeTypes {

    #mimeTypes;

    constructor() {

        try {

            this.#mimeTypes = JSON.parse(fs.readFileSync('mimetypes.json').toString('utf8'));

        } catch (err) {

            this.#mimeTypes = {};

        }

    }

    get list() {  

        return this.#mimeTypes;

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

}


module.exports = MimeTypes;