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

const Util = require('./util');

const namespace = 'com.biz';

require('chai').should();

describe('Animal Tracking Network', function() {
    // In-memory card store for testing so cards are not persisted to the file system
    const cardStore = new MemoryCardStore();

    let adminConnection;
    let businessNetworkConnection;
    let factory;

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
        }).then(() => {
            factory = businessNetworkConnection.getBusinessNetwork().getFactory();
            return Util.setupDemo(businessNetworkConnection);
        });
    });

    const runAnimalMovementDepartureAndGetAnimal = () => {
        const transaction = factory.newTransaction(namespace, 'AnimalMovementDeparture');
        transaction.animal = factory.newRelationship(namespace, 'Animal', 'ANIMAL_1');
        transaction.from = factory.newRelationship(namespace, 'Business', 'BUSINESS_1');
        transaction.to = factory.newRelationship(namespace, 'Business', 'BUSINESS_2');
        transaction.fromField = factory.newRelationship(namespace, 'Field', 'FIELD_2');

        return businessNetworkConnection.submitTransaction(transaction)
            .then(() => {
                return businessNetworkConnection.getAssetRegistry(namespace + '.Animal');
            })
            .then((animalRegistry) => {
                return animalRegistry.get('ANIMAL_1');
            });
    };

    describe('#setupDemo', () => {
        it('should create the correct number of resources in the network', () => {
            // Transaction is run in before
            return businessNetworkConnection.getAssetRegistry(namespace + '.Animal')
                .then((ar) => {
                    return ar.getAll();
                })
                .then((animals) => {
                    animals.length.should.equal(8);

                    return businessNetworkConnection.getParticipantRegistry(namespace + '.Farmer');
                })
                .then((pr) => {
                    return pr.getAll();
                })
                .then((farmers) => {
                    farmers.length.should.equal(2);
                    return businessNetworkConnection.getAssetRegistry(namespace + '.Business');
                })
                .then((ar) => {
                    return ar.getAll();
                })
                .then((businesses) => {
                    businesses.length.should.equal(2);
                    return businessNetworkConnection.getAssetRegistry(namespace + '.Field');
                })
                .then((ar) => {
                    return ar.getAll();
                })
                .then((fields) => {
                    fields.length.should.equal(4);
                });
        });
    });

    describe('#onAnimalMovementDeparture', function() {

        it('should change an animal to IN_TRANSIT and add it to receiving business', function() {
            return runAnimalMovementDepartureAndGetAnimal()
                .then((animal) => {
                    animal.movementStatus.should.equal('IN_TRANSIT');

                    return businessNetworkConnection.getAssetRegistry(namespace + '.Business');
                })
                .then((ar) => {
                    return ar.get('BUSINESS_2');
                })
                .then((business) => {
                    business.incomingAnimals[0].getIdentifier().should.equal('ANIMAL_1');
                });
        });

        it('should fail if the animal is not IN_FIELD', () => {
            const transaction = factory.newTransaction(namespace, 'AnimalMovementDeparture');
            transaction.animal = factory.newRelationship(namespace, 'Animal', 'ANIMAL_1');
            transaction.from = factory.newRelationship(namespace, 'Business', 'BUSINESS_1');
            transaction.to = factory.newRelationship(namespace, 'Business', 'BUSINESS_2');
            transaction.fromField = factory.newRelationship(namespace, 'Field', 'FIELD_1');

            return businessNetworkConnection.submitTransaction(transaction)
                .catch((err) => {
                    err.message.should.equal('Animal is already IN_TRANSIT');
                });
        });
    });

    describe('#onAnimalMovementArrival', () => {
        it('should change an animal to IN_FIELD and change its owner, location and remove it from incoming animals', () => {
            let animalId;
            return runAnimalMovementDepartureAndGetAnimal()
                .then(animal => {
                    animalId = animal.getIdentifier();
                    const transaction = factory.newTransaction(namespace, 'AnimalMovementArrival');
                    transaction.animal = factory.newRelationship(namespace, 'Animal', animalId);
                    transaction.from = factory.newRelationship(namespace, 'Business', 'BUSINESS_1');
                    transaction.to = factory.newRelationship(namespace, 'Business', 'BUSINESS_2');
                    transaction.arrivalField = factory.newRelationship(namespace, 'Field', 'FIELD_2');

                    return businessNetworkConnection.submitTransaction(transaction);
                })
                .then(() => {
                    return businessNetworkConnection.getAssetRegistry(namespace + '.Animal');
                })
                .then((ar) => {
                    return ar.get(animalId);
                })
                .then((animal) => {
                    animal.movementStatus.should.equal('IN_FIELD');
                    animal.owner.getIdentifier().should.equal('FARMER_2');
                    animal.location.getIdentifier().should.equal('FIELD_2');

                    return businessNetworkConnection.getAssetRegistry(namespace + '.Business');
                })
                .then((ar) => {
                    return ar.get('BUSINESS_2');
                })
                .then((business) => {
                    business.incomingAnimals.forEach((animal) => {
                        animal.getIdentifier().should.not.equal(animalId);
                    });
                });
        });
    });
});
