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
const BrowserFS = require('browserfs/dist/node/index');
const BusinessNetworkConnection = require('composer-client').BusinessNetworkConnection;
const BusinessNetworkDefinition = require('composer-common').BusinessNetworkDefinition;
const path = require('path');

require('chai').should();

const bfs_fs = BrowserFS.BFSRequire('fs');

describe('Acl checking', () => {

    // This is the business network connection the tests will use.
    let businessNetworkConnection;

    // This is the factory for creating instances of types.
    let factory;

    // These are the identities for Alice and Bob.
    let aliceIdentity;
    let bobIdentity;

    // These are a list of receieved events.
    let events;

    // This is called before each test is executed.
    beforeEach(() => {

        // Initialize an in-memory file system, so we do not write any files to the actual file system.
        BrowserFS.initialize(new BrowserFS.FileSystem.InMemory());

        // Create a new admin connection.
        const adminConnection = new AdminConnection({
            fs: bfs_fs
        });

        // Create a new connection profile that uses the embedded (in-memory) runtime.
        return adminConnection.createProfile('defaultProfile', {
            type: 'embedded'
        })
            .then(() => {

                // Establish an admin connection. The user ID must be admin. The user secret is
                // ignored, but only when the tests are executed using the embedded (in-memory)
                // runtime.
                return adminConnection.connect('defaultProfile', 'admin', 'adminpw');

            })
            .then(() => {

                // Generate a business network definition from the project directory.
                return BusinessNetworkDefinition.fromDirectory(path.resolve(__dirname, '..'));

            })
            .then((businessNetworkDefinition) => {

                // Deploy and start the business network defined by the business network definition.
                return adminConnection.deploy(businessNetworkDefinition);

            })
            .then(() => {

                // Create and establish a business network connection
                businessNetworkConnection = new BusinessNetworkConnection({
                    fs: bfs_fs
                });
                events = [];
                businessNetworkConnection.on('event', (event) => {
                    events.push(event);
                });
                return businessNetworkConnection.connect('defaultProfile', 'pii-network', 'admin', 'adminpw');

            })
            .then(() => {

                // Get the factory for the business network.
                factory = businessNetworkConnection.getBusinessNetwork().getFactory();

                // Create the participants.
                const alice = factory.newResource('org.acme.pii', 'Member', 'alice@email.com');
                alice.firstName = 'Alice';
                alice.lastName = 'A';
                const bob = factory.newResource('org.acme.pii', 'Member', 'bob@email.com');
                bob.firstName = 'Bob';
                bob.lastName = 'B';
                return businessNetworkConnection.getParticipantRegistry('org.acme.pii.Member')
                    .then((participantRegistry) => {
                        participantRegistry.addAll([alice, bob]);
                    });

            })
            .then(() => {

                // Issue the identities.
                return businessNetworkConnection.issueIdentity('org.acme.pii.Member#alice@email.com', 'alice1')
                    .then((identity) => {
                        aliceIdentity = identity;
                        return businessNetworkConnection.issueIdentity('org.acme.pii.Member#bob@email.com', 'bob1');
                    })
                    .then((identity) => {
                        bobIdentity = identity;
                    });

            });

    });

    /**
     * Reconnect using a different identity.
     * @param {Object} identity The identity to use.
     * @return {Promise} A promise that will be resolved when complete.
     */
    function useIdentity(identity) {
        return businessNetworkConnection.disconnect()
            .then(() => {
                businessNetworkConnection = new BusinessNetworkConnection({
                    fs: bfs_fs
                });
                events = [];
                businessNetworkConnection.on('event', (event) => {
                    events.push(event);
                });
                return businessNetworkConnection.connect('defaultProfile', 'pii-network', identity.userID, identity.userSecret);
            });
    }

    describe('#OwnRecordFullAccess', () => {

        it('bob should be able to read own data only', () => {

            return useIdentity(bobIdentity)
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

            return useIdentity(aliceIdentity)
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

            return useIdentity(aliceIdentity)
                .then(() => {

                    // alice grants access to her data to bob
                    const authorize = factory.newTransaction('org.acme.pii', 'AuthorizeAccess');
                    authorize.memberId = 'bob@email.com';
                    return businessNetworkConnection.submitTransaction(authorize);
                })
                .then(() => {
                    return useIdentity(bobIdentity);
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
                    return useIdentity(aliceIdentity);
                })
                .then(() => {

                    // alice revokes access to her data to bob
                    const revoke = factory.newTransaction('org.acme.pii', 'RevokeAccess');
                    revoke.memberId = 'bob@email.com';
                    return businessNetworkConnection.submitTransaction(revoke);
                })
                .then(() => {
                    return useIdentity(bobIdentity);
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