/* jshint node: true */
'use strict';
var config = require('./config.webgme'),
    validateConfig = require('webgme/config/validator');

// Overwrite options as needed
config.server.port = 8080;
config.mongo.uri = 'mongodb://127.0.0.1:27017/cnn-creator';

// Default Project
config.client.defaultConnectionRouter = 'basic';

// Customize Visualizers
//config.visualization.visualizerDescriptors = ['./Visualizers.json'];

// Plugins
config.plugin.allowServerExecution = true;

validateConfig(config);
module.exports = config;
