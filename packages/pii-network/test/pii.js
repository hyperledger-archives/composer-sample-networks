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

const namespace = 'org.acme.pii';

describe('Acl checking', () => {
    // In-memory card store for testing so cards are not persisted to the file system
    const cardStore = require('composer-common').NetworkCardStoreManager.getCardStore( { type: 'composer-wallet-inmemory' } );

    // Embedded connection used for local testing
    const connectionProfile = {
        name: 'embedded',
        'x-type': 'embedded'
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

    before(async () => {
        // Generate certificates for use with the embedded connection
        const credentials = CertificateUtil.generate({ commonName: 'admin' });

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

        await adminConnection.importCard(deployerCardName, deployerCard);
        await adminConnection.connect(deployerCardName);
    });

    /**
     *
     * @param {String} cardName The card name to use for this identity
     * @param {Object} identity The identity details
     */
    async function importCardForIdentity(cardName, identity) {
        const metadata = {
            userName: identity.userID,
            version: 1,
            enrollmentSecret: identity.userSecret,
            businessNetwork: businessNetworkName
        };
        const card = new IdCard(metadata, connectionProfile);
        await adminConnection.importCard(cardName, card);
    }

    // This is called before each test is executed.
    beforeEach(async () => {
        // Generate a business network definition from the project directory.
        const businessNetworkDefinition = await BusinessNetworkDefinition.fromDirectory(path.resolve(__dirname, '..'));

        businessNetworkName = businessNetworkDefinition.getName();
        await adminConnection.install(businessNetworkDefinition);

        const startOptions = {
            networkAdmins: [
                {
                    userName: 'admin',
                    enrollmentSecret: 'adminpw'
                }
            ]
        };
        const adminCards = await adminConnection.start(businessNetworkName, businessNetworkDefinition.getVersion(), startOptions);
        await adminConnection.importCard(adminCardName, adminCards.get('admin'));

        // Create and establish a business network connection
        businessNetworkConnection = new BusinessNetworkConnection({ cardStore: cardStore });
        events = [];
        businessNetworkConnection.on('event', event => {
            events.push(event);
        });
        await businessNetworkConnection.connect(adminCardName);

        // Get the factory for the business network.
        factory = businessNetworkConnection.getBusinessNetwork().getFactory();

        // Create the participants.
        const alice = factory.newResource(namespace, 'Member', 'alice@email.com');
        alice.firstName = 'Alice';
        alice.lastName = 'A';

        const bob = factory.newResource(namespace, 'Member', 'bob@email.com');
        bob.firstName = 'Bob';
        bob.lastName = 'B';

        const participantRegistry = await businessNetworkConnection.getParticipantRegistry(namespace + '.Member');
        await participantRegistry.addAll([alice, bob]);

        // Issue the identities.
        const identityA = await businessNetworkConnection.issueIdentity(namespace + '.Member#alice@email.com', 'alice1');
        await importCardForIdentity(aliceCardName, identityA);
        const identityB = await businessNetworkConnection.issueIdentity(namespace + '.Member#bob@email.com', 'bob1');
        await importCardForIdentity(bobCardName, identityB);
    });

    /**
     * Reconnect using a different identity.
     * @param {String} cardName The identity to use.
     */
    async function useIdentity(cardName) {
        await businessNetworkConnection.disconnect();

        businessNetworkConnection = new BusinessNetworkConnection({ cardStore: cardStore });
        events = [];
        businessNetworkConnection.on('event', (event) => {
            events.push(event);
        });

        await businessNetworkConnection.connect(cardName);
    }

    describe('#OwnRecordFullAccess', () => {

        it('bob should be able to read own data only', async () => {
            await useIdentity(bobCardName);
             // use a query, bob should only see his own data
            const results = await businessNetworkConnection.query('selectMembers');
            // check results
            results.length.should.equal(1);
            results[0].getIdentifier().should.equal('bob@email.com');
        });

        it('alice should be able to read own data only', async () => {
            await useIdentity(aliceCardName);
            // use a query, alice should only see her own data
            const results = await businessNetworkConnection.query('selectMembers');
            // check results
            results.length.should.equal(1);
            results[0].getIdentifier().should.equal('alice@email.com');
        });

    });

    describe('#ForeignRecordConditionalAccess', () => {

        it('bob should be able to read alice data IFF granted access', async () => {

            await useIdentity(aliceCardName);

            // alice grants access to her data to bob
            const authorize = factory.newTransaction('org.acme.pii', 'AuthorizeAccess');
            authorize.memberId = 'bob@email.com';
            await businessNetworkConnection.submitTransaction(authorize);

            await useIdentity(bobCardName);

            // use a query, bob should be able to see his own and alice's data
            let results = await businessNetworkConnection.query('selectMembers');
            // check results
            results.length.should.equal(2);

            // switch back to alice
            await useIdentity(aliceCardName);

            // alice revokes access to her data to bob
            const revoke = factory.newTransaction('org.acme.pii', 'RevokeAccess');
            revoke.memberId = 'bob@email.com';
            await businessNetworkConnection.submitTransaction(revoke);

            await useIdentity(bobCardName);

            // use a query, bob should now only see his own data
            results = await businessNetworkConnection.query('selectMembers');
            // check results
            results.length.should.equal(1);
        });
    });
});