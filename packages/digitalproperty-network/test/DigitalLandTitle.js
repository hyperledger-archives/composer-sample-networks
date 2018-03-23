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
const { BusinessNetworkDefinition, CertificateUtil, IdCard } = require('composer-common');
const path = require('path');

require('chai').should();

describe('DigitalLandTitle', () => {
    // In-memory card store for testing so cards are not persisted to the file system
    const cardStore = require('composer-common').NetworkCardStoreManager.getCardStore( { type: 'composer-wallet-inmemory' } );
    let adminConnection;
    let businessNetworkConnection;

    before(async () => {
        // Embedded connection used for local testing
        const connectionProfile = {
            name: 'embedded',
            'x-type': 'embedded'
        };
        // Generate certificates for use with the embedded connection
        const credentials = CertificateUtil.generate({ commonName: 'admin' });

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

        await adminConnection.importCard(deployerCardName, deployerCard);
        await adminConnection.connect(deployerCardName);
    });

    beforeEach(async () => {
        businessNetworkConnection = new BusinessNetworkConnection({ cardStore: cardStore });

        const adminUserName = 'admin';
        let adminCardName;
        let businessNetworkDefinition = await BusinessNetworkDefinition.fromDirectory(path.resolve(__dirname, '..'));

        // Install the Composer runtime for the new business network
        await adminConnection.install(businessNetworkDefinition);

        // Start the business network and configure an network admin identity
        const startOptions = {
            networkAdmins: [
                {
                    userName: adminUserName,
                    enrollmentSecret: 'adminpw'
                }
            ]
        };
        const adminCards = await adminConnection.start(businessNetworkDefinition.getName(), businessNetworkDefinition.getVersion(), startOptions);

        // Import the network admin identity for us to use
        adminCardName = `${adminUserName}@${businessNetworkDefinition.getName()}`;
        await adminConnection.importCard(adminCardName, adminCards.get(adminUserName));

        // Connect to the business network using the network admin identity
        await businessNetworkConnection.connect(adminCardName);
    });

    describe('#onRegisterPropertyForSale', () => {

        it('should change the forSale flag from undefined to true', async () => {

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
            const personRegistry = await businessNetworkConnection.getParticipantRegistry('net.biz.digitalPropertyNetwork.Person');
            await personRegistry.add(seller);

            // Add the LandTitle asset to the asset registry.
            const assetRegistry = await businessNetworkConnection.getAssetRegistry('net.biz.digitalPropertyNetwork.LandTitle');
            await assetRegistry.add(landTitle);

            // Submit the transaction.
            await businessNetworkConnection.submitTransaction(transaction);

            // Get the modified land title.
            const modifiedLandTitle = await assetRegistry.get('TITLE_1');

            // Ensure the LandTitle has been modified correctly.
            modifiedLandTitle.forSale.should.be.true;
        });
    });
});
