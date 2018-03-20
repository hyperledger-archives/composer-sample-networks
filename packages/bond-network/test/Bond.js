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

const namespace = 'org.acme.bond';

describe('Publish Bond', () => {
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

    describe('#publish', () => {

        it('should be able to publish a bond', async () => {

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

            const issuerRegistry = await businessNetworkConnection.getParticipantRegistry(namespace + '.Issuer');

            // add the issuers
            await issuerRegistry.addAll([issuer]);

            // submit the publishBond
            await businessNetworkConnection.submitTransaction(publishBond);

            // get the bond and check its contents
            const bondRegistry = await businessNetworkConnection.getAssetRegistry(namespace + '.BondAsset');
            const newBondAsset = await bondRegistry.get(publishBond.ISINCode);
            newBondAsset.ISINCode.should.equal(publishBond.ISINCode);
        });
    });
});
