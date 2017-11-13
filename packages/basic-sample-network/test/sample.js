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

const chai = require('chai');
chai.should();
chai.use(require('chai-as-promised'));

describe('Sample', () => {
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

    // This is the factory for creating instances of types.
    let factory;

    // These are the identities for Alice and Bob.
    const aliceCardName = 'alice';
    const bobCardName = 'bob';

    // These are a list of receieved events.
    let events;

    let businessNetworkName;

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

                return businessNetworkConnection.getParticipantRegistry('org.acme.sample.SampleParticipant');
            })
            .then(participantRegistry => {
                // Create the participants.
                const alice = factory.newResource('org.acme.sample', 'SampleParticipant', 'alice@email.com');
                alice.firstName = 'Alice';
                alice.lastName = 'A';

                const bob = factory.newResource('org.acme.sample', 'SampleParticipant', 'bob@email.com');
                bob.firstName = 'Bob';
                bob.lastName = 'B';

                participantRegistry.addAll([alice, bob]);
            })
            .then(() => {
                return businessNetworkConnection.getAssetRegistry('org.acme.sample.SampleAsset');
            })
            .then(assetRegistry => {
                // Create the assets.
                const asset1 = factory.newResource('org.acme.sample', 'SampleAsset', '1');
                asset1.owner = factory.newRelationship('org.acme.sample', 'SampleParticipant', 'alice@email.com');
                asset1.value = '10';

                const asset2 = factory.newResource('org.acme.sample', 'SampleAsset', '2');
                asset2.owner = factory.newRelationship('org.acme.sample', 'SampleParticipant', 'bob@email.com');
                asset2.value = '20';

                assetRegistry.addAll([asset1, asset2]);
            })
            .then(() => {
                // Issue the identities.
                return businessNetworkConnection.issueIdentity('org.acme.sample.SampleParticipant#alice@email.com', 'alice1');
            })
            .then(identity => {
                return importCardForIdentity(aliceCardName, identity);
            }).then(() => {
                return businessNetworkConnection.issueIdentity('org.acme.sample.SampleParticipant#bob@email.com', 'bob1');
            })
            .then((identity) => {
                return importCardForIdentity(bobCardName, identity);
            });
    });

    /**
     * Reconnect using a different identity.
     * @param {String} cardName The name of the card for the identity to use
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
            })
            .then(() => {
                factory = businessNetworkConnection.getBusinessNetwork().getFactory();
            });
    }

    it('Alice can read all of the assets', () => {

        // Use the identity for Alice.
        return useIdentity(aliceCardName)
            .then(() => {

                // Get the assets.
                return businessNetworkConnection.getAssetRegistry('org.acme.sample.SampleAsset')
                    .then((assetRegistry) => {
                        return assetRegistry.getAll();

                    });

            })
            .then((assets) => {

                // Validate the assets.
                assets.should.have.lengthOf(2);
                const asset1 = assets[0];
                asset1.owner.getFullyQualifiedIdentifier().should.equal('org.acme.sample.SampleParticipant#alice@email.com');
                asset1.value.should.equal('10');
                const asset2 = assets[1];
                asset2.owner.getFullyQualifiedIdentifier().should.equal('org.acme.sample.SampleParticipant#bob@email.com');
                asset2.value.should.equal('20');

            });

    });

    it('Bob can read all of the assets', () => {

        // Use the identity for Bob.
        return useIdentity(bobCardName)
            .then(() => {

                // Get the assets.
                return businessNetworkConnection.getAssetRegistry('org.acme.sample.SampleAsset')
                    .then((assetRegistry) => {
                        return assetRegistry.getAll();

                    });

            })
            .then((assets) => {

                // Validate the assets.
                assets.should.have.lengthOf(2);
                const asset1 = assets[0];
                asset1.owner.getFullyQualifiedIdentifier().should.equal('org.acme.sample.SampleParticipant#alice@email.com');
                asset1.value.should.equal('10');
                const asset2 = assets[1];
                asset2.owner.getFullyQualifiedIdentifier().should.equal('org.acme.sample.SampleParticipant#bob@email.com');
                asset2.value.should.equal('20');

            });

    });

    it('Alice can add assets that she owns', () => {

        // Use the identity for Alice.
        return useIdentity(aliceCardName)
            .then(() => {

                // Create the asset.
                const asset3 = factory.newResource('org.acme.sample', 'SampleAsset', '3');
                asset3.owner = factory.newRelationship('org.acme.sample', 'SampleParticipant', 'alice@email.com');
                asset3.value = '30';

                // Add the asset, then get the asset.
                return businessNetworkConnection.getAssetRegistry('org.acme.sample.SampleAsset')
                    .then((assetRegistry) => {
                        return assetRegistry.add(asset3)
                            .then(() => {
                                return assetRegistry.get('3');
                            });
                    });

            })
            .then((asset3) => {

                // Validate the asset.
                asset3.owner.getFullyQualifiedIdentifier().should.equal('org.acme.sample.SampleParticipant#alice@email.com');
                asset3.value.should.equal('30');

            });

    });

    it('Alice cannot add assets that Bob owns', () => {

        // Use the identity for Alice.
        return useIdentity(aliceCardName)
            .then(() => {

                // Create the asset.
                const asset3 = factory.newResource('org.acme.sample', 'SampleAsset', '3');
                asset3.owner = factory.newRelationship('org.acme.sample', 'SampleParticipant', 'bob@email.com');
                asset3.value = '30';

                // Add the asset, then get the asset.
                return businessNetworkConnection.getAssetRegistry('org.acme.sample.SampleAsset')
                    .then((assetRegistry) => {
                        return assetRegistry.add(asset3);
                    });

            })
            .should.be.rejectedWith(/does not have .* access to resource/);

    });

    it('Bob can add assets that he owns', () => {

        // Use the identity for Bob.
        return useIdentity(bobCardName)
            .then(() => {

                // Create the asset.
                const asset4 = factory.newResource('org.acme.sample', 'SampleAsset', '4');
                asset4.owner = factory.newRelationship('org.acme.sample', 'SampleParticipant', 'bob@email.com');
                asset4.value = '40';

                // Add the asset, then get the asset.
                return businessNetworkConnection.getAssetRegistry('org.acme.sample.SampleAsset')
                    .then((assetRegistry) => {
                        return assetRegistry.add(asset4)
                            .then(() => {
                                return assetRegistry.get('4');
                            });
                    });

            })
            .then((asset4) => {

                // Validate the asset.
                asset4.owner.getFullyQualifiedIdentifier().should.equal('org.acme.sample.SampleParticipant#bob@email.com');
                asset4.value.should.equal('40');

            });

    });

    it('Bob cannot add assets that Alice owns', () => {

        // Use the identity for Bob.
        return useIdentity(bobCardName)
            .then(() => {

                // Create the asset.
                const asset4 = factory.newResource('org.acme.sample', 'SampleAsset', '4');
                asset4.owner = factory.newRelationship('org.acme.sample', 'SampleParticipant', 'alice@email.com');
                asset4.value = '40';

                // Add the asset, then get the asset.
                return businessNetworkConnection.getAssetRegistry('org.acme.sample.SampleAsset')
                    .then((assetRegistry) => {
                        return assetRegistry.add(asset4);
                    });

            })
            .should.be.rejectedWith(/does not have .* access to resource/);

    });

    it('Alice can update her assets', () => {

        // Use the identity for Alice.
        return useIdentity(aliceCardName)
            .then(() => {

                // Create the asset.
                const asset1 = factory.newResource('org.acme.sample', 'SampleAsset', '1');
                asset1.owner = factory.newRelationship('org.acme.sample', 'SampleParticipant', 'alice@email.com');
                asset1.value = '50';

                // Update the asset, then get the asset.
                return businessNetworkConnection.getAssetRegistry('org.acme.sample.SampleAsset')
                    .then((assetRegistry) => {
                        return assetRegistry.update(asset1)
                            .then(() => {
                                return assetRegistry.get('1');
                            });
                    });

            })
            .then((asset1) => {

                // Validate the asset.
                asset1.owner.getFullyQualifiedIdentifier().should.equal('org.acme.sample.SampleParticipant#alice@email.com');
                asset1.value.should.equal('50');

            });

    });

    it('Alice cannot update Bob\'s assets', () => {

        // Use the identity for Alice.
        return useIdentity(aliceCardName)
            .then(() => {

                // Create the asset.
                const asset2 = factory.newResource('org.acme.sample', 'SampleAsset', '2');
                asset2.owner = factory.newRelationship('org.acme.sample', 'SampleParticipant', 'bob@email.com');
                asset2.value = '50';

                // Update the asset, then get the asset.
                return businessNetworkConnection.getAssetRegistry('org.acme.sample.SampleAsset')
                    .then((assetRegistry) => {
                        return assetRegistry.update(asset2);
                    });

            })
            .should.be.rejectedWith(/does not have .* access to resource/);

    });

    it('Bob can update his assets', () => {

        // Use the identity for Bob.
        return useIdentity(bobCardName)
            .then(() => {

                // Create the asset.
                const asset2 = factory.newResource('org.acme.sample', 'SampleAsset', '2');
                asset2.owner = factory.newRelationship('org.acme.sample', 'SampleParticipant', 'bob@email.com');
                asset2.value = '60';

                // Update the asset, then get the asset.
                return businessNetworkConnection.getAssetRegistry('org.acme.sample.SampleAsset')
                    .then((assetRegistry) => {
                        return assetRegistry.update(asset2)
                            .then(() => {
                                return assetRegistry.get('2');
                            });
                    });

            })
            .then((asset2) => {

                // Validate the asset.
                asset2.owner.getFullyQualifiedIdentifier().should.equal('org.acme.sample.SampleParticipant#bob@email.com');
                asset2.value.should.equal('60');

            });

    });

    it('Bob cannot update Alice\'s assets', () => {

        // Use the identity for Bob.
        return useIdentity(bobCardName)
            .then(() => {

                // Create the asset.
                const asset1 = factory.newResource('org.acme.sample', 'SampleAsset', '1');
                asset1.owner = factory.newRelationship('org.acme.sample', 'SampleParticipant', 'alice@email.com');
                asset1.value = '60';

                // Update the asset, then get the asset.
                return businessNetworkConnection.getAssetRegistry('org.acme.sample.SampleAsset')
                    .then((assetRegistry) => {
                        return assetRegistry.update(asset1);
                    });

            })
            .should.be.rejectedWith(/does not have .* access to resource/);

    });

    it('Alice can remove her assets', () => {

        // Use the identity for Alice.
        return useIdentity(aliceCardName)
            .then(() => {

                // Remove the asset, then test the asset exists.
                return businessNetworkConnection.getAssetRegistry('org.acme.sample.SampleAsset')
                    .then((assetRegistry) => {
                        return assetRegistry.remove('1')
                            .then(() => {
                                return assetRegistry.exists('1');
                            });
                    });

            })
            .should.eventually.be.false;

    });

    it('Alice cannot remove Bob\'s assets', () => {

        // Use the identity for Alice.
        return useIdentity(aliceCardName)
            .then(() => {

                // Remove the asset, then test the asset exists.
                return businessNetworkConnection.getAssetRegistry('org.acme.sample.SampleAsset')
                    .then((assetRegistry) => {
                        return assetRegistry.remove('2');
                    });

            })
            .should.be.rejectedWith(/does not have .* access to resource/);

    });

    it('Bob can remove his assets', () => {

        // Use the identity for Bob.
        return useIdentity(bobCardName)
            .then(() => {

                // Remove the asset, then test the asset exists.
                return businessNetworkConnection.getAssetRegistry('org.acme.sample.SampleAsset')
                    .then((assetRegistry) => {
                        return assetRegistry.remove('2')
                            .then(() => {
                                return assetRegistry.exists('2');
                            });
                    });

            })
            .should.eventually.be.false;

    });

    it('Bob cannot remove Alice\'s assets', () => {

        // Use the identity for Bob.
        return useIdentity(bobCardName)
            .then(() => {

                // Remove the asset, then test the asset exists.
                return businessNetworkConnection.getAssetRegistry('org.acme.sample.SampleAsset')
                    .then((assetRegistry) => {
                        return assetRegistry.remove('1');
                    });

            })
            .should.be.rejectedWith(/does not have .* access to resource/);

    });

    it('Alice can submit a transaction for her assets', () => {

        // Use the identity for Alice.
        return useIdentity(aliceCardName)
            .then(() => {

                // Submit the transaction.
                const transaction = factory.newTransaction('org.acme.sample', 'SampleTransaction');
                transaction.asset = factory.newRelationship('org.acme.sample', 'SampleAsset', '1');
                transaction.newValue = '50';
                return businessNetworkConnection.submitTransaction(transaction);

            })
            .then(() => {

                // Get the asset.
                return businessNetworkConnection.getAssetRegistry('org.acme.sample.SampleAsset')
                    .then((assetRegistry) => {
                        return assetRegistry.get('1');
                    });

            })
            .then((asset1) => {

                // Validate the asset.
                asset1.owner.getFullyQualifiedIdentifier().should.equal('org.acme.sample.SampleParticipant#alice@email.com');
                asset1.value.should.equal('50');

                // Validate the events.
                events.should.have.lengthOf(1);
                const event = events[0];
                event.eventId.should.be.a('string');
                event.timestamp.should.be.an.instanceOf(Date);
                event.asset.getFullyQualifiedIdentifier().should.equal('org.acme.sample.SampleAsset#1');
                event.oldValue.should.equal('10');
                event.newValue.should.equal('50');

            });

    });

    it('Alice cannot submit a transaction for Bob\'s assets', () => {

        // Use the identity for Alice.
        return useIdentity(aliceCardName)
            .then(() => {

                // Submit the transaction.
                const transaction = factory.newTransaction('org.acme.sample', 'SampleTransaction');
                transaction.asset = factory.newRelationship('org.acme.sample', 'SampleAsset', '2');
                transaction.newValue = '50';
                return businessNetworkConnection.submitTransaction(transaction);

            })
            .should.be.rejectedWith(/does not have .* access to resource/);

    });

    it('Bob can submit a transaction for his assets', () => {

        // Use the identity for Bob.
        return useIdentity(bobCardName)
            .then(() => {

                // Submit the transaction.
                const transaction = factory.newTransaction('org.acme.sample', 'SampleTransaction');
                transaction.asset = factory.newRelationship('org.acme.sample', 'SampleAsset', '2');
                transaction.newValue = '60';
                return businessNetworkConnection.submitTransaction(transaction);

            })
            .then(() => {

                // Get the asset.
                return businessNetworkConnection.getAssetRegistry('org.acme.sample.SampleAsset')
                    .then((assetRegistry) => {
                        return assetRegistry.get('2');
                    });

            })
            .then((asset2) => {

                // Validate the asset.
                asset2.owner.getFullyQualifiedIdentifier().should.equal('org.acme.sample.SampleParticipant#bob@email.com');
                asset2.value.should.equal('60');

                // Validate the events.
                events.should.have.lengthOf(1);
                const event = events[0];
                event.eventId.should.be.a('string');
                event.timestamp.should.be.an.instanceOf(Date);
                event.asset.getFullyQualifiedIdentifier().should.equal('org.acme.sample.SampleAsset#2');
                event.oldValue.should.equal('20');
                event.newValue.should.equal('60');

            });

    });

    it('Bob cannot submit a transaction for Alice\'s assets', () => {

        // Use the identity for Bob.
        return useIdentity(bobCardName)
            .then(() => {

                // Submit the transaction.
                const transaction = factory.newTransaction('org.acme.sample', 'SampleTransaction');
                transaction.asset = factory.newRelationship('org.acme.sample', 'SampleAsset', '1');
                transaction.newValue = '60';
                return businessNetworkConnection.submitTransaction(transaction);

            })
            .should.be.rejectedWith(/does not have .* access to resource/);

    });

});
