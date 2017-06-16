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
var Util = require('./util');
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
                factory = businessNetworkConnection.getBusinessNetwork().getFactory();
                return Util.setup(businessNetworkConnection);
            });
    });

    describe('#privateVehicleTransfer', function() {

        it('should be able to transfer a vehicle between two private owners', function() {
            var vehicleToTransfer = '123456789';
            var owners = ['dan', 'simon'];

            var vehicleRegistry;
            var privateOwnerRegistry;
            var vehicle;

            return businessNetworkConnection.getAssetRegistry(NS_D + '.Vehicle')
                .then(function(vr) {
                    vehicleRegistry = vr;
                    return vehicleRegistry.get(vehicleToTransfer);
                })
                .then(function(v) {
                    vehicle = v;
                    should.not.exist(vehicle.logEntries);
                    vehicle.owner.getIdentifier().should.equal('dan');
                })
                .then(function() {
                    var privateVehicleTransfer = factory.newTransaction(NS_D, 'PrivateVehicleTransfer');
                    privateVehicleTransfer.vehicle = factory.newRelationship(NS_D, 'Vehicle', vehicle.getIdentifier());
                    privateVehicleTransfer.seller = vehicle.owner;
                    privateVehicleTransfer.buyer = factory.newRelationship(NS, 'PrivateOwner', 'simon');

                    return businessNetworkConnection.submitTransaction(privateVehicleTransfer);
                })
                .then(function() {
                    return vehicleRegistry.get(vehicle.getIdentifier());
                })
                .then(function(newVehicle) {
                    newVehicle.owner.getIdentifier().should.equal('simon');
                    should.exist(newVehicle.logEntries);
                    newVehicle.logEntries.length.should.equal(1);
                    newVehicle.logEntries[0].buyer.getIdentifier().should.equal('simon');
                    newVehicle.logEntries[0].seller.getIdentifier().should.equal('dan');
                    newVehicle.logEntries[0].vehicle.getIdentifier().should.equal(vehicleToTransfer);
                });
        });
    });

    describe('ScrapVehicle', function() {
        it('should change a vehicles status to SCRAPPED', function() {
            var vehicleToScrap = '123456789';
            var assetRegistry;

            var scrapVehicle = factory.newTransaction(NS_D, 'ScrapVehicle');
            scrapVehicle.vehicle = factory.newRelationship(NS_D, 'Vehicle', vehicleToScrap);

            return businessNetworkConnection.submitTransaction(scrapVehicle)
                .then(function() {
                    return businessNetworkConnection.getAssetRegistry(NS_D + '.Vehicle');
                })
                .then(function(ar) {
                    assetRegistry = ar;
                    return assetRegistry.get(vehicleToScrap);
                })
                .then(function(vehicle) {
                    vehicle.vehicleStatus.should.equal('SCRAPPED');
                });
        });
    });
});