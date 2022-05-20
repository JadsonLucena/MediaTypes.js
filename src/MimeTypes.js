const fs = require('fs');

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

}


module.exports = MimeTypes;