/* jshint node: true */
'use strict';
var config = require('./config.webgme'),
    validateConfig = require('webgme/config/validator');

// Overwrite options as needed
config.server.port = 8080;
config.mongo.uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/cnn-creator';

// Default Project
config.client.defaultConnectionRouter = 'basic';

// Customize Visualizers
//config.visualization.visualizerDescriptors = ['./Visualizers.json'];

// Plugins
config.plugin.allowServerExecution = true;
config.plugin.allowBrowserExecution = true;
config.seedProjects.defaultProject = 'Caffe';
config.requirejsPaths['image-size'] = './src/plugins/common/lib/image-size';
config.requirejsPaths['buffer'] = './src/plugins/common/lib/buffer';

// Seeds (removing all WebGME seeds)
config.seedProjects.basePaths = config.seedProjects.basePaths
    .filter(path => path.indexOf('webgme') === -1);

// Executors
config.executor.enable = true;

validateConfig(config);
module.exports = config;
