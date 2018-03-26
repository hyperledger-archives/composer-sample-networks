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
const Util = require('./util');

const namespace = 'com.biz';

require('chai').should();

describe('Animal Tracking Network', function() {
    // In-memory card store for testing so cards are not persisted to the file system
    const cardStore = require('composer-common').NetworkCardStoreManager.getCardStore( { type: 'composer-wallet-inmemory' } );

    let adminConnection;
    let businessNetworkConnection;
    let factory;

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
        let businessNetworkDefinition;

        businessNetworkDefinition = await BusinessNetworkDefinition.fromDirectory(path.resolve(__dirname, '..'));

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
        factory = businessNetworkConnection.getBusinessNetwork().getFactory();
        await Util.setupDemo(businessNetworkConnection);
    });

    const runAnimalMovementDepartureAndGetAnimal = async () => {
        const transaction = factory.newTransaction(namespace, 'AnimalMovementDeparture');
        transaction.animal = factory.newRelationship(namespace, 'Animal', 'ANIMAL_1');
        transaction.from = factory.newRelationship(namespace, 'Business', 'BUSINESS_1');
        transaction.to = factory.newRelationship(namespace, 'Business', 'BUSINESS_2');
        transaction.fromField = factory.newRelationship(namespace, 'Field', 'FIELD_2');

        await businessNetworkConnection.submitTransaction(transaction);
        const animalRegistry = await businessNetworkConnection.getAssetRegistry(namespace + '.Animal');
        return animalRegistry.get('ANIMAL_1');
    };

    describe('#setupDemo', () => {
        it('should create the correct number of resources in the network', async () => {
            // Transaction is run in before
            const ar = await businessNetworkConnection.getAssetRegistry(namespace + '.Animal');
            const animals = await ar.getAll();
            animals.length.should.equal(8);

            const pr = await businessNetworkConnection.getParticipantRegistry(namespace + '.Farmer');
            const farmers = await pr.getAll();
            farmers.length.should.equal(2);

            const br = await businessNetworkConnection.getAssetRegistry(namespace + '.Business');
            const businesses = await br.getAll();
            businesses.length.should.equal(2);

            const fr = await businessNetworkConnection.getAssetRegistry(namespace + '.Field');
            const fields = await fr.getAll();
            fields.length.should.equal(4);
        });
    });

    describe('#onAnimalMovementDeparture', () => {
        it('should change an animal to IN_TRANSIT and add it to receiving business', async () => {
            const animal = await runAnimalMovementDepartureAndGetAnimal();
            animal.movementStatus.should.equal('IN_TRANSIT');

            const ar = await businessNetworkConnection.getAssetRegistry(namespace + '.Business');
            const business = await ar.get('BUSINESS_2');
            business.incomingAnimals[0].getIdentifier().should.equal('ANIMAL_1');
        });

        it('should fail if the animal is not IN_FIELD', async () => {
            const transaction = factory.newTransaction(namespace, 'AnimalMovementDeparture');
            transaction.animal = factory.newRelationship(namespace, 'Animal', 'ANIMAL_1');
            transaction.from = factory.newRelationship(namespace, 'Business', 'BUSINESS_1');
            transaction.to = factory.newRelationship(namespace, 'Business', 'BUSINESS_2');
            transaction.fromField = factory.newRelationship(namespace, 'Field', 'FIELD_1');

            try {
                await businessNetworkConnection.submitTransaction(transaction);
            } catch(err) {
                err.message.should.equal('Animal is already IN_TRANSIT');
            }
        });
    });

    describe('#onAnimalMovementArrival', () => {
        it('should change an animal to IN_FIELD and change its owner, location and remove it from incoming animals', async () => {
            let animal = await runAnimalMovementDepartureAndGetAnimal();
            let animalId = animal.getIdentifier();
            const transaction = factory.newTransaction(namespace, 'AnimalMovementArrival');
            transaction.animal = factory.newRelationship(namespace, 'Animal', animalId);
            transaction.from = factory.newRelationship(namespace, 'Business', 'BUSINESS_1');
            transaction.to = factory.newRelationship(namespace, 'Business', 'BUSINESS_2');
            transaction.arrivalField = factory.newRelationship(namespace, 'Field', 'FIELD_2');

            await businessNetworkConnection.submitTransaction(transaction);
            const ar = await businessNetworkConnection.getAssetRegistry(namespace + '.Animal');
            animal = await ar.get(animalId);
            animal.movementStatus.should.equal('IN_FIELD');
            animal.owner.getIdentifier().should.equal('FARMER_2');
            animal.location.getIdentifier().should.equal('FIELD_2');

            const br = await businessNetworkConnection.getAssetRegistry(namespace + '.Business');
            const business = await br.get('BUSINESS_2');
            business.incomingAnimals.forEach((animal) => {
                animal.getIdentifier().should.not.equal(animalId);
            });
        });
    });
});
