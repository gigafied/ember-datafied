var fs = require('fs'),
    argv = require('minimist')(process.argv),
    includer = require('includer'),
    wrench = require('wrench'),
    uglify = require('uglify-js');

console.log('');

includer('lib/main.js', {

    separator : '\n\n',

    wrap : function (src) {
        return src;
    }

}, function (err, data) {

    var header,
        version,
        minified,
        bowerJSON,
        packageJSON;

    header = fs.readFileSync('./lib/header.js', {encoding : 'utf8'});

    packageJSON = require('./package.json');
    version = argv.v;

    if (version) {

        version = version.toString().split('.');

        while (version.length < 3) {
            version.push('0');
        }

        version = version.join('.');

        bowerJSON = require('./bower.json');

        packageJSON.version = bowerJSON.version = version;

        fs.writeFileSync('./package.json', JSON.stringify(packageJSON, null, 4));
        fs.writeFileSync('./bower.json', JSON.stringify(bowerJSON, null, 4));
    }

    version = packageJSON.version;

    wrench.mkdirSyncRecursive('./dist');

    header = header.split('{{VERSION}}').join(version);
    data = data.split('{{VERSION}}').join(version);

    minified = [header, uglify.minify(data, {fromString : true}).code].join('\n\n');
    data = [header, data].join('\n');

    fs.writeFileSync('ember-datafied.js', data);
    fs.writeFileSync('./dist/ember-datafied.js', data);
    fs.writeFileSync('./dist/ember-datafied.min.js', minified);

    console.log(version + ' build complete!');
    console.log('');
});