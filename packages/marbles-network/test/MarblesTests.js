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

const namespace = 'org.hyperledger_composer.marbles';

describe('Marbles', () => {
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

    describe('#trade', () => {

        it('should be able to trade marbles', () => {

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

            // Get the asset registry.
            return businessNetworkConnection.getAssetRegistry(namespace + '.Marble')
                .then((marbleRegistry) => {

                    // Add the Marble to the asset registry.
                    return marbleRegistry.add(marble)
                        .then(() => {
                            return businessNetworkConnection.getParticipantRegistry(namespace + '.Player');
                        })
                        .then((playerRegistry) => {
                            // add the players
                            return playerRegistry.addAll([dan, simon]);
                        })
                        .then(() => {
                            // submit the transaction
                            return businessNetworkConnection.submitTransaction(tradeMarble);
                        })
                        .then(() => {
                            return businessNetworkConnection.getAssetRegistry(namespace + '.Marble');
                        })
                        .then((marbleRegistry) => {
                            // get the listing
                            return marbleRegistry.get(marble.$identifier);
                        })
                        .then((newMarble) => {
                            // simon should now own the marble
                            newMarble.owner.getIdentifier().should.equal('sstone1@example.com');
                        });
                });
        });
    });
});
