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

const namespace = 'org.acme.pii';

describe('Acl checking', () => {
    // In-memory card store for testing so cards are not persisted to the file system
    const cardStore = new MemoryCardStore();

    // Embedded connection used for local testing
    const connectionProfile = {
        name: 'embedded',
        type: 'embedded'
    };

    // Name of the business network card containing the administrative identity for the business network
    const adminCardName = 'admin';

    // Admin connection to the blockchain, used to deploy the business network
    let adminConnection;

    // This is the business network connection the tests will use.
    let businessNetworkConnection;

    // These are the identities for Alice and Bob.
    const aliceCardName = 'alice';
    const bobCardName = 'bob';

    // These are a list of receieved events.
    let events;

    let businessNetworkName;
    let factory;

    before(() => {
        // Embedded connection does not need real credentials
        const credentials = {
            certificate: 'FAKE CERTIFICATE',
            privateKey: 'FAKE PRIVATE KEY'
        };

        // Identity used with the admin connection to deploy business networks
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

    /**
     *
     * @param {String} cardName The card name to use for this identity
     * @param {Object} identity The identity details
     * @returns {Promise} resolved when the card is imported
     */
    function importCardForIdentity(cardName, identity) {
        const metadata = {
            userName: identity.userID,
            version: 1,
            enrollmentSecret: identity.userSecret,
            businessNetwork: businessNetworkName
        };
        const card = new IdCard(metadata, connectionProfile);
        return adminConnection.importCard(cardName, card);
    }

    // This is called before each test is executed.
    beforeEach(() => {
        let businessNetworkDefinition;

        // Generate a business network definition from the project directory.
        return BusinessNetworkDefinition.fromDirectory(path.resolve(__dirname, '..'))
            .then(definition => {
                businessNetworkDefinition = definition;
                businessNetworkName = definition.getName();
                return adminConnection.install(businessNetworkName);
            })
            .then(() => {
                const startOptions = {
                    networkAdmins: [
                        {
                            userName: 'admin',
                            enrollmentSecret: 'adminpw'
                        }
                    ]
                };
                return adminConnection.start(businessNetworkDefinition, startOptions);
            }).then(adminCards => {
                return adminConnection.importCard(adminCardName, adminCards.get('admin'));
            })
            .then(() => {
                // Create and establish a business network connection
                businessNetworkConnection = new BusinessNetworkConnection({ cardStore: cardStore });
                events = [];
                businessNetworkConnection.on('event', event => {
                    events.push(event);
                });
                return businessNetworkConnection.connect(adminCardName);
            })
            .then(() => {
                // Get the factory for the business network.
                factory = businessNetworkConnection.getBusinessNetwork().getFactory();

                return businessNetworkConnection.getParticipantRegistry(namespace + '.Member');
            })
            .then(participantRegistry => {
                // Create the participants.
                const alice = factory.newResource(namespace, 'Member', 'alice@email.com');
                alice.firstName = 'Alice';
                alice.lastName = 'A';

                const bob = factory.newResource(namespace, 'Member', 'bob@email.com');
                bob.firstName = 'Bob';
                bob.lastName = 'B';

                participantRegistry.addAll([alice, bob]);
            })
            .then(() => {
                // Issue the identities.
                return businessNetworkConnection.issueIdentity(namespace + '.Member#alice@email.com', 'alice1');
            })
            .then(identity => {
                return importCardForIdentity(aliceCardName, identity);
            }).then(() => {
                return businessNetworkConnection.issueIdentity(namespace + '.Member#bob@email.com', 'bob1');
            })
            .then((identity) => {
                return importCardForIdentity(bobCardName, identity);
            });
    });

    /**
     * Reconnect using a different identity.
     * @param {String} cardName The identity to use.
     * @return {Promise} A promise that will be resolved when complete.
     */
    function useIdentity(cardName) {
        return businessNetworkConnection.disconnect()
            .then(() => {
                businessNetworkConnection = new BusinessNetworkConnection({ cardStore: cardStore });
                events = [];
                businessNetworkConnection.on('event', (event) => {
                    events.push(event);
                });
                return businessNetworkConnection.connect(cardName);
            });
    }

    describe('#OwnRecordFullAccess', () => {

        it('bob should be able to read own data only', () => {

            return useIdentity(bobCardName)
                .then(() => {
                    // use a query, bob should only see his own data
                    return businessNetworkConnection.query('selectMembers')
                        .then((results) => {
                            // check results
                            results.length.should.equal(1);
                            results[0].getIdentifier().should.equal('bob@email.com');
                        });
                });
        });


        it('alice should be able to read own data only', () => {

            return useIdentity(aliceCardName)
                .then(() => {
                    // use a query, alice should only see her own data
                    return businessNetworkConnection.query('selectMembers')
                        .then((results) => {
                            // check results
                            results.length.should.equal(1);
                            results[0].getIdentifier().should.equal('alice@email.com');
                        });
                });
        });

    });

    describe('#ForeignRecordConditionalAccess', () => {

        it('bob should be able to read alice data IFF granted access', () => {

            return useIdentity(aliceCardName)
                .then(() => {

                    // alice grants access to her data to bob
                    const authorize = factory.newTransaction('org.acme.pii', 'AuthorizeAccess');
                    authorize.memberId = 'bob@email.com';
                    return businessNetworkConnection.submitTransaction(authorize);
                })
                .then(() => {
                    return useIdentity(bobCardName);
                })
                .then(() => {

                    // use a query, bob should be able to see his own and alice's data
                    return businessNetworkConnection.query('selectMembers')
                        .then((results) => {
                            // check results
                            results.length.should.equal(2);
                        });
                })
                .then(() => {
                    // switch back to alice
                    return useIdentity(aliceCardName);
                })
                .then(() => {

                    // alice revokes access to her data to bob
                    const revoke = factory.newTransaction('org.acme.pii', 'RevokeAccess');
                    revoke.memberId = 'bob@email.com';
                    return businessNetworkConnection.submitTransaction(revoke);
                })
                .then(() => {
                    return useIdentity(bobCardName);
                })
                .then(() => {

                    // use a query, bob should now only see his own data
                    return businessNetworkConnection.query('selectMembers')
                        .then((results) => {
                            // check results
                            results.length.should.equal(1);
                        });
                });
        });
    });
});