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
describe('DigitalLandTitle', () => {

    let adminConnection;
    let businessNetworkConnection;

    before(() => {
        BrowserFS.initialize(new BrowserFS.FileSystem.InMemory());
        const adminConnection = new AdminConnection({ fs: bfs_fs });
        return adminConnection.createProfile('testprofile', { type: 'embedded' })
            .then(() => {
                return adminConnection.connect('testprofile', 'admin', 'Xurw3yU9zI0l');
            })
            .then(() => {
                return BusinessNetworkDefinition.fromDirectory(path.resolve(__dirname, '..'));
            })
            .then((businessNetworkDefinition) => {
                return adminConnection.deploy(businessNetworkDefinition);
            })
            .then(() => {
                businessNetworkConnection = new BusinessNetworkConnection({ fs: bfs_fs });
                return businessNetworkConnection.connect('testprofile', 'digitalproperty-network', 'admin', 'Xurw3yU9zI0l');
            });
    });

    describe('#onRegisterPropertyForSale', () => {

        it('should change the forSale flag from undefined to true', () => {

            // Create the existing LandTitle asset.
            let factory = businessNetworkConnection.getBusinessNetwork().getFactory();

            let seller = factory.newResource('net.biz.digitalPropertyNetwork', 'Person', 'P1');
            seller. firstName = 'Dan';
            seller.lastName = 'Selman';

            let landTitle = factory.newResource('net.biz.digitalPropertyNetwork', 'LandTitle', 'TITLE_1');
            let person = factory.newRelationship('net.biz.digitalPropertyNetwork', 'Person', 'P1');
            landTitle.owner = person;
            landTitle.information = 'Some information';
            landTitle.forSale = false;

            // Create the transaction.
            let transaction = factory.newTransaction('net.biz.digitalPropertyNetwork', 'RegisterPropertyForSale');
            transaction.title = factory.newRelationship('net.biz.digitalPropertyNetwork', 'LandTitle', 'TITLE_1');
            transaction.seller = person;

            // Get the asset registry.
            return businessNetworkConnection.getParticipantRegistry('net.biz.digitalPropertyNetwork.Person')
                .then((personRegistry) => {
                    return personRegistry.add(seller);
                })
                .then(() => {
                    return businessNetworkConnection.getAssetRegistry('net.biz.digitalPropertyNetwork.LandTitle');
                })
                .then((assetRegistry) => {
                    // Add the LandTitle asset to the asset registry.
                    return assetRegistry.add(landTitle);
                })
                .then(() => {
                    // Submit the transaction.
                    return businessNetworkConnection.submitTransaction(transaction);

                })
                .then(() => {
                    return businessNetworkConnection.getAssetRegistry('net.biz.digitalPropertyNetwork.LandTitle');
                })
                .then((assetRegistry) => {
                    // Get the modified land title.
                    return assetRegistry.get('TITLE_1');
                })
                .then((modifiedLandTitle) => {
                    // Ensure the LandTitle has been modified correctly.
                    modifiedLandTitle.forSale.should.be.true;
                });
        });
    });
});
