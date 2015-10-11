/* jshint node: true */
'use strict';
var config = require('./config.base.js'),
    validateConfig = require('webgme/config/validator');

// Customize Visualizers
config.visualization.visualizerDescriptors = ['./src/visualizers/Visualizers.json'];

// Plugins
config.plugin.allowServerExecution = true;

validateConfig(config);
module.exports = config;
