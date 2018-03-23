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

const namespace = 'org.hyperledger_composer.marbles';

describe('Marbles', () => {
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

        // Import the network admin identity for us to use
        const adminCards = await adminConnection.start(businessNetworkDefinition.getName(), businessNetworkDefinition.getVersion(), startOptions);
        adminCardName = `${adminUserName}@${businessNetworkDefinition.getName()}`;
        await adminConnection.importCard(adminCardName, adminCards.get(adminUserName));

        // Connect to the business network using the network admin identity
        await businessNetworkConnection.connect(adminCardName);
    });

    describe('#trade', () => {

        it('should be able to trade marbles', async () => {

            const factory = businessNetworkConnection.getBusinessNetwork().getFactory();

            // create the first player
            const dan = factory.newResource(namespace, 'Player', 'daniel.selman@example.com');
            dan.firstName = 'Dan';
            dan.lastName = 'Selman';

            // create the marble
            const marble = factory.newResource(namespace, 'Marble', 'MARBLE_001');
            marble.size = 'SMALL';
            marble.color = 'RED';
            marble.owner = factory.newRelationship(namespace, 'Player', dan.$identifier);

            // create the second player
            const simon = factory.newResource(namespace, 'Player', 'sstone1@example.com');
            simon.firstName = 'Simon';
            simon.lastName = 'Stone';

            const tradeMarble = factory.newTransaction(namespace, 'TradeMarble');
            tradeMarble.newOwner = factory.newRelationship(namespace, 'Player', simon.$identifier);
            tradeMarble.marble = factory.newRelationship(namespace, 'Marble', marble.$identifier);

            // add the marble to the asset registry.
            const marbleRegistry = await businessNetworkConnection.getAssetRegistry(namespace + '.Marble');
            await marbleRegistry.add(marble);

            // add the players to the participant registry
            const playerRegistry = await businessNetworkConnection.getParticipantRegistry(namespace + '.Player');
            await playerRegistry.addAll([dan, simon]);

            // submit the transaction
            await businessNetworkConnection.submitTransaction(tradeMarble);

            // get the listing
            const newMarble = await marbleRegistry.get(marble.$identifier);

            // simon should now own the marble
            newMarble.owner.getIdentifier().should.equal('sstone1@example.com');
        });
    });
});
