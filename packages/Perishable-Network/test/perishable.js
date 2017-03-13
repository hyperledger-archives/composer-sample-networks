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
const path = require('path');

require('chai').should();

const NS = 'org.acme.shipping.perishable';

describe('Perishable Shipping Network', () => {

    let businessNetworkConnection;

    before(() => {
        const adminConnection = new AdminConnection();
        return adminConnection.createProfile('defaultProfile', {
            type: 'embedded'
        })
            .then(() => {
                return adminConnection.connect('defaultProfile', 'WebAppAdmin', 'DJY27pEnl16d');
            })
            .then(() => {
                return BusinessNetworkDefinition.fromDirectory(path.resolve(__dirname, '..'));
            })
            .then((businessNetworkDefinition) => {
                return adminConnection.deploy(businessNetworkDefinition);
            })
            .then(() => {
                businessNetworkConnection = new BusinessNetworkConnection();
                return businessNetworkConnection.connect('defaultProfile', 'org.acme.shipping.perishable.network', 'WebAppAdmin', 'DJY27pEnl16d');
            });
    });

    describe('#shipment', () => {

        it('should receive base price for a shipment within temperature range', () => {

            const factory = businessNetworkConnection.getBusinessNetwork().getFactory();

            // create the grower
            const grower = factory.newResource(NS, 'Grower', 'farmer@email.com');
            const growerAddress = factory.newConcept(NS, 'Address');
            growerAddress.country = 'USA';
            grower.address = growerAddress;
            grower.accountBalance = 0;

            // create the importer
            const importer = factory.newResource(NS, 'Importer', 'supermarket@email.com');
            const importerAddress = factory.newConcept(NS, 'Address');
            importerAddress.country = 'UK';
            importer.address = importerAddress;
            importer.accountBalance = 0;

            // create the shipper
            const shipper = factory.newResource(NS, 'Shipper', 'shipper@email.com');
            const shipperAddress = factory.newConcept(NS, 'Address');
            shipperAddress.country = 'Panama';
            shipper.address = shipperAddress;
            shipper.accountBalance = 0;

            // create the contract
            const contract = factory.newResource(NS, 'Contract', 'CON_001');
            contract.grower = factory.newRelationship(NS, 'Grower', 'farmer@email.com' );
            contract.importer = factory.newRelationship(NS, 'Importer', 'supermarket@email.com' );
            contract.shipper = factory.newRelationship(NS, 'Shipper', 'shipper@email.com' );
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate()+1);
            contract.arrivalDateTime = tomorrow; // the shipment has to arrive tomorrow
            contract.unitPrice = 0.5; // pay 50 cents per unit
            contract.minTemperature = 2; // min temperature for the cargo
            contract.maxTemperature = 10; // max temperature for the cargo
            contract.minPenaltyFactor = 0.2; // we reduce the price by 20 cents for every degree below the min temp
            contract.maxPenaltyFactor = 0.1; // we reduce the price by 10 cents for every degree above the max temp

            // create the shipment
            const shipment = factory.newResource(NS, 'Shipment', 'SHIP_001');
            shipment.type = 'BANANAS';
            shipment.unitCount = 5000;
            shipment.contract = factory.newRelationship(NS, 'Contract', 'CON_001' );

            return businessNetworkConnection.getParticipantRegistry(NS + '.Grower')
            .then((growerRegistry) => {
                // add the growers
                return growerRegistry.addAll([grower]);
            })
            .then(() => {
                return businessNetworkConnection.getParticipantRegistry(NS + '.Importer');
            })
            .then((importerRegistry) => {
                // add the importers
                return importerRegistry.addAll([importer]);
            })
            .then(() => {
                return businessNetworkConnection.getParticipantRegistry(NS + '.Shipper');
            })
            .then((shipperRegistry) => {
                // add the shippers
                return shipperRegistry.addAll([shipper]);
            })
            .then(() => {
                return businessNetworkConnection.getAssetRegistry(NS + '.Contract');
            })
            .then((contractRegistry) => {
                // add the contracts
                return contractRegistry.addAll([contract]);
            })
            .then(() => {
                return businessNetworkConnection.getAssetRegistry(NS + '.Shipment');
            })
            .then((shipmentRegistry) => {
                // add the shipments
                return shipmentRegistry.addAll([shipment]);
            })
            .then(() => {
                // submit the temperature reading
                const tempReading = factory.newTransaction(NS, 'TemperatureReading');
                tempReading.shipment = factory.newRelationship(NS, 'Shipment', 'SHIP_001' );
                tempReading.centigrade = 4.5;
                return businessNetworkConnection.submitTransaction(tempReading);
            })
            .then(() => {
                // submit the shipment received
                const received = factory.newTransaction(NS, 'ShipmentReceived');
                received.shipment = factory.newRelationship(NS, 'Shipment', 'SHIP_001' );
                return businessNetworkConnection.submitTransaction(received);
            })
            .then(() => {
                return businessNetworkConnection.getParticipantRegistry(NS + '.Grower');
            })
            .then((growerRegistry) => {
                // check the grower's balance
                return growerRegistry.get(grower.email);
            })
            .then((newGrower) => {
                // console.log(JSON.stringify(businessNetworkConnection.getBusinessNetwork().getSerializer().toJSON(newGrower)));
                newGrower.accountBalance.should.equal(2500);
            })
            .then(() => {
                return businessNetworkConnection.getParticipantRegistry(NS + '.Importer');
            })
            .then((importerRegistry) => {
                // check the importer's balance
                return importerRegistry.get(importer.email);
            })
            .then((newImporter) => {
                newImporter.accountBalance.should.equal(-2500);
            });
        });
    });
});
