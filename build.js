var fs = require('fs'),
    includer = require('includer'),
    wrench = require('wrench'),
    uglify = require('uglify-js');

includer('lib/main.js', {

    separator : '\n\n',

    wrap : function (src) {
        return src;
    }

}, function (err, data) {

    wrench.mkdirSyncRecursive('./dist');

    fs.writeFileSync('ember-datafied.js', data);
    fs.writeFileSync('./dist/ember-datafied.js', data);
    fs.writeFileSync('./dist/ember-datafied.min.js', uglify.minify('./dist/ember-datafied.js').code);

    console.log("Build complete!");
});