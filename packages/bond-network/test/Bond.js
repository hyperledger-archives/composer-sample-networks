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

const namespace = 'org.acme.bond';

describe('Publish Bond', () => {
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

    describe('#publish', () => {

        it('should be able to publish a bond', () => {

            const factory = businessNetworkConnection.getBusinessNetwork().getFactory();

            // create the issuer
            const issuer = factory.newResource(namespace, 'Issuer', 'daniel.selman@example.com');
            issuer.name = 'Dan Selman Holdings';

            // create the bond
            const paymentFrequency = factory.newConcept(namespace, 'PaymentFrequency');
            paymentFrequency.periodMultiplier = 6;
            paymentFrequency.period = 'MONTH';
            const bond = factory.newConcept(namespace, 'Bond');
            bond.instrumentId = ['ACME'];
            bond.exchangeId = ['NYSE'];
            bond.maturity = new Date('2018-02-27T21:03:52+00:00');
            bond.parValue = 1000;
            bond.faceAmount = 1000;
            bond.paymentFrequency = paymentFrequency;
            bond.dayCountFraction = 'EOM';
            bond.issuer = factory.newRelationship(namespace, 'Issuer', issuer.$identifier);

            // create the publish the bond transaction
            const publishBond = factory.newTransaction(namespace, 'PublishBond');
            publishBond.bond = bond;
            publishBond.ISINCode = 'US4592001014';

            return businessNetworkConnection.getParticipantRegistry(namespace + '.Issuer')
            .then((issuerRegistry) => {
                // add the issuers
                return issuerRegistry.addAll([issuer]);
            })
            .then(() => {
                // submit the publishBond
                return businessNetworkConnection.submitTransaction(publishBond);
            })
            .then(() => {
                return businessNetworkConnection.getAssetRegistry(namespace + '.BondAsset');
            })
            .then((bondRegistry) => {
                // get the bond and check its contents
                return bondRegistry.get(publishBond.ISINCode);
            })
            .then((newBondAsset) => {
                newBondAsset.ISINCode.should.equal(publishBond.ISINCode);
            });
        });
    });
});
