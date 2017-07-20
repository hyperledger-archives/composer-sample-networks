/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

var AdminConnection = require('composer-admin').AdminConnection;
var BrowserFS = require('browserfs/dist/node/index');
var BusinessNetworkConnection = require('composer-client').BusinessNetworkConnection;
var BusinessNetworkDefinition = require('composer-common').BusinessNetworkDefinition;
var path = require('path');

var should = require('chai').should();



var bfs_fs = BrowserFS.BFSRequire('fs');
var NS = 'org.acme.vehicle.lifecycle';
var NS_M = 'org.acme.vehicle.lifecycle.manufacturer';
var NS_D = 'org.vda';

var factory;

describe('Vehicle Lifecycle Network', function() {

    var businessNetworkConnection;

    before(function() {
        BrowserFS.initialize(new BrowserFS.FileSystem.InMemory());
        var adminConnection = new AdminConnection({ fs: bfs_fs });
        return adminConnection.createProfile('defaultProfile', {
            type: 'embedded'
        })
            .then(function() {
                return adminConnection.connect('defaultProfile', 'admin', 'Xurw3yU9zI0l');
            })
            .then(function() {
                return BusinessNetworkDefinition.fromDirectory(path.resolve(__dirname, '..'));
            })
            .then(function(businessNetworkDefinition) {
                return adminConnection.deploy(businessNetworkDefinition);
            })
            .then(function() {
                businessNetworkConnection = new BusinessNetworkConnection({ fs: bfs_fs });
                return businessNetworkConnection.connect('defaultProfile', 'vehicle-lifecycle-network', 'admin', 'Xurw3yU9zI0l');
            })
            .then(function() {
            // this will create some sample assets and participants
                factory = businessNetworkConnection.getBusinessNetwork().getFactory();
            });
    });

    describe('#setupDemo', function() {

        /**
         *
         * @param {String} registry - name of a registry
         */
        function getAllFromRegistry(type, registry) {
            var func = 'get' + type + 'Registry';
            return businessNetworkConnection[func](registry)
                .then(function(registry) {
                    return registry.getAll();
                });
        }

        it('should create a scenario', function() {
            // submit the transaction
            var setupDemo = factory.newTransaction(NS, 'SetupDemo');

            return businessNetworkConnection.submitTransaction(setupDemo)
                .then(function() {
                    // (participants) get regulator registry
                    return getAllFromRegistry('Participant', NS + '.Regulator');
                })
                .then(function(regulators) {
                    regulators.length.should.equal(1);
                })
                .then(function() {
                    // (participants) get manufacturer registry
                    return getAllFromRegistry('Participant', NS_M + '.Manufacturer');
                })
                .then(function(manufacturers) {
                    manufacturers.length.should.be.above(1);
                })
                .then(function() {
                    // (participants) get private owner registry
                    return getAllFromRegistry('Participant', NS + '.PrivateOwner');
                })
                .then(function(privateOwners) {
                    privateOwners.length.should.be.above(10);
                })
                .then(function() {
                    // (assets) get vehicles registry
                    return getAllFromRegistry('Asset', NS_D + '.Vehicle');
                })
                .then(function(vehicles) {
                    vehicles.length.should.be.above(10);
                });
        });
    });
});