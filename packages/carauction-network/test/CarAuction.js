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

const NS = 'org.acme.vehicle.auction';

describe('CarAuction', () => {
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

    describe('#makeOffer', () => {

        it('should add the offer to the offers of a vehicle listing', () => {

            const factory = businessNetworkConnection.getBusinessNetwork().getFactory();

            // create the auctioneer
            const seller = factory.newResource(NS, 'Member', 'daniel.selman@example.com');
            seller.firstName = 'Dan';
            seller.lastName = 'Selman';
            seller.balance = 0;

            // create the vehicle
            const vehicle = factory.newResource(NS, 'Vehicle', 'CAR_001');
            vehicle.owner = factory.newRelationship(NS, 'Member', seller.$identifier);

            // create the vehicle listing
            const listing = factory.newResource(NS, 'VehicleListing', 'LISTING_001');
            listing.reservePrice = 100;
            listing.description = 'My nice car';
            listing.state = 'FOR_SALE';
            listing.vehicle = factory.newRelationship(NS, 'Vehicle', 'CAR_001');

            // create the buyer
            const buyer = factory.newResource(NS, 'Member', 'sstone1@example.com');
            buyer.firstName = 'Simon';
            buyer.lastName = 'Stone';
            buyer.balance = 1000;

            // create another potential buyer
            const buyer2 = factory.newResource(NS, 'Member', 'whitemat@example.com');
            buyer2.firstName = 'Matthew';
            buyer2.lastName = 'White';
            buyer2.balance = 100;

            // create the auctioneer
            const auctioneer = factory.newResource(NS, 'Auctioneer', 'boss@auction.com');
            auctioneer.firstName = 'Mr';
            auctioneer.lastName = 'Smith';

            const offer = factory.newTransaction(NS, 'Offer');
            offer.member = factory.newRelationship(NS, 'Member', buyer.$identifier);
            offer.listing = factory.newRelationship(NS, 'VehicleListing', 'LISTING_001');
            offer.bidPrice = 200;

            // Get the asset registry.
            return businessNetworkConnection.getAssetRegistry(NS + '.Vehicle')
                .then((vehicleRegistry) => {

                    // Add the Vehicle to the asset registry.
                    return vehicleRegistry.add(vehicle)
                        .then(() => {
                            // Add the VehicleListing to the asset registry
                            return businessNetworkConnection.getAssetRegistry(NS + '.VehicleListing');
                        })
                        .then((vehicleListingRegistry) => {
                            // add the vehicle listing
                            return vehicleListingRegistry.add(listing);
                        })
                        .then(() => {
                            return businessNetworkConnection.getParticipantRegistry(NS + '.Member');
                        })
                        .then((userRegistry) => {
                            // add the members
                            return userRegistry.addAll([buyer, buyer2, seller]);
                        })
                        .then(() => {
                            return businessNetworkConnection.getParticipantRegistry(NS + '.Auctioneer');
                        })
                        .then((userRegistry) => {
                            // add the auctioneers
                            return userRegistry.addAll([auctioneer]);
                        })
                        .then(() => {
                            // Create the offer transaction and submit
                            return businessNetworkConnection.submitTransaction(offer);
                        })
                        .then(() => {
                            const lowOffer = factory.newTransaction(NS, 'Offer');
                            lowOffer.member = factory.newRelationship(NS, 'Member', buyer2.$identifier);
                            lowOffer.listing = factory.newRelationship(NS, 'VehicleListing', 'LISTING_001');
                            lowOffer.bidPrice = 50;
                            // Create the offer transaction and submit
                            return businessNetworkConnection.submitTransaction(lowOffer);
                        })
                        .then(() => {
                            return businessNetworkConnection.getAssetRegistry(NS + '.VehicleListing');
                        })
                        .then((vehicleListingRegistry) => {
                            // get the listing
                            return vehicleListingRegistry.get(listing.$identifier);
                        })
                        .then((newListing) => {
                            // both offers should have been added to the listing
                            newListing.offers.length.should.equal(2);
                        })
                        .then(() => {
                            // close the bidding
                            const closeBidding = factory.newTransaction(NS, 'CloseBidding');
                            closeBidding.listing = factory.newRelationship(NS, 'VehicleListing', 'LISTING_001');
                            return businessNetworkConnection.submitTransaction(closeBidding);
                        })
                        .then(() => {
                            return businessNetworkConnection.getAssetRegistry(NS + '.VehicleListing');
                        })
                        .then((vehicleListingRegistry) => {
                            // get the listing
                            return vehicleListingRegistry.get(listing.$identifier);
                        })
                        .then((newListing) => {
                            // the offer should have been added to the listing
                            newListing.state.should.equal('SOLD');
                        })
                        .then(() => {
                            return businessNetworkConnection.getParticipantRegistry(NS + '.Member');
                        })
                        .then((userRegistry) => {
                            // add the buyer and seller
                            return userRegistry.get(buyer.$identifier);
                        })
                        .then((buyer) => {
                            // check the buyer's balance
                            buyer.balance.should.equal(800);
                        })
                        .then(() => {
                            return businessNetworkConnection.getParticipantRegistry(NS + '.Member');
                        })
                        .then((userRegistry) => {
                            // add the buyer and seller
                            return userRegistry.get(seller.$identifier);
                        })
                        .then((newSeller) => {
                            // check the seller's balance
                            newSeller.balance.should.equal(200);
                        })
                        .then(() => {
                            return businessNetworkConnection.getParticipantRegistry(NS + '.Member');
                        })
                        .then((userRegistry) => {
                            // add the buyer and seller
                            return userRegistry.get(buyer.$identifier);
                        })
                        .then((newBuyer) => {
                            // check the buyer's balance
                            newBuyer.balance.should.equal(800);
                        })
                        .then(() => {
                            return businessNetworkConnection.getAssetRegistry(NS + '.Vehicle');
                        })
                        .then((vehicleRegistry) => {
                            // get the vehicle
                            return vehicleRegistry.get(vehicle.$identifier);
                        })
                        .then((newVehicle) => {
                            // check that the buyer now owns the car
                            newVehicle.owner.getIdentifier().should.equal(buyer.$identifier);
                        });
                });
        });

        describe('#closeBidding', function() {
            it('with no bids should result in RESERVE_NOT_MET', function() {
                const factory = businessNetworkConnection.getBusinessNetwork().getFactory();

                const seller = factory.newResource(NS, 'Member', 'daniel.selman@example.com');
                seller.firstName = 'Dan';
                seller.lastName = 'Selman';
                seller.balance = 0;

                // create the vehicle
                const vehicle = factory.newResource(NS, 'Vehicle', 'CAR_001');
                vehicle.owner = factory.newRelationship(NS, 'Member', seller.$identifier);

                // create the vehicle listing
                const listing = factory.newResource(NS, 'VehicleListing', 'LISTING_001');
                listing.reservePrice = 100;
                listing.description = 'My nice car';
                listing.state = 'FOR_SALE';
                listing.vehicle = factory.newRelationship(NS, 'Vehicle', vehicle.$identifier);

                // Get the asset registry.
                return businessNetworkConnection.getAssetRegistry(NS + '.Vehicle')
                    .then((vehicleRegistry) => {
                        // Add the Vehicle to the asset registry.
                        return vehicleRegistry.add(vehicle);
                    })
                    .then(() => {
                        return businessNetworkConnection.getParticipantRegistry(NS + '.Member');
                    })
                    .then((userRegistry) => {
                        return userRegistry.add(seller);
                    })
                    .then(() => {
                        return businessNetworkConnection.getAssetRegistry(NS + '.VehicleListing');
                    })
                    .then((vehicleListingRegistry) => {
                        // add the vehicle listing
                        return vehicleListingRegistry.add(listing);
                    })
                    .then(() => {
                        // close the bidding
                        const closeBidding = factory.newTransaction(NS, 'CloseBidding');
                        closeBidding.listing = factory.newRelationship(NS, 'VehicleListing', listing.$identifier);
                        return businessNetworkConnection.submitTransaction(closeBidding);
                    })
                    .then(() => {
                        return businessNetworkConnection.getAssetRegistry(NS + '.VehicleListing');
                    })
                    .then((vehicleListingRegistry) => {
                        return vehicleListingRegistry.get(listing.$identifier);
                    })
                    .then((vehicleListing) => {
                        vehicleListing.state.should.equal('RESERVE_NOT_MET');
                    });
            });
        });
    });
});
