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
const NS_M = 'org.acme.vehicle.lifecycle.manufacturer';
const NS_D = 'org.gov.uk.dvla';

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

        it('should be able to place an order for a vehicle', () => {
            // submit the transaction
            const placeOrder = factory.newTransaction(NS_M, 'PlaceOrder');
            placeOrder.manufacturer = factory.newRelationship(NS_M, 'Manufacturer', 'manufacturer@email.com');
            placeOrder.orderer = factory.newRelationship(NS, 'PrivateOwner', 'dan@email.com');
            const vehicleDetails = factory.newConcept(NS_D, 'VehicleDetails');
            vehicleDetails.modelType = 'Mustang';
            vehicleDetails.make = 'Ford';
            vehicleDetails.colour = 'Red';
            vehicleDetails.VIN = '';
            placeOrder.vehicleDetails = vehicleDetails;
            return businessNetworkConnection.submitTransaction(placeOrder)
                .then(() => {
                    return businessNetworkConnection.getAssetRegistry(NS_M + '.Order');
                })
                .then((orderRegistry) => {
                    return orderRegistry.get(placeOrder.transactionId);
                })
                .then((order) => {
                    order.orderStatus.should.equal('CREATED');
                });
        });
    });
});
