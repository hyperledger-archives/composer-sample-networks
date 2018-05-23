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
const namespace = 'org.clearing';

/**
 * Submit a TransferRequest
 * @param {org.clearing.SubmitTransferRequest} tx passed transaction body
 * @transaction
 */
async function submitTransferRequest(tx) { // eslint-disable-line no-unused-vars
    // Required registries for this transaction
    const participantRegistry = await getParticipantRegistry(namespace + '.BankingParticipant'); // eslint-disable-line no-undef
    const transferAssetRegistry = await getAssetRegistry(namespace + '.TransferRequest'); // eslint-disable-line no-undef

    // Use a factory for creation of asset
    const factory = getFactory(); // eslint-disable-line no-undef
    const transferRequest = factory.newResource(namespace, 'TransferRequest', tx.transferId);

    // tx aspects
    transferRequest.details = tx.details;
    transferRequest.state = 'PENDING';

    // Participant aspects
    const fromBankRef = factory.newRelationship(namespace, 'BankingParticipant', getCurrentParticipant().getIdentifier()); // eslint-disable-line no-undef
    transferRequest.fromBank = fromBankRef;
    transferRequest.fromBankState = tx.state;

    const toBank = await participantRegistry.get(tx.toBank);
    const toBankRef = factory.newRelationship(namespace, 'BankingParticipant', toBank.getIdentifier());
    transferRequest.toBank = toBankRef;
    transferRequest.toBankState = 'PENDING';

    // Add to asset registry
    await transferAssetRegistry.add(transferRequest);
}

/**
 * Determine the net transfer between a banking pair, accounting for exchange rates
 * @param {TransferRequest[]} transferRequests array of TransferRequest objects
 * @param {participantId} participantId string participant identity
 * @param {rates[]} rates array of UsdExchangeRate objects
 * @return {Double} net amount in USD
 */
function netTransfers(transferRequests, participantId, rates) {
    let amount = 0;
    // Determine amount in USD
    for (let request of transferRequests) {
        if (request.toBank.getIdentifier() === participantId) {
            if (request.details.currency === 'USD') {
                amount += request.details.amount;
            } else {
                let filteredRate = rates.filter((rate) => { return rate.to === request.details.currency; });
                amount += request.details.amount / filteredRate[0].rate;
            }
        } else {
            if (request.details.currency === 'USD') {
                amount -= request.details.amount;
            } else {
                let filteredRate = rates.filter((rate) => { return rate.to === request.details.currency; });
                amount -= request.details.amount / filteredRate[0].rate;
            }
        }
    }
    return amount;
}

/**
 * Creates a BatchTransaferRequest for each bank pairing from all current
 * TransferRequests that are in the 'PENDING' state and involve the Transaction
 * invoking Participant
 * @param {org.clearing.CreateBatch} tx passed transaction body
 * @transaction
 */
