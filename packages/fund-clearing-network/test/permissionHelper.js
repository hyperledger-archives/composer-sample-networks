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
const helperRewire = rewire('../lib/permissionHelper');

const chai = require('chai');
chai.should();

describe('PermissionsHelper', function() {

    describe('#PartyWithinTransferRequest', function() {

        const party1 = {};
        party1.getIdentifier = function getIdentifier(){ return 'id1';};

        const party2 = {};
        party2.getIdentifier = function getIdentifier(){ return 'id2';};

        const party3 = {};
        party3.getIdentifier = function getIdentifier(){ return 'id3';};

        const fromBank = {};
        fromBank.getIdentifier = function getIdentifier(){ return 'id1';};
        const toBank = {};
        toBank.getIdentifier = function getIdentifier(){ return 'id2';};

        const transferRequest  = {
            fromBank: fromBank,
            toBank: toBank
        };

        const testFunction = helperRewire.__get__('partyWithinTransferRequest');

        it('should return true if the party is within the TransferRequest as fromBank', () => {
            testFunction(transferRequest, party1).should.equal(true);
        });

        it('should return true if the party is within the TransferRequest as toBank', () => {
            testFunction(transferRequest, party2).should.equal(true);
        });

        it('should return false if the party is not within the TransferRequest', () => {
            testFunction(transferRequest, party3).should.equal(false);
        });
    });

    describe('#PartyWithinBatchTransferRequest', function() {

        const party1 = {};
        party1.getFullyQualifiedIdentifier = function getFullyQualifiedIdentifier(){ return 'id1';};

        const party2 = {};
        party2.getFullyQualifiedIdentifier = function getFullyQualifiedIdentifier(){ return 'id2';};

        const party3 = {};
        party3.getFullyQualifiedIdentifier = function getFullyQualifiedIdentifier(){ return 'id3';};

        const batchTransferRequest  = {
            parties: [party1, party2]
        };

        const testFunction = helperRewire.__get__('partyWithinBatchTransferRequest');

        it('should return true if the party is within the BatchTransferRequest as fromBank', () => {
            testFunction(batchTransferRequest, party1).should.equal(true);
        });

        it('should return true if the party is within the BatchTransferRequest as toBank', () => {
            testFunction(batchTransferRequest, party2).should.equal(true);
        });

        it('should return false if the party is not within the BatchTransferRequest', () => {
            testFunction(batchTransferRequest, party3).should.equal(false);
        });
    });
});