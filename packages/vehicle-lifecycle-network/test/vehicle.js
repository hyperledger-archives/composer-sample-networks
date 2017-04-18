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

const AdminConnection = require('composer-admin').AdminConnection;
const BrowserFS = require('browserfs/dist/node/index');
const BusinessNetworkConnection = require('composer-client').BusinessNetworkConnection;
const BusinessNetworkDefinition = require('composer-common').BusinessNetworkDefinition;
const path = require('path');

require('chai').should();

const bfs_fs = BrowserFS.BFSRequire('fs');
const NS = 'org.acme.vehicle.lifecycle';
let factory;

describe('Vehicle Lifecycle Network', () => {

    let businessNetworkConnection;

    before(() => {
        BrowserFS.initialize(new BrowserFS.FileSystem.InMemory());
        const adminConnection = new AdminConnection({ fs: bfs_fs });
        return adminConnection.createProfile('defaultProfile', {
            type: 'embedded'
        })
        .then(() => {
            return adminConnection.connect('defaultProfile', 'admin', 'Xurw3yU9zI0l');
        })
        .then(() => {
            return BusinessNetworkDefinition.fromDirectory(path.resolve(__dirname, '..'));
        })
        .then((businessNetworkDefinition) => {
            return adminConnection.deploy(businessNetworkDefinition);
        })
        .then(() => {
            businessNetworkConnection = new BusinessNetworkConnection({ fs: bfs_fs });
            return businessNetworkConnection.connect('defaultProfile', 'vehicle-lifecycle-network', 'admin', 'Xurw3yU9zI0l');
        })
        .then(() => {
            // submit the setup demo transaction
            // this will create some sample assets and participants
            factory = businessNetworkConnection.getBusinessNetwork().getFactory();
            const setupDemo = factory.newTransaction(NS, 'SetupDemo');
            return businessNetworkConnection.submitTransaction(setupDemo);
        });
    });

    describe('#manufacture', () => {

        it('should be able to manufacture a vehicle', () => {
            const manufactureVehicle = factory.newTransaction(NS, 'ManufactureVehicle');
            manufactureVehicle.vin = 'ABC123';
            const vehicleDetails = factory.newConcept(NS, 'VehicleDetails');
            vehicleDetails.make = 'Jaguar';
            vehicleDetails.model = 'E Type';
            vehicleDetails.colour = 'Red';
            vehicleDetails.co2Rating = 15;
            manufactureVehicle.vehicleDetails = vehicleDetails;
            manufactureVehicle.manufacturer = factory.newRelationship(NS, 'Manufacturer', 'manufacturer');
            return businessNetworkConnection.submitTransaction(manufactureVehicle)
                .then(() => {
                    return businessNetworkConnection.getAssetRegistry(NS + '.Vehicle');
                })
                .then((vehicleRegistry) => {
                    return vehicleRegistry.get('ABC123');
                })
                .then((vehicle) => {
                    vehicle.vehicleStatus.should.equal('CREATED');
                })
                .then(() => {
                    return businessNetworkConnection.getParticipantRegistry(NS + '.Manufacturer');
                })
                .then((manRegistry) => {
                    return manRegistry.get('manufacturer');
                })
                .then((manufacturer) => {
                    manufacturer.vehicles.length.should.equal(1);
                });
        });
    });

    describe('#authorise', () => {

        it('should be able to authorise a vehicle', () => {
            const authorise = factory.newTransaction(NS, 'Authorise');
            authorise.vehicle = factory.newRelationship(NS, 'Vehicle', 'VEH_0');
            authorise.regulator = factory.newRelationship(NS, 'Regulator', 'regulator');
            authorise.manufacturer = factory.newRelationship(NS, 'Manufacturer', 'manufacturer');
            return businessNetworkConnection.submitTransaction(authorise)
                .then(() => {
                    return businessNetworkConnection.getAssetRegistry(NS + '.Vehicle');
                })
                .then((vehicleRegistry) => {
                    return vehicleRegistry.get('VEH_0');
                })
                .then((vehicle) => {
                    vehicle.vehicleStatus.should.equal('AUTHORIZED');
                })
                .then(() => {
                    return businessNetworkConnection.getParticipantRegistry(NS + '.Regulator');
                })
                .then((regRegistry) => {
                    return regRegistry.get('regulator');
                })
                .then((regulator) => {
                    regulator.vehicles.length.should.equal(1);
                });
        });
    });

    describe('#privateTransfer', () => {

        it('should be able to transfer a vehicle between two private owners', () => {
            const privateTransfer = factory.newTransaction(NS, 'PrivateTransfer');
            privateTransfer.vehicle = factory.newRelationship(NS, 'Vehicle', 'VEH_0');
            privateTransfer.privateOwner = factory.newRelationship(NS, 'PrivateOwner', 'simon');
            return businessNetworkConnection.submitTransaction(privateTransfer)
                .then(() => {
                    return businessNetworkConnection.getAssetRegistry(NS + '.Vehicle');
                })
                .then((vehicleRegistry) => {
                    return vehicleRegistry.get('VEH_0');
                })
                .then((vehicle) => {
                    return vehicle.privateOwner.getIdentifier().should.equal('simon');
                })
                .then(() => {
                    return businessNetworkConnection.getParticipantRegistry(NS + '.PrivateOwner');
                })
                .then((ownerRegistry) => {
                    return ownerRegistry.get('simon');
                })
                .then((owner) => {
                    owner.vehicles.length.should.equal(1);
                });
        });
    });
});
