var gulp = require('gulp');
var path = require('path');
var del = require('del');
var shell = require('shelljs')
var pkgm = require('./package');
var gutil = require('gulp-util');
var zip = require('gulp-zip');
var minimist = require('minimist');
var os = require('os');
var fs = require('fs');
var semver = require('semver');
var Q = require('q');
var exec = require('child_process').exec;
var tsc = require('gulp-tsc');
var mocha = require('gulp-mocha');
var cp = require('child_process');

var NPM_MIN_VER = '3.0.0';
var MIN_NODE_VER = '4.0.0';

if (semver.lt(process.versions.node, MIN_NODE_VER)) {
    console.error('requires node >= ' + MIN_NODE_VER + '.  installed: ' + process.versions.node);
    process.exit(1);
}

/*
Package :
- Package the vsix 
*/

var mopts = {
    boolean: 'ci',
    string: 'suite',
    default: { ci: false, suite: '**' }
};

var options = minimist(process.argv.slice(2), mopts);

var _buildRoot = path.join(__dirname, '_build');
var _pkgRoot = path.join(__dirname, '_package');

var _tempPath = path.join(__dirname, '_temp');

gulp.task('clean', function (cb) {
    del([_buildRoot, _pkgRoot, _tempPath], cb);
});

// compile tasks inline
gulp.task('compileTasks', ['clean'], function (cb) {
    try {
        getNpmExternal('vsts-task-lib');
    }
    catch (err) {
        console.log('error:' + err.message);
        cb(new gutil.PluginError('compileTasks', err.message));
        return;
    }

    var tasksPath = path.join(__dirname, 'Extension', '**/*.ts');
    return gulp.src([tasksPath, 'definitions/*.d.ts'])
        .pipe(tsc())
        .pipe(gulp.dest(path.join(__dirname, 'Extension')));
});

gulp.task('copyMdFiles', function(cb) {
    return gulp.src(path.join(__dirName, '*.md'))
    .pipe(gulp.dest(path.join(__dirname)));
})

gulp.task('compile', ['compileTasks', 'copyMdFiles']);

gulp.task('locCommon', ['compileTasks'], function () {
    return gulp.src(path.join(__dirname, 'Tasks/Common/**/module.json'))
        .pipe(pkgm.LocCommon());
});

gulp.task('build', ['locCommon'], function () {
    // Layout the tasks.
    shell.mkdir('-p', _buildRoot);
    return gulp.src(path.join(__dirname, 'Extension', '**/task.json'))
        .pipe(pkgm.PackageTask(_buildRoot, [], []));
});

gulp.task('package', ['build'], function() {
    var _manifestDir = path.join(__dirname, 'Extension');
    shell.cp('-R', path.join(_manifestDir, 'extension-icon.png'), _buildRoot);
    shell.cp('-R', path.join(_manifestDir, 'extension-manifest.json'), _buildRoot);
    shell.cp('-R', path.join(_manifestDir, 'overview.md'), _buildRoot);
    shell.cp('-R', path.join(_manifestDir, 'images'), _buildRoot);
       
    return pkgm.PackageVsix(_pkgRoot, _buildRoot);
});

gulp.task('default', ['package']);

//-----------------------------------------------------------------------------------------------------------------
// INTERNAL BELOW
//-----------------------------------------------------------------------------------------------------------------

var getNpmExternal = function (name) {
    var externals = require('./externals.json');
    var libVer = externals[name];
    if (!libVer) {
        throw new Error('External module not defined in externals.json: ' + name);
    }

    var libPath = path.join(_tempPath, name, libVer);
    gutil.log('acquiring ' + name + ': ' + libVer + ": "+libPath);

    shell.mkdir('-p', path.join(libPath, 'node_modules'));

    var pkg = {
        "name": "temp",
        "version": "1.0.0",
        "description": "temp to avoid warnings",
        "main": "index.js",
        "dependencies": {},
        "devDependencies": {},
        "repository": "http://norepo/but/nowarning",
        "scripts": {
            "test": "echo \"Error: no test specified\" && exit 1"
        },
        "author": "",
        "license": "MIT"
    };
    //fs.writeFileSync(path.join(_tempPath, 'package.json'), JSON.stringify(pkg, null, 2));
    fs.writeFileSync(path.join(libPath, 'package.json'), JSON.stringify(pkg, null, 2));

    shell.pushd(libPath);
    var completedPath = path.join(libPath, 'installcompleted');
    if (shell.test('-f', completedPath)) {
        console.log('Package already installed. Skipping.');
        shell.popd();
        return;
    }

    var npmPath = shell.which('npm');
    if (!npmPath) {
        throw new Error('npm not found.  ensure npm 3 or greater is installed');
    }

    var s = cp.execSync('"' + npmPath + '" --version');
    var ver = s.toString().replace(/[\n\r]+/g, '')
    console.log('version: "' + ver + '"');

    if (semver.lt(ver, NPM_MIN_VER)) {
        throw new Error('NPM version must be at least ' + NPM_MIN_VER + '. Found ' + ver);
    }

    var cmdline = '"' + npmPath + '" install ' + name + '@' + libVer;
    gutil.log(cmdline);
    var res = cp.execSync(cmdline);
    gutil.log(res.toString());

    shell.popd();
    if (res.status > 0) {
        throw new Error('npm failed with code of ' + res.status);
    }

    fs.writeFileSync(completedPath, '');
}
