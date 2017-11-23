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

const Util = require('./util');

const should = require('chai').should();

const NS = 'org.acme.vehicle.lifecycle';
const NS_M = 'org.acme.vehicle.lifecycle.manufacturer';
const NS_D = 'org.vda';

describe('VDA', function() {
    let businessNetworkConnection;
    let factory;

    beforeEach(function() {
        return Util.deployAndConnect()
            .then(connection => {
                businessNetworkConnection = connection;
                factory = businessNetworkConnection.getBusinessNetwork().getFactory();
                return Util.setup(businessNetworkConnection);
            });
    });

    describe('#privateVehicleTransfer', function() {
        it('should be able to transfer a vehicle between two private owners', function() {
            const vehicleToTransfer = '123456789';
            const owners = ['dan', 'simon'];

            let vehicleRegistry;
            let privateOwnerRegistry;
            let vehicle;

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
                    const privateVehicleTransfer = factory.newTransaction(NS_D, 'PrivateVehicleTransfer');
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
            const vehicleToScrap = '123456789';

            const scrapVehicle = factory.newTransaction(NS_D, 'ScrapVehicle');
            scrapVehicle.vehicle = factory.newRelationship(NS_D, 'Vehicle', vehicleToScrap);

            return businessNetworkConnection.submitTransaction(scrapVehicle)
                .then(function() {
                    return businessNetworkConnection.getAssetRegistry(NS_D + '.Vehicle');
                })
                .then(function(assetRegistry) {
                    return assetRegistry.get(vehicleToScrap);
                })
                .then(function(vehicle) {
                    vehicle.vehicleStatus.should.equal('SCRAPPED');
                });
        });
    });

    describe('ScrapAllVehiclesByColour', function() {
        it('should select vehicles by colour and change vehicles status to SCRAPPED', function() {
            // Vehicle with beige colour and id 123456789 resides in reposritory
            const vehicleId = '123456789';
            const scrapVehicleTransaction = factory.newTransaction(NS_D, 'ScrapAllVehiclesByColour');
            scrapVehicleTransaction.colour = 'Beige';
            return businessNetworkConnection.submitTransaction(scrapVehicleTransaction)
                .then(function() {
                    return businessNetworkConnection.getAssetRegistry(NS_D + '.Vehicle');
                })
                .then(function(ar) {
                    const assetRegistry = ar;
                    return assetRegistry.get(vehicleId);
                })
                .then(function(vehicle) {
                    vehicle.vehicleStatus.should.equal('SCRAPPED');
                });

        });
    });

});
