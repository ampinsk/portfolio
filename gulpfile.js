// Generated on 2016-04-27 using generator-puppy 0.1.0
var config = require('yargs')
  .default('optimized', false)
  .argv;

// Load Gulp and friends
var gulp = require('gulp');
var del = require('del');
var path = require('path');
var fm = require('front-matter');
var runSequence = require('run-sequence');
var browserSync = require('browser-sync').create();
var $ = require('gulp-load-plugins')();

var loadData = require('./lib/gulp/helpers').loadData;

$.util.log('Build Mode: %s', config.optimized ? 'Optimized' : 'Development');

// Individual low-level task definitions go here

/**
 * Compile HTML
 *
 * - Parse data from front-matter headers
 * - Compile Twig templates
 * - Check for useref <!-- build --> blocks to generate production scripts and styles
 * - Minify HTML for optimized builds
 */
gulp.task('html', ['styles', 'scripts'], function() {
  var data = {}, sitemap = {};

  var assets = $.useref.assets({searchPath: ['dist']});

  // Populate global template data from JSON files in data directory
  data = loadData('data/*.json', function (contents) {
    return JSON.parse(contents);
  });

  // Populate sitemap data from HTML pages in content directory
  sitemap = loadData('src/content/**/*.html', function (contents, fpath) {
    var page = fm(contents).attributes;
    page.path = '/' + path.relative('./src/content', fpath);
    return page;
  });

  return gulp.src([
    'src/content/**/*.html',
    ])

    // Convert front matter headers to Twig context, accessible
    // in your templates via the `current_page` variable.
    .pipe($.data(function (file) {
      var content = fm(String(file.contents));
      file.contents = new Buffer(content.body);
      return {current_page: content.attributes, sitemap: sitemap, data: data};
    }))

    // Compile Twig templates.
    .pipe($.twig({
      base: 'src/templates',
      errorLogToConsole: false
    }))

    // Concatenate CSS and JS assets from <!-- build --> tags and pipe
    // to build directory
    .pipe(assets)
    .pipe($.if('*.js' && config.optimized, $.uglify()))
    .pipe($.if('*.css' && config.optimized, $.minifyCss()))
    .pipe(assets.restore())
    .pipe($.useref())

    // Minify HTML
    .pipe($.if(config.optimized, $.minifyHtml()))
    .pipe(gulp.dest('dist'))
});

/**
 * Compile CSS
 */
gulp.task('styles', ['modernizr'], function() {
  return gulp.src('src/static/scss/*.scss')
    .pipe($.sourcemaps.init())

    // Compile Sass
    .pipe(
      $.sass({
        style: 'nested',
        includePaths: ['src/bower_components']
      })
      .on('error', $.sass.logError)
    )

    // Run CSS through autoprefixer
    .pipe($.autoprefixer('last 10 version'))

    // Write sourcemaps
    .pipe($.sourcemaps.write('.'))

    // Write development assets
    .pipe(gulp.dest('dist/static/css'))

    // Stream generated files to BrowserSync for injection
    // @see http://www.browsersync.io/docs/gulp/#gulp-sass-css
    .pipe(browserSync.stream());
});

/**
 * Pipe static image assets to build directory
 */
gulp.task('images', function() {
  return gulp.src('src/static/img/*/*')
    .pipe(gulp.dest('dist/static/img'));
});

/**
 * Pipe static font assets to build directory
 */
gulp.task('fonts', function() {
  return gulp.src('src/static/fonts/*')
    .pipe(gulp.dest('dist/static/fonts'));
});

/**
 * Pipe static Javascript assets to build directory
 */
gulp.task('scripts', ['modernizr'], function() {
  return gulp.src('src/static/js/*')
    .pipe(gulp.dest('dist/static/js'))
});

/**
 * Custom Modernizr build depending on feature detections used in our source scripts.
 */
gulp.task('modernizr', function() {
  return gulp.src([
    'src/static/js/*.js',
    'src/static/scss/**/*.scss'
    ])
    .pipe($.modernizr({
      options: [
          "setClasses",
          "addTest",
          "html5printshiv",
          "testProp",
          "fnBind"
      ]
    }))
    .pipe($.if(config.optimized, $.uglify()))
    .pipe(gulp.dest("dist/static/js"));
});

/**
 * Pipe static Bower dependencies to build directory
 */
gulp.task('bower', function() {
  return gulp.src('src/bower_components/**/*')
    .pipe(gulp.dest('dist/bower_components'));
});

/**
 * Clean build directory
 */
gulp.task('clean', function() {
  return del(['dist']);
});

/**
 * Serve build directory locally
 */
gulp.task('serve', ['build'], function() {
  browserSync.init({
    logPrefix: 'Puppy',
    notify: false,
    reloadDelay: 500,
    server: {
      baseDir: "dist"
    }
  });

  // Recompile templates if any HTML, Twig or scripts change
  gulp.watch([
    'src/content/**/*.html',
    'src/templates/**/*.twig',
    'src/static/js/*.js',
    'data/*.json'
    ], ['html', browserSync.reload]);

  // Trigger styles task when Sass files change. Note that browser reloading
  // is handled directly in the `sass` task with `browserSync.stream()`
  gulp.watch('src/static/scss/**/*.scss', ['styles']);

  // Move static images and fonts to the `dist` directory and reload when source
  // files change
  gulp.watch('src/static/img/*', ['images', browserSync.reload]);
  gulp.watch('src/static/fonts/*', ['fonts', browserSync.reload]);
});

// High-level task definitions go here. Puppy requires: `build` and `serve`.

gulp.task('build', function (cb) {
  return runSequence('clean', ['images', 'fonts', 'bower', 'html'], cb);
});

gulp.task('default', ['serve']);
