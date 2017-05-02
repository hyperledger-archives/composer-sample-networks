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
const NS = 'org.hyperledger_composer.marbles';

describe('Marbles', () => {

    // let adminConnection;
    let businessNetworkConnection;

    before(() => {
        BrowserFS.initialize(new BrowserFS.FileSystem.InMemory());
        const adminConnection = new AdminConnection({ fs: bfs_fs });
        return adminConnection.createProfile('defaultProfile', {
            type: 'embedded'
        })
            .then(() => {
                return adminConnection.connect('defaultProfile', 'admin', 'Xurw3yU9zI0l');
            })
            .then(() => {
                return BusinessNetworkDefinition.fromDirectory(path.resolve(__dirname, '..'));
            })
            .then((businessNetworkDefinition) => {
                return adminConnection.deploy(businessNetworkDefinition);
            })
            .then(() => {
                businessNetworkConnection = new BusinessNetworkConnection({ fs: bfs_fs });
                return businessNetworkConnection.connect('defaultProfile', 'marbles-network', 'admin', 'Xurw3yU9zI0l');
            });
    });

    describe('#trade', () => {

        it('should be able to trade marbles', () => {

            const factory = businessNetworkConnection.getBusinessNetwork().getFactory();

            // create the first player
            const dan = factory.newResource(NS, 'Player', 'daniel.selman@example.com');
            dan.firstName = 'Dan';
            dan.lastName = 'Selman';

            // create the marble
            const marble = factory.newResource(NS, 'Marble', 'MARBLE_001');
            marble.size = 'SMALL';
            marble.color = 'RED';
            marble.owner = factory.newRelationship(NS, 'Player', dan.$identifier);

            // create the second player
            const simon = factory.newResource(NS, 'Player', 'sstone1@example.com');
            simon.firstName = 'Simon';
            simon.lastName = 'Stone';

            const tradeMarble = factory.newTransaction(NS, 'TradeMarble');
            tradeMarble.newOwner = factory.newRelationship(NS, 'Player', simon.$identifier);
            tradeMarble.marble = factory.newRelationship(NS, 'Marble', marble.$identifier);

            // Get the asset registry.
            return businessNetworkConnection.getAssetRegistry(NS + '.Marble')
                .then((marbleRegistry) => {

                    // Add the Marble to the asset registry.
                    return marbleRegistry.add(marble)
                        .then(() => {
                            return businessNetworkConnection.getParticipantRegistry(NS + '.Player');
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
                            return businessNetworkConnection.getAssetRegistry(NS + '.Marble');
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
