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

const namespace = 'org.acme.trading';

describe('Commodity Trading', () => {
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

    describe('#tradeCommodity', () => {

        it('should be able to trade a commodity', () => {
            const factory = businessNetworkConnection.getBusinessNetwork().getFactory();

            // create the traders
            const dan = factory.newResource(namespace, 'Trader', 'dan@email.com');
            dan.firstName = 'Dan';
            dan.lastName = 'Selman';

            const simon = factory.newResource(namespace, 'Trader', 'simon@email.com');
            simon.firstName = 'Simon';
            simon.lastName = 'Stone';

            // create the commodity
            const commodity = factory.newResource(namespace, 'Commodity', 'EMA');
            commodity.description = 'Corn';
            commodity.mainExchange = 'Euronext';
            commodity.quantity = 100;
            commodity.owner = factory.newRelationship(namespace, 'Trader', dan.$identifier);

            // create the trade transaction
            const trade = factory.newTransaction(namespace, 'Trade');
            trade.newOwner = factory.newRelationship(namespace, 'Trader', simon.$identifier);
            trade.commodity = factory.newRelationship(namespace, 'Commodity', commodity.$identifier);

            // the owner should of the commodity should be dan
            commodity.owner.$identifier.should.equal(dan.$identifier);

            // create the second commodity
            const commodity2 = factory.newResource(namespace, 'Commodity', 'XYZ');
            commodity2.description = 'Soya';
            commodity2.mainExchange = 'Chicago';
            commodity2.quantity = 50;
            commodity2.owner = factory.newRelationship(namespace, 'Trader', dan.$identifier);

            // register for events from the business network
            businessNetworkConnection.on('event', (event) => {
                console.log( 'Received event: ' + event.getFullyQualifiedIdentifier() + ' for commodity ' + event.commodity.getIdentifier() );
            });

            // Get the asset registry.
            return businessNetworkConnection.getAssetRegistry(namespace + '.Commodity')
                .then((assetRegistry) => {

                    // add the commodities to the asset registry.
                    return assetRegistry.addAll([commodity,commodity2])
                        .then(() => {
                            return businessNetworkConnection.getParticipantRegistry(namespace + '.Trader');
                        })
                        .then((participantRegistry) => {
                            // add the traders
                            return participantRegistry.addAll([dan, simon]);
                        })
                        .then(() => {
                            // submit the transaction
                            return businessNetworkConnection.submitTransaction(trade);
                        })
                        .then(() => {
                            return businessNetworkConnection.getAssetRegistry(namespace + '.Commodity');
                        })
                        .then((assetRegistry) => {
                            // re-get the commodity
                            return assetRegistry.get(commodity.$identifier);
                        })
                        .then((newCommodity) => {
                            // the owner of the commodity should now be simon
                            newCommodity.owner.$identifier.should.equal(simon.$identifier);
                        })
                        .then(() => {
                            // use a query
                            return businessNetworkConnection.query('selectCommoditiesByExchange', {exchange : 'Euronext'});
                        })
                        .then((results) => {
                            // check results
                            results.length.should.equal(1);
                            results[0].getIdentifier().should.equal('EMA');
                        })
                        .then(() => {
                            // use another query
                            return businessNetworkConnection.query('selectCommoditiesByOwner', {owner : 'resource:' + simon.getFullyQualifiedIdentifier()});
                        })
                        .then((results) => {
                            //  check results
                            results.length.should.equal(1);
                            results[0].getIdentifier().should.equal('EMA');
                        })
                        .then(() => {
                            // submit the remove transaction
                            const remove = factory.newTransaction(namespace, 'RemoveHighQuantityCommodities');
                            return businessNetworkConnection.submitTransaction(remove);
                        })
                        .then(() => {
                            // use a query
                            return businessNetworkConnection.query('selectCommodities');
                        })
                        .then((results) => {
                            // check results, should only have 1 commodity left
                            results.length.should.equal(1);
                            results[0].getIdentifier().should.equal('XYZ');
                        });
                });
        });
    });
});