async function createBatch(tx) {  // eslint-disable-line no-unused-vars

    // Required registries for this transaction
    const participantRegistry = await getParticipantRegistry(namespace + '.BankingParticipant'); // eslint-disable-line no-undef
    const batchAssetRegistry = await getAssetRegistry(namespace + '.BatchTransferRequest'); // eslint-disable-line no-undef
    const transferAssetRegistry = await getAssetRegistry(namespace + '.TransferRequest'); // eslint-disable-line no-undef

    // Use a factory for creation of assets
    const factory = getFactory(); // eslint-disable-line no-undef

    // Invoking Participant
    const invokeParticipant = getCurrentParticipant(); // eslint-disable-line no-undef
    // Retrieve participants
    const participants = await participantRegistry.getAll();

    // Error if only one participant
    if (participants.length <= 1) {
        throw new Error('Insufficient number of BankingParticipant(s) to proceed with batch creation');
    }

    // Run queries for all TransferRequests in the 'PENDING' state for each possible bank pairing with invoking Participant
    for (let i = 0; i < participants.length; i++) {
        // Don't consider self
        if (participants[i].getIdentifier() === invokeParticipant.getIdentifier()) {
            continue;
        }
        // Query for pending transfer requests
        const transferRequests = await query('TransferRequestsByBanksInState', { 'bank1': 'resource:org.clearing.BankingParticipant#' + invokeParticipant.getIdentifier(), 'bank2': 'resource:org.clearing.BankingParticipant#' + participants[i].getIdentifier(), 'state': 'PENDING' }); // eslint-disable-line no-undef

        // Conditionally process returned transfer requests
        if (transferRequests.length > 0) {
            // Create BatchTransferRequest(s) for each interaction pairing
            let batch = factory.newResource(namespace, 'BatchTransferRequest', tx.batchId + ':' +
                invokeParticipant.getIdentifier() + '-' + participants[i].getIdentifier());

            // Determine settlement amount in USD, adjust to creditor currency later
            let amount = netTransfers(transferRequests, invokeParticipant.getIdentifier(), tx.usdRates);

            let settlement = factory.newConcept(namespace, 'Settlement');
            if (amount >= 0) {
                settlement.creditorBank = factory.newRelationship(namespace, 'BankingParticipant', invokeParticipant.getIdentifier());
                settlement.debtorBank = factory.newRelationship(namespace, 'BankingParticipant', participants[i].getIdentifier());
                settlement.currency = invokeParticipant.workingCurrency;
            } else {
                settlement.creditorBank = factory.newRelationship(namespace, 'BankingParticipant', participants[i].getIdentifier());
                settlement.debtorBank = factory.newRelationship(namespace, 'BankingParticipant', invokeParticipant.getIdentifier());
                settlement.currency = participants[i].workingCurrency;
            }

            // Adjust settlement to be in creditor currency (amount is currently in USD)
            if (settlement.currency !== 'USD') {
                let filteredRate = tx.usdRates.filter((rate) => { return rate.to === settlement.currency; });
                amount = amount * filteredRate[0].rate;
            }

            settlement.amount = Math.abs(amount);
            batch.settlement = settlement;
            batch.parties = [
                factory.newRelationship(namespace, 'BankingParticipant', invokeParticipant.getIdentifier()),
                factory.newRelationship(namespace, 'BankingParticipant', participants[i].getIdentifier())
            ];
            batch.state = 'PENDING_PRE_PROCESS';

            // Add references to each TransferRequest in the batch
            let requestsArray = new Array();
            for (let transferRequest of transferRequests) {
                let transferRelationship = factory.newRelationship(namespace, 'TransferRequest', transferRequest.getIdentifier());
                requestsArray.push(transferRelationship);
            }
            batch.transferRequests = requestsArray;

            // Add the batch to registry
            await batchAssetRegistry.add(batch);

            // Update all TransferRequest states
            for (let transferRequest of transferRequests) {
                transferRequest.state = 'PROCESSING';
                await transferAssetRegistry.update(transferRequest);
            }

            // Emit BatchCreatedEvent event
            let event = factory.newEvent(namespace, 'BatchCreatedEvent');
            event.batchId = batch.getIdentifier();
            emit(event); // eslint-disable-line no-undef
        }
    }
}

/**
 * Transaction to indicate that all inbound pre-process transfers have been complete client side
 * for the 'toBank'. It is assumed that logic exists on the 'fromBank' that the
 * @param {org.clearing.MarkPreProcessComplete} tx passed transaction body
 * @transaction
 */
async function markPreProcessComplete(tx) {  // eslint-disable-line no-unused-vars

    // Required registries for this transaction
    const batchAssetRegistry = await getAssetRegistry(namespace + '.BatchTransferRequest'); // eslint-disable-line no-undef
    const transferAssetRegistry = await getAssetRegistry(namespace + '.TransferRequest'); // eslint-disable-line no-undef

    // Get the batch asset
    let batch = await batchAssetRegistry.get(tx.batchId);

    // Update all TransferRequests where currentParticipant is 'to/fromBank' member
    let updateArray = new Array();
    let readyToSettle = true;
    for (let transferRequestRef of batch.transferRequests) {
        let transferReq = await transferAssetRegistry.get(transferRequestRef.getIdentifier());
        if (transferReq.toBank.getIdentifier() === getCurrentParticipant().getIdentifier()) { // eslint-disable-line no-undef
            transferReq.toBankState = 'PRE_PROCESS_COMPLETE';
            if ((transferReq.toBankState === 'PRE_PROCESS_COMPLETE') && (transferReq.fromBankState === 'PRE_PROCESS_COMPLETE')) {
                transferReq.state = 'PRE_PROCESS_COMPLETE';
            }
            updateArray.push(transferReq);
        }
        if (transferReq.fromBank.getIdentifier() === getCurrentParticipant().getIdentifier()) { // eslint-disable-line no-undef
            transferReq.fromBankState = 'PRE_PROCESS_COMPLETE';
            if ((transferReq.toBankState === 'PRE_PROCESS_COMPLETE') && (transferReq.fromBankState === 'PRE_PROCESS_COMPLETE')) {
                transferReq.state = 'PRE_PROCESS_COMPLETE';
            }
            updateArray.push(transferReq);
        }
        if (transferReq.state !== 'PRE_PROCESS_COMPLETE') {
            readyToSettle = false;
        }
    }
    // Update batch
    await transferAssetRegistry.updateAll(updateArray);

    // If all now marked, we can class the batch as READY_TO_SETTLE
    if (readyToSettle) {
        batch.state = 'READY_TO_SETTLE';
        await batchAssetRegistry.update(batch);
    }
}

/**
 * Adjust the settlement between a banking pair, accounting for latest exchange rates
 * @param {Double} amount to be settled
 * @param {UsdExchangeRate[]} rates arrays of UsdExchangeRate objects
 * @param {String} creditorCurrency currency of creditor
 * @param {String} debtorCurrency currency of debtor
 * @return {Double} net amount to be paid by debtor
 */
