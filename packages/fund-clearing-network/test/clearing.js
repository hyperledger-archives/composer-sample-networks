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

const rewire = require('rewire');
const clearingRewire = rewire('../lib/clearing');

const chai = require('chai');
chai.should();

describe('Transaction logic file "clearing"', function() {

    describe('#netTransfers', function() {

        const testFunction = clearingRewire.__get__('netTransfers');

        const partyId1 = 'id1';
        const partyId2 = 'id2';

        const party1 = {};
        party1.getIdentifier = function getIdentifier(){ return partyId1;};

        const party2 = {};
        party2.getIdentifier = function getIdentifier(){ return partyId2;};

        let usdDetails25 = {};
        usdDetails25.amount = 25;
        usdDetails25.currency = 'USD';

        let usdDetails50 = {};
        usdDetails50.amount = 50;
        usdDetails50.currency = 'USD';

        let usdDetails100 = {};
        usdDetails100.amount = 100;
        usdDetails100.currency = 'USD';

        let euroDetails50 = [];
        euroDetails50.amount = 50;
        euroDetails50.currency = 'EURO';

        let euroDetails100 = [];
        euroDetails100.amount = 100;
        euroDetails100.currency = 'EURO';

        it('should net a single transfer if invoked by the "toBank" participant in USD', function() {
            const transferRequest = {
                details: usdDetails100,
                toBank: party1
            };
            testFunction([transferRequest], partyId1, []).should.be.equal(100);
        });

        it('should net a single transfer if invoked by the "fromBank" participant in USD', function() {
            const transferRequest = {
                details: usdDetails100,
                toBank: party1
            };
            testFunction([transferRequest], partyId2, []).should.be.equal(-100);
        });

        it('should net a single transfer if invoked by the "toBank" participant accounting for exchange rate change', function() {
            const transferRequest = {
                details: euroDetails50,
                toBank: party1
            };

            const usdRate = {
                to: 'EURO',
                rate: 0.80
            };

            testFunction([transferRequest], partyId1, [usdRate]).should.be.equal(62.5);
        });

        it('should net a single transfer if invoked by the "fromBank" participant accounting for exchange rate change', function() {
            const transferRequest = {
                details: euroDetails50,
                toBank: party1
            };

            const usdRate = {
                to: 'EURO',
                rate: 0.80
            };

            testFunction([transferRequest], partyId2, [usdRate]).should.be.equal(-62.5);
        });

        it('should net multiple transfers if invoked by the "toBank" participant in USD', function() {

            const transferRequest25 = {
                details: usdDetails25,
                toBank: party1
            };

            const transferRequest50 = {
                details: usdDetails50,
                toBank: party2
            };

            const transferRequest100 = {
                details: usdDetails100,
                toBank: party1
            };
            testFunction([transferRequest25, transferRequest50, transferRequest100], partyId1, []).should.be.equal(75);

        });

        it('should net multiple transfers if invoked by the "fromBank" participant in USD', function() {

            const transferRequest25 = {
                details: usdDetails25,
                toBank: party1
            };

            const transferRequest50 = {
                details: usdDetails50,
                toBank: party2
            };

            const transferRequest100 = {
                details: usdDetails100,
                toBank: party1
            };
            testFunction([transferRequest25, transferRequest50, transferRequest100], partyId2, []).should.be.equal(-75);
        });

        it('should net multiple transfers if invoked by the "toBank" participant accounting for exchange rate change', function() {
            const transferRequest100USD = {
                details: usdDetails100,
                toBank: party1
            };

            const transferRequest50USD = {
                details: usdDetails50,
                toBank: party2
            };

            const transferRequest100EURO = {
                details: euroDetails100,
                toBank: party1
            };

            const usdRate = {
                to: 'EURO',
                rate: 0.80
            };

            testFunction([transferRequest100USD, transferRequest50USD, transferRequest100EURO], partyId1, [usdRate]).should.be.equal(175);
        });

        it('should net multiple transfers if invoked by the "fromBank" participant accounting for exchange rate change', function() {
            const transferRequest100USD = {
                details: usdDetails100,
                toBank: party1
            };

            const transferRequest50USD = {
                details: usdDetails50,
                toBank: party2
            };

            const transferRequest100EURO = {
                details: euroDetails100,
                toBank: party1
            };

            const usdRate = {
                to: 'EURO',
                rate: 0.80
            };

            testFunction([transferRequest100USD, transferRequest50USD, transferRequest100EURO], partyId2, [usdRate]).should.be.equal(-175);
        });
    });

    describe('#adjustSettlement', function() {

        const testFunction = clearingRewire.__get__('adjustSettlement');

        it('should not modify the settlement amount if both debtor and creditor currencies are the same', function() {
            testFunction(100, [], 'USD', 'USD').should.be.equal(100);
        });

        it('should modify the settlement amount if debtor currency is not USD but creditor is', function() {
            const usdEuroRate = {
                to: 'EURO',
                rate: 0.80
            };
            testFunction(100, [usdEuroRate], 'USD', 'EURO').should.be.equal(80);
        });

        it('should modify the settlement amount if debtor currency is USD but creditor is not', function() {
            const usdEuroRate = {
                to: 'EURO',
                rate: 0.80
            };
            testFunction(100, [usdEuroRate], 'EURO', 'USD').should.be.equal(125);
        });

        it('should modify the settlement amount if neither the debtor nor creditor currencies are USD', function() {
            const usdEuroRate = {
                to: 'EURO',
                rate: 0.80
            };
            const usdSterlingRate = {
                to: 'STERLING',
                rate: 0.5
            };
            testFunction(100, [usdEuroRate, usdSterlingRate], 'EURO', 'STERLING').should.be.equal(62.5);
        });
    });
});