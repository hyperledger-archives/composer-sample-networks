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
const BusinessNetworkConnection = require('composer-client').BusinessNetworkConnection;
const BusinessNetworkDefinition = require('composer-common').BusinessNetworkDefinition;
const IdCard = require('composer-common').IdCard;
const MemoryCardStore = require('composer-common').MemoryCardStore;
const path = require('path');

require('chai').should();

describe('DigitalLandTitle', () => {
    // In-memory card store for testing so cards are not persisted to the file system
    const cardStore = new MemoryCardStore();
    let adminConnection;
    let businessNetworkConnection;

    before(() => {
        // Embedded connection used for local testing
        const connectionProfile = {
            name: 'embedded',
            type: 'embedded'
        };
        // Embedded connection does not need real credentials
        const credentials = {
            certificate: 'FAKE CERTIFICATE',
            privateKey: 'FAKE PRIVATE KEY'
        };

        // PeerAdmin identity used with the admin connection to deploy business networks
        const deployerMetadata = {
            version: 1,
            userName: 'PeerAdmin',
            roles: [ 'PeerAdmin', 'ChannelAdmin' ]
        };
        const deployerCard = new IdCard(deployerMetadata, connectionProfile);
        deployerCard.setCredentials(credentials);

        const deployerCardName = 'PeerAdmin';
        adminConnection = new AdminConnection({ cardStore: cardStore });

        return adminConnection.importCard(deployerCardName, deployerCard).then(() => {
            return adminConnection.connect(deployerCardName);
        });
    });

    beforeEach(() => {
        businessNetworkConnection = new BusinessNetworkConnection({ cardStore: cardStore });

        const adminUserName = 'admin';
        let adminCardName;
        let businessNetworkDefinition;

        return BusinessNetworkDefinition.fromDirectory(path.resolve(__dirname, '..')).then(definition => {
            businessNetworkDefinition = definition;
            // Install the Composer runtime for the new business network
            return adminConnection.install(businessNetworkDefinition.getName());
        }).then(() => {
            // Start the business network and configure an network admin identity
            const startOptions = {
                networkAdmins: [
                    {
                        userName: adminUserName,
                        enrollmentSecret: 'adminpw'
                    }
                ]
            };
            return adminConnection.start(businessNetworkDefinition, startOptions);
        }).then(adminCards => {
            // Import the network admin identity for us to use
            adminCardName = `${adminUserName}@${businessNetworkDefinition.getName()}`;
            return adminConnection.importCard(adminCardName, adminCards.get(adminUserName));
        }).then(() => {
            // Connect to the business network using the network admin identity
            return businessNetworkConnection.connect(adminCardName);
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
