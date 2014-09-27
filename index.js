'use strict';


/**
 * Child helper
 * @type {Child}
 */
exports.Child = require(__dirname + '/helpers/Child')


/**
 * Alias to child shortcut
 * @type {function}
 */
exports.child = exports.Child.child


/**
 * Alias to run a child once and return
 * @type {function}
 */
exports.childOnce = exports.Child.childOnce


/**
 * Alias to parent shortcut
 * @type {function}
 */
exports.parent = exports.Child.parent


/**
 * Alias to fork a runOnce child
 * @type {function}
 */
exports.fork = exports.Child.fork


/**
 * Cluster Helper
 * @type {cluster}
 */
exports.cluster = require(__dirname + '/helpers/Cluster')


/**
 * Shortcut for worker setup
 * @type {function}
 */
exports.worker = exports.cluster.setup
