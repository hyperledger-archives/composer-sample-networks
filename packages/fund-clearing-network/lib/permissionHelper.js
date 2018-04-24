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
/**
 * Permissions helper for ACL rules
 */

/**
 * Check to see if participant is within the transfer request
 * @param {*} transferRequest input TransferRequest
 * @param {*} participant the issuing Participant
 * @returns {boolean} boolean true/false
 */
function partyWithinTransferRequest(transferRequest, participant){ // eslint-disable-line no-unused-vars
    return (transferRequest.fromBank.getIdentifier() === participant.getIdentifier()) || (transferRequest.toBank.getIdentifier() === participant.getIdentifier());
}

/**
 * Check to see if participant is within the batch transfer request
 * @param {*} batchRequest the BatchTransferRequest
 * @param {*} participant the issuing Participant
 * @returns {boolean} boolean true/false
 */
function partyWithinBatchTransferRequest(batchRequest, participant){// eslint-disable-line no-unused-vars
    let allParties = [];
    for (let i=0; i<batchRequest.parties.length ; i++){
        let party = batchRequest.parties[i].getFullyQualifiedIdentifier();
        allParties.push(party);
    }
    return allParties.includes(participant.getFullyQualifiedIdentifier());
}
