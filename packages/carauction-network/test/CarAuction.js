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

const NS = 'org.acme.vehicle.auction';

describe('CarAuction', () => {
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

    describe('#makeOffer', () => {

        it('should add the offer to the offers of a vehicle listing', async () => {

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

            // Get the registries.
            const vehicleRegistry = await businessNetworkConnection.getAssetRegistry(NS + '.Vehicle');
            const vehicleListingRegistry = await businessNetworkConnection.getAssetRegistry(NS + '.VehicleListing');
            const userRegistry = await businessNetworkConnection.getParticipantRegistry(NS + '.Member');
            const auctioneerRegistry = await businessNetworkConnection.getParticipantRegistry(NS + '.Auctioneer');

            // Add the Vehicle to the asset registry.
            await vehicleRegistry.add(vehicle);

            // Add the VehicleListing to the asset registry
            await vehicleListingRegistry.add(listing);

            // add the members
            await userRegistry.addAll([buyer, buyer2, seller]);

            // add the auctioneers
            await auctioneerRegistry.addAll([auctioneer]);

            // Create the offer transaction and submit
            await businessNetworkConnection.submitTransaction(offer);

            // Create the offer transaction and submit
            const lowOffer = factory.newTransaction(NS, 'Offer');
            lowOffer.member = factory.newRelationship(NS, 'Member', buyer2.$identifier);
            lowOffer.listing = factory.newRelationship(NS, 'VehicleListing', 'LISTING_001');
            lowOffer.bidPrice = 50;
            await businessNetworkConnection.submitTransaction(lowOffer);

            // get the listing
            let newListing = await vehicleListingRegistry.get(listing.$identifier);

            // both offers should have been added to the listing
            newListing.offers.length.should.equal(2);

            // close the bidding
            const closeBidding = factory.newTransaction(NS, 'CloseBidding');
            closeBidding.listing = factory.newRelationship(NS, 'VehicleListing', 'LISTING_001');
            await businessNetworkConnection.submitTransaction(closeBidding);

            // get the listing
            newListing = await vehicleListingRegistry.get(listing.$identifier);

            // the offer should have been added to the listing
            newListing.state.should.equal('SOLD');

            // get the buyer and seller
            const theBuyer = await userRegistry.get(buyer.$identifier);
            const theSeller = await userRegistry.get(seller.$identifier);

            // check the buyer's balance
            theBuyer.balance.should.equal(800);

            // check the seller's balance
            theSeller.balance.should.equal(200);

            // get the vehicle
            const theVehicle = await vehicleRegistry.get(vehicle.$identifier);

            // check that the buyer now owns the car
            theVehicle.owner.getIdentifier().should.equal(buyer.$identifier);
        });

        describe('#closeBidding', () => {
            it('with no bids should result in RESERVE_NOT_MET', async () => {
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

                // Get the registries.
                const vehicleRegistry = await businessNetworkConnection.getAssetRegistry(NS + '.Vehicle');
                const vehicleListingRegistry = await businessNetworkConnection.getAssetRegistry(NS + '.VehicleListing');
                const userRegistry = await businessNetworkConnection.getParticipantRegistry(NS + '.Member');

                // Add the Vehicle to the asset registry.
                await vehicleRegistry.add(vehicle);

                // add the seller to the member registry
                await userRegistry.add(seller);

                // add the vehicle listing
                await vehicleListingRegistry.add(listing);

                // close the bidding
                const closeBidding = factory.newTransaction(NS, 'CloseBidding');
                closeBidding.listing = factory.newRelationship(NS, 'VehicleListing', listing.$identifier);
                await businessNetworkConnection.submitTransaction(closeBidding);

                // get the listing and check state
                const vehicleListing = await vehicleListingRegistry.get(listing.$identifier);
                vehicleListing.state.should.equal('RESERVE_NOT_MET');
            });
        });
    });
});
