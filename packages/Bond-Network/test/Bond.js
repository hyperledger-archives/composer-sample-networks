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

const NS = 'org.acme.bond';

describe('Publish Bond', () => {

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
                return businessNetworkConnection.connect('defaultProfile', 'org.acme.bond.network', 'WebAppAdmin', 'DJY27pEnl16d');
            });
    });

    describe('#publish', () => {

        it('should be able to publish a bond', () => {

            const factory = businessNetworkConnection.getBusinessNetwork().getFactory();

            // create the issuer
            const issuer = factory.newResource(NS, 'Issuer', 'daniel.selman@uk.ibm.com');
            issuer.name = 'Dan Selman Holdings';

            // create the bond
            const paymentFrequency = factory.newConcept(NS, 'PaymentFrequency');
            paymentFrequency.periodMultiplier = 6;
            paymentFrequency.period = 'MONTH';
            const bond = factory.newConcept(NS, 'Bond');
            bond.instrumentId = ['IBM'];
            bond.exchangeId = ['NYSE'];
            bond.maturity = new Date('2018-02-27T21:03:52+00:00');
            bond.parValue = 1000;
            bond.faceAmount = 1000;
            bond.paymentFrequency = paymentFrequency;
            bond.dayCountFraction = 'EOM';
            bond.issuer = factory.newRelationship(NS, 'Issuer', issuer.$identifier);

            // create the publish the bond transaction
            const publishBond = factory.newTransaction(NS, 'PublishBond');
            publishBond.bond = bond;
            publishBond.ISINCode = 'US4592001014';

            return businessNetworkConnection.getParticipantRegistry(NS + '.Issuer')
            .then((issuerRegistry) => {
                // add the issuers
                return issuerRegistry.addAll([issuer]);
            })
            .then(() => {
                // submit the publishBond
                return businessNetworkConnection.submitTransaction(publishBond);
            })
            .then(() => {
                return businessNetworkConnection.getAssetRegistry(NS + '.BondAsset');
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
