var fs = require('fs'),
    cp = require('child_process'),
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
        shouldTag,
        bowerJSON,
        packageJSON;

    header = fs.readFileSync('./lib/header.js', {encoding : 'utf8'});

    packageJSON = require('./package.json');
    version = argv.v;

    if (version) {

        shouldTag = true;

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

    if (shouldTag) {

        cp.exec('git add . && git commit -m "New build (VERSION ' + version + ')"',

            function (error, stdout, stderr) {
                console.log(stdout);
                console.error(stderr);

                cp.exec('git tag -a ' + version + ' -m "Version ' + version + '"',
                    function (error, stdout, stderr) {
                        console.log(stdout);
                        console.error(stderr);
                    }
                );
            }
        );
    }

    console.log(version + ' build complete!');
    console.log('');
});