/*globals define,_*/
/*
 * @author brollb
 */

define(['plugin/PluginConfig',
        'plugin/PluginBase',
        'util/assert',
        './templates',
        'util/guid'],function(PluginConfig,
                              PluginBase,
                              assert,
                              Templates,
                              genGuid){

    'use strict';

    var NEXT = '_next_',
        PREV = '_previous_',
        DEFAULT = '_default_',
        NODE_PATH = '_nodePath_',
        BASE = '_base_';

    var CNNCreator = function () {
        // Call base class's constructor
        PluginBase.call(this);
    };

    //basic functions and setting for plugin inheritance
    CNNCreator.prototype = Object.create(PluginBase.prototype);
    CNNCreator.prototype.constructor = CNNCreator;
    CNNCreator.prototype.getName = function () {
        return "CNN Creator";
    };

    //helper functions created by Tamas ;)
    CNNCreator.prototype._loadStartingNodes = function(callback){
        //we load the children of the active node
        var self = this;
        this._nodeCache = {};
        var load = function(node, fn){
            self.core.loadChildren(node,function(err,children){
                if (err){
                    fn(err);
                } else {
                    var j = children.length,
                        e = null; //error

                    if (j === 0){
                        fn(null);
                    }

                    for (var i=0;i<children.length;i++){
                        self._nodeCache[self.core.getPath(children[i])] = children[i];
                        load(children[i], function(err){
                            e = e || err;
                            if (--j === 0){ //callback only on last child
                                fn(e);
                            }
                        });
                    }
                }
            });
        };

        load(self.activeNode, callback);
    };

    CNNCreator.prototype._isTypeOf = function(node,type){
        //now we make the check based upon path
        if(node === undefined || node === null || type === undefined || type === null){
            return false;
        }

        while(node) {
            if(this.core.getPath(node) === this.core.getPath(type)){
                return true;
            }
            node = this.core.getBase(node);
        }
        return false;
    };

    CNNCreator.prototype.getNode = function(nodePath){
        // we check only our node cache
        return this._nodeCache[nodePath];
    };

    CNNCreator.prototype.getConfigStructure = function(){
        // Set the values..
        // TODO
        return [{
            'name': 'template',
            'displayName': 'Output',
            'description': '',
            'value': 'Caffe',
            'valueType': 'string',
            'valueItems': Object.keys(Templates)
        }];
    };

    // the main entry point of plugin execution
    CNNCreator.prototype.main = function (callback) {
        var self = this,
            config = self.getCurrentConfig();

        // Set the template
        this.template = Templates[config.template];

        //If activeNode is null, we won't be able to run 
        if(!self._isTypeOf(self.activeNode, self.META.Learner)) {
            self._errorMessages(self.activeNode, "Current project is an invalid type. Please run the plugin on a network.");
        }

        self.logger.info("Running CNN Creator");

        //setting up cache
        self._loadStartingNodes(function(err){
            if(err){
                //finishing
                self.result.success = false;
                callback(err,self.result);
            } else {
                //executing the plugin
                self.logger.info("Finished loading children");

                // Bad hack FIXME
                if (self.result.messages.length) {
                    self.result.messages.pop();
                }
                // REMOVE the above thing
                self._runPlugin(callback);
            }
        });
    };

    CNNCreator.prototype._runPlugin = function(callback) {
        this.nodes = {};

        // Change underscorejs tags
        _.templateSettings = {
            interpolate: /\{\{=(.+?)\}\}/g,
            evaluate: /\{\{(.+?)\}\}/g,
        };

        // Verify that the given template supports all the given layers
        // TODO

        // Create node objects from attribute names
        this.createVirtualNodes();

        // Topological sort of the layers
        var sortedNodes = this.getTopologicalOrdering(this.nodes);

        // Retrieve & populate templates in topological order
        var output = this.createTemplateFromNodes(sortedNodes);

        // Save file
        var name = this.core.getAttribute(this.activeNode, 'name');

        this._saveOutput(name, output, callback);
    };

    /**
     * Create virtual nodes from WebGME nodes for use with the templates.
     *
     * @return {Dictionary<Node>}
     */
    CNNCreator.prototype.createVirtualNodes = function() {
        var nodeIds = this.core.getChildrenPaths(this.activeNode),
            conns = [],
            node,
            i;

        for (i = nodeIds.length; i--;) {
            node = this.getNode(nodeIds[i]);
            if (!this._isTypeOf(node, this.META.LayerConnector)) {
                this.createVirtualNode(node);
            } else {
                conns.push(node);
            }
        }

        // Merge connection info with src/dst nodes
        for (i = conns.length; i--;) {
            this.mergeConnectionNode(conns[i]);
        }

        return this.nodes;
    };

    CNNCreator.prototype.createVirtualNode = function(node) {
        var id = this.core.getPath(node),
            attrNames = this.core.getAttributeNames(node),
            virtualNode = {};

        for (var i = attrNames.length; i--;) {
            virtualNode[attrNames[i]] = this.core.getAttribute(node, attrNames[i]);
        }

        // Initialize source and destination stuff
        virtualNode[NEXT] = [];
        virtualNode[PREV] = [];
        virtualNode[NODE_PATH] = this.core.getPath(node);

        // Record the given node
        this.nodes[id] = virtualNode;
        return virtualNode;
    };

    CNNCreator.prototype.mergeConnectionNode = function(conn) {
        var src = this._getPointerVirtualNode(conn, 'src'),  // Get the virtual nodes
            dst = this._getPointerVirtualNode(conn, 'dst');

        // Set pointers to each other
        src[NEXT].push(dst);
        dst[PREV].push(src);
    };

    CNNCreator.prototype._verifyExists = function(object, key, defaultValue) {
        if (object[key] === undefined) {
            object[key] = defaultValue;
        }
    };

    CNNCreator.prototype._getPointerVirtualNode = function(node, ptr) {
        var targetId = this.core.getPointerPath(node, ptr);

        return this.nodes[targetId];
    };

    /**
     * Get the topological ordering of the nodes from the node dictionary.
     *
     * @param {Dictionary} nodeMap
     * @return {Array<Node>} sortedNodes
     */
    CNNCreator.prototype.getTopologicalOrdering = function() {
        var sortedNodes = [],
            edgeCounts = {},
            ids = Object.keys(this.nodes),
            len = ids.length,
            nodeId,
            id,
            i;

        // Populate edgeCounts
        for (i = ids.length; i--;) {
            edgeCounts[ids[i]] = this.nodes[ids[i]][PREV].length;
        }

        while (sortedNodes.length < len) {
            // Find a node with zero edges...
            i = ids.length;
            nodeId = null;
            while (i-- && !nodeId) {
                if (edgeCounts[ids[i]] === 0) {
                    nodeId = ids.splice(i,1)[0];
                }
            }

            // Add the node 
            sortedNodes.push(nodeId);

            // Update edge lists
            i = this.nodes[nodeId][NEXT].length;
            while (i--) {
                id = this.nodes[nodeId][NEXT][i][NODE_PATH];
                edgeCounts[id]--;
            }

        }

        return sortedNodes;
    };

    /**
     * Create the template from the sorted nodes
     *
     * @param {Array} nodeIds
     * @return {String} output
     */
    CNNCreator.prototype.createTemplateFromNodes = function(nodeIds) {
        var len = nodeIds.length,
            template,
            snippet,
            baseName,
            output,
            node,
            base;

        // Use the active node info to populate DEFAULT template (boilerplate template)
        node = this.createVirtualNode(this.activeNode);
        template = _.template(this.template[DEFAULT]);
        output = template(node);

        // For each node, get the snippet from the base name, populate
        // it and add it to the template
        for (var i = 0; i < len; i++) {
            base = this.core.getBase(this.getNode(nodeIds[i]));
            node = this.nodes[nodeIds[i]];
            node[BASE] = this.createVirtualNode(base);

            baseName = this.core.getAttribute(base, 'name');
            template = _.template(this.template[baseName]);
            snippet = template(node);

            output += snippet;
        }

        return output;
    };

    // Thanks to Tamas for the next two functions
    CNNCreator.prototype._saveOutput = function(filename,stringFileContent,callback){
        var self = this,
            artifact = self.blobClient.createArtifact(filename);

        artifact.addFile(filename,stringFileContent,function(err){
            if(err){
                callback(err);
            } else {
                self.blobClient.saveAllArtifacts(function(err, hashes) {
                    if (err) {
                        callback(err);
                    } else {
                        self.logger.info('Artifacts are saved here:');
                        self.logger.info(hashes);

                        // result add hashes
                        for (var j = 0; j < hashes.length; j += 1) {
                            self.result.addArtifact(hashes[j]);
                        }

                        self.result.setSuccess(true);
                        callback(null, self.result);
                    }
                });
            }
        });
    };

    CNNCreator.prototype._errorMessages = function(message){
        //TODO the erroneous node should be send to the function
        var self = this;
        self.createMessage(self.activeNode,message);
    };

    return CNNCreator;
});