function adjustSettlement(amount, rates, creditorCurrency, debtorCurrency) {
    // If same currency, no need to adjust for exchange rate
    if (creditorCurrency !== debtorCurrency) {
        let fromRate = 1;
        let toRate = 1;

        if (creditorCurrency !== 'USD') {
            toRate = rates.filter((rate) => { return rate.to === creditorCurrency; })[0].rate;
        }

        if (debtorCurrency !== 'USD') {
            fromRate = rates.filter((rate) => { return rate.to === debtorCurrency; })[0].rate;
        }
        amount = amount * (fromRate / toRate);
    }
    return amount;
}

/**
 * Transaction to adjust Bank participant funds according to net settlement amount in creditor currency
 * @param {org.clearing.CompleteSettlement} tx passed transaction body
 * @transaction
 */
async function completeSettlement(tx) {  // eslint-disable-line no-unused-vars

    // Required registries for this transaction
    const participantRegistry = await getParticipantRegistry(namespace + '.BankingParticipant'); // eslint-disable-line no-undef
    const batchAssetRegistry = await getAssetRegistry(namespace + '.BatchTransferRequest'); // eslint-disable-line no-undef

    // Use the batch being completed
    let batch = await batchAssetRegistry.get(tx.batchId);

    // Can only complete if batch is in 'READY_TO_SETTLE' state
    if (batch.state !== 'READY_TO_SETTLE') {
        throw new Error('Unable to process transaction, BatchTransferRequest with id ' + tx.batchId + ' is in state ' + batch.state + ' but must be in state \'READY_TO_SETTLE\'');
    }

    // Get the settlement
    const settlement = batch.settlement;

    // Get the participants involved
    const creditor = await participantRegistry.get(settlement.creditorBank.getIdentifier());
    const debtor = await participantRegistry.get(settlement.debtorBank.getIdentifier());

    // Adjust funds, accounting for currency exchange rate
    let debtoramount = adjustSettlement(settlement.amount, tx.usdRates, creditor.workingCurrency, debtor.workingCurrency);

    creditor.fundBalance += settlement.amount;
    debtor.fundBalance -= debtoramount;
    await participantRegistry.update(creditor);
    await participantRegistry.update(debtor);

    // Mark Batch as ready for post process
    batch.state = 'PENDING_POST_PROCESS';
    await batchAssetRegistry.update(batch);
}

/**
 * Transaction to indicate that all post-process transfers have been complete client side
 * @param {org.clearing.MarkPostProcessComplete} tx passed transaction body
 * @transaction
 */
async function markPostProcessComplete(tx) {  // eslint-disable-line no-unused-vars

    // Required registries for this transaction
    const batchAssetRegistry = await getAssetRegistry(namespace + '.BatchTransferRequest'); // eslint-disable-line no-undef
    const transferAssetRegistry = await getAssetRegistry(namespace + '.TransferRequest'); // eslint-disable-line no-undef

    // Use the referenced Batch
    let batch = await batchAssetRegistry.get(tx.batchId);

    // Should only operate on batches in PENDING_POST_PROCESS state
    if (batch.state !== 'PENDING_POST_PROCESS') {
        throw new Error('Unable to process transaction, BatchTransferRequest with id ' + tx.batchId + ' is in state ' + batch.state + ' but must be in state \'PENDING_POST_PROCESS\'');
    }

    // Update all TransferRequests where currentParticipant is 'to/fromBank' member
    let updateArray = new Array();
    let batchComplete = true;
    for (let transferRequestRef of batch.transferRequests) {
        let transferReq = await transferAssetRegistry.get(transferRequestRef.getIdentifier());
        if (transferReq.toBank.getIdentifier() === getCurrentParticipant().getIdentifier()) { // eslint-disable-line no-undef
            transferReq.toBankState = 'COMPLETE';
            if ((transferReq.toBankState === 'COMPLETE') && (transferReq.fromBankState === 'COMPLETE')) {
                transferReq.state = 'COMPLETE';
            }
            updateArray.push(transferReq);
        }
        if (transferReq.fromBank.getIdentifier() === getCurrentParticipant().getIdentifier()) { // eslint-disable-line no-undef
            transferReq.fromBankState = 'COMPLETE';
            if ((transferReq.toBankState === 'COMPLETE') && (transferReq.fromBankState === 'COMPLETE')) {
                transferReq.state = 'COMPLETE';
            }
            updateArray.push(transferReq);
        }
        if (transferReq.state !== 'COMPLETE') {
            batchComplete = false;
        }
    }

    // Perform batch update
    await transferAssetRegistry.updateAll(updateArray);

    // If all now marked, we can class the batch as COMPLETE
    if (batchComplete) {
        batch.state = 'COMPLETE';
        await batchAssetRegistry.update(batch);
    }
}