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

process.cwd(process.env.NODE_CONFIG_DIR);

const AdminConnection = require('composer-admin').AdminConnection;
const BusinessNetworkConnection = require('composer-client').BusinessNetworkConnection;
const { BusinessNetworkDefinition, CertificateUtil, IdCard } = require('composer-common');
const path = require('path');

// Testing specifics
const chai = require('chai');
chai.should();
chai.use(require('chai-as-promised'));

const namespace = 'org.clearing';

// These are the identities for test participants.
const bank0 = 'Bank0';
const bank1 = 'Bank1';
const bank2 = 'Bank2';
const bank3 = 'Bank3';

/**
 * Utility function for creating Participants
 * @param {*} factory factory for generation of resources
 * @param {*} bankId id of banking participant
 * @param {*} currency currency for banking participant
 * @return {*} bankPartipant
 */
function createBankingParticipant(factory, bankId, currency) {
    let bankPartipant = factory.newResource(namespace, 'BankingParticipant', bankId);
    bankPartipant.bankingName = bankId;
    bankPartipant.workingCurrency = currency;
    return bankPartipant;
}

/**
 * Utility function for creating transfer assets
 * @param {*} factory factory for generation of resources
 * @param {*} transferId identifier
 * @param {*} amount amount of transfer
 * @param {*} currency transfer currency
 * @param {*} globalState state to place transfer into
 * @param {*} fromBank from bank (debtor bank)
 * @param {*} toBank to bank (creditor bank)
 * @param {*} fromBankState to bank state (creditor bank)
 * @param {*} toBankState to bank state (creditor bank)
 * @return {*} transferAsset
 */
function createTransferAsset(factory, transferId, amount, currency, globalState, fromBank, toBank, fromBankState, toBankState) {
    let asset = factory.newResource(namespace, 'TransferRequest', transferId);
    let transfer = factory.newConcept(namespace, 'Transfer');
    transfer.amount = amount;
    transfer.fromAccount = 1234567;
    transfer.toAccount = 789123;
    transfer.currency = currency;
    asset.details = transfer;
    asset.fromBankState = fromBankState ? fromBankState : 'PENDING';
    asset.toBankState = toBankState ? toBankState : 'PENDING';
    asset.state = globalState;
    asset.fromBank = factory.newRelationship(namespace, 'BankingParticipant', fromBank);
    asset.toBank = factory.newRelationship(namespace, 'BankingParticipant', toBank);
    return asset;
}

describe('Fund Clearing Network', () => {
    // In-memory card store for testing so cards are not persisted to the file system
    const cardStore = require('composer-common').NetworkCardStoreManager.getCardStore( { type: 'composer-wallet-inmemory' } );

    // Embedded connection used for local testing
    const connectionProfile = {
        name: 'embedded',
        'x-type': 'embedded'
    };

    // Name of the business network card containing the administrative identity for the business network
    const adminCardName = 'admin';

    // Admin connection to the blockchain, used to deploy the business network
    let adminConnection;

        // This is the business network connection the tests will use.
    let businessNetworkConnection;

    // This is the factory for creating instances of types.
    let factory;

    // These are a list of receieved events.
    let events;

    let businessNetworkName;

    before(async () => {
        // Generate certificates for use with the embedded connection
        const credentials = CertificateUtil.generate({ commonName: 'admin' });

        // Identity used with the admin connection to deploy business networks
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

    /**
     *
     * @param {String} cardName The card name to use for this identity
     * @param {Object} identity The identity details
     */
    async function importCardForIdentity(cardName, identity) {
        const metadata = {
            userName: identity.userID,
            version: 1,
            enrollmentSecret: identity.userSecret,
            businessNetwork: businessNetworkName
        };
        const card = new IdCard(metadata, connectionProfile);
        await adminConnection.importCard(cardName, card);
    }

    // This is called before each test is executed.
    beforeEach(async () => {
        // Generate a business network definition from the project directory.
        let businessNetworkDefinition = await BusinessNetworkDefinition.fromDirectory(path.resolve(__dirname, '..'));
        businessNetworkName = businessNetworkDefinition.getName();
        await adminConnection.install(businessNetworkDefinition);
        const startOptions = {
            networkAdmins: [
                {
                    userName: 'admin',
                    enrollmentSecret: 'adminpw'
                }
            ]
        };
        const adminCards = await adminConnection.start(businessNetworkName, businessNetworkDefinition.getVersion(), startOptions);
        await adminConnection.importCard(adminCardName, adminCards.get('admin'));

        // Create and establish a business network connection
        businessNetworkConnection = new BusinessNetworkConnection({ cardStore: cardStore });
        events = [];
        businessNetworkConnection.on('event', event => {
            events.push(event);
        });
        await businessNetworkConnection.connect(adminCardName);

        // Get the factory for the business network.
        factory = businessNetworkConnection.getBusinessNetwork().getFactory();

        // Create the participants in the registry.
        const participantRegistry = await businessNetworkConnection.getParticipantRegistry(namespace + '.BankingParticipant');
        const bankPartipant0 = createBankingParticipant(factory, bank0, 'USD');
        const bankPartipant1 = createBankingParticipant(factory, bank1, 'EURO');
        const bankPartipant2 = createBankingParticipant(factory, bank2, 'STERLING');
        const bankPartipant3 = createBankingParticipant(factory, bank3, 'STERLING');
        participantRegistry.addAll([bankPartipant0, bankPartipant1, bankPartipant2, bankPartipant3]);

        // Get Asset registries
        const transferRegistry = await businessNetworkConnection.getAssetRegistry(namespace + '.TransferRequest');
        const batchRegistry = await businessNetworkConnection.getAssetRegistry(namespace + '.BatchTransferRequest');

        // Create the Transfer assets in the registry
        // createTransferAsset(factory, transferId, amount, currency, globalState, fromBank, toBank)
        const asset0 = createTransferAsset(factory, '0', 100, 'EURO', 'PENDING', bank0, bank1);
        const asset1 = createTransferAsset(factory, '1', 100000, 'EURO', 'PROCESSING', bank0, bank1);
        const asset2 = createTransferAsset(factory, '2', 101, 'STERLING', 'PENDING', bank0, bank2);
        const asset3 = createTransferAsset(factory, '3', 200, 'USD', 'PENDING', bank1, bank0, 'PRE_PROCESS_COMPLETE');
        const asset4 = createTransferAsset(factory, '4', 201, 'STERLING', 'PENDING', bank1, bank2);
        const asset5 = createTransferAsset(factory, '5', 300, 'USD', 'PENDING', bank2, bank0);
        const asset6 = createTransferAsset(factory, '6', 301, 'EURO', 'PRE_PROCESS_COMPLETE', bank2, bank1);
        const asset7 = createTransferAsset(factory, '7', 100, 'STERLING', 'PRE_PROCESS_COMPLETE', bank1, bank2);
        const asset8 = createTransferAsset(factory, '8', 100, 'STERLING', 'PRE_PROCESS_COMPLETE', bank1, bank2,'PRE_PROCESS_COMPLETE','PRE_PROCESS_COMPLETE');

        transferRegistry.addAll([asset0, asset1, asset2, asset3, asset4, asset5, asset6, asset7, asset8]);

        const batch0 = factory.newResource(namespace, 'BatchTransferRequest', '0');
        const settlememnt0 = factory.newConcept(namespace, 'Settlement');
        settlememnt0.amount = 301;
        settlememnt0.currency = 'EURO';
        settlememnt0.creditorBank = factory.newRelationship(namespace, 'BankingParticipant', bank0);
        settlememnt0.debtorBank = factory.newRelationship(namespace, 'BankingParticipant', bank1);
        batch0.settlement = settlememnt0;
        batch0.state = 'PENDING_PRE_PROCESS';
        batch0.parties = [factory.newRelationship(namespace, 'BankingParticipant', bank0), factory.newRelationship(namespace, 'BankingParticipant', bank1)];
        batch0.transferRequests = [factory.newRelationship(namespace, 'TransferRequest', asset0.getIdentifier()), factory.newRelationship(namespace, 'TransferRequest', asset3.getIdentifier())];

        // Will move to ReadyToSettle once mark preprocess is run by toBank
        const batch1 = factory.newResource(namespace, 'BatchTransferRequest', '1');
        const settlememnt1 = factory.newConcept(namespace, 'Settlement');
        settlememnt1.amount = 100;
        settlememnt1.currency = 'STERLING';
        settlememnt1.creditorBank = factory.newRelationship(namespace, 'BankingParticipant', bank2);
        settlememnt1.debtorBank = factory.newRelationship(namespace, 'BankingParticipant', bank1);
        batch1.settlement = settlememnt1;
        batch1.state = 'PENDING_PRE_PROCESS';
        batch1.parties = [factory.newRelationship(namespace, 'BankingParticipant', bank1), factory.newRelationship(namespace, 'BankingParticipant', bank2)];
        batch1.transferRequests = [factory.newRelationship(namespace, 'TransferRequest', asset6.getIdentifier())];

        // Ready to settle batch
        const batch2 = factory.newResource(namespace, 'BatchTransferRequest', '2');
        const settlement2 = factory.newConcept(namespace, 'Settlement');
        settlement2.amount = 100;
        settlement2.currency = 'STERLING';
        settlement2.creditorBank = factory.newRelationship(namespace, 'BankingParticipant', bank2);
        settlement2.debtorBank = factory.newRelationship(namespace, 'BankingParticipant', bank1);
        batch2.settlement = settlement2;
        batch2.state = 'READY_TO_SETTLE';
        batch2.parties = [factory.newRelationship(namespace, 'BankingParticipant', bank1), factory.newRelationship(namespace, 'BankingParticipant', bank2)];
        batch2.transferRequests = [factory.newRelationship(namespace, 'TransferRequest', asset7.getIdentifier())];

        // Ready to complete batch
        const batch3 = factory.newResource(namespace, 'BatchTransferRequest', '3');
        const settlement3 = factory.newConcept(namespace, 'Settlement');
        settlement3.amount = 100;
        settlement3.currency = 'STERLING';
        settlement3.creditorBank = factory.newRelationship(namespace, 'BankingParticipant', bank2);
        settlement3.debtorBank = factory.newRelationship(namespace, 'BankingParticipant', bank1);
        batch3.settlement = settlement3;
        batch3.state = 'PENDING_POST_PROCESS';
        batch3.parties = [factory.newRelationship(namespace, 'BankingParticipant', bank1), factory.newRelationship(namespace, 'BankingParticipant', bank2)];
        batch3.transferRequests = [factory.newRelationship(namespace, 'TransferRequest', asset8.getIdentifier())];

        batchRegistry.addAll([batch0, batch1, batch2, batch3]);

        // Issue the identities.
        let identity = await businessNetworkConnection.issueIdentity(namespace + '.BankingParticipant#' + bank0, bank0);
        await importCardForIdentity(bank0, identity);
        identity = await businessNetworkConnection.issueIdentity(namespace + '.BankingParticipant#' + bank1, bank1);
        await importCardForIdentity(bank1, identity);
        identity = await businessNetworkConnection.issueIdentity(namespace + '.BankingParticipant#' + bank2, bank2);
        await importCardForIdentity(bank2, identity);
        identity = await businessNetworkConnection.issueIdentity(namespace + '.BankingParticipant#' + bank3, bank3);
        await importCardForIdentity(bank3, identity);
    });

    /**
     * Reconnect using a different identity.
     * @param {String} cardName The name of the card for the identity to use
     */
    async function useIdentity(cardName) {
        await businessNetworkConnection.disconnect();
        businessNetworkConnection = new BusinessNetworkConnection({ cardStore: cardStore });
        events = [];
        businessNetworkConnection.on('event', (event) => {
            events.push(event);
        });
        await businessNetworkConnection.connect(cardName);
        factory = businessNetworkConnection.getBusinessNetwork().getFactory();
    }


    /**
     * Transaction FV tests, enforcing the Golden Path
     */
    describe('SubmitTransferRequest Transaction', () => {

        it('should enable the creation of a TransferRequest from one BankingParticipant to another', async () => {
            // Clear any init test data
            await useIdentity('admin');
            let assetRegistry = await businessNetworkConnection.getAssetRegistry(namespace + '.TransferRequest');
            const allAssets = await assetRegistry.getAll();
            await assetRegistry.removeAll(allAssets);

            await useIdentity(bank0);
            factory = businessNetworkConnection.getBusinessNetwork().getFactory();

            // Test values
            const txnId = 'TEST_TXN';
            const txnState = 'PENDING';
            const currency = 'EURO';
            const amount = 1234567.89;
            const fromAccount = 98789;
            const toAccount   = 12321;

            const txn = factory.newTransaction(namespace, 'SubmitTransferRequest');
            txn.transferId = txnId;
            txn.toBank = bank1;
            txn.state = txnState;

            const details = factory.newConcept(namespace, 'Transfer');
            details.currency = currency;
            details.amount = amount;
            details.fromAccount = fromAccount;
            details.toAccount = toAccount;
            txn.details = details;

            // Submit transaction
            await businessNetworkConnection.submitTransaction(txn);

            // Check it has been created correctlyß
            const myAsset = await assetRegistry.get(txnId);
            myAsset.should.exist;
            myAsset.fromBankState.should.equal(txnState);
            myAsset.toBankState.should.equal('PENDING');
            myAsset.state.should.equal('PENDING');
            myAsset.details.should.deep.equal(details);
            myAsset.toBank.getIdentifier().should.equal(bank1);
            myAsset.fromBank.getIdentifier().should.equal(bank0);

        });
    });

    describe('CreateBatch Transaction Action', () => {

        it('should net all TransactionRequests for the invoking Participant and emit an notification event for each BatchTransaferRequest created', async () => {
            await useIdentity(bank0);
            factory = businessNetworkConnection.getBusinessNetwork().getFactory();

            // Create the transaction
            let txn = factory.newTransaction(namespace, 'CreateBatch');
            let rate1 = factory.newConcept(namespace, 'UsdExchangeRate');
            rate1.to = 'EURO';
            rate1.rate = 0.8;
            let rate2 = factory.newConcept(namespace, 'UsdExchangeRate');
            rate2.to = 'STERLING';
            rate2.rate = 0.5;
            txn.usdRates = [rate1, rate2];
            txn.batchId = bank0 + '_batch1';

            const assetRegistry = await businessNetworkConnection.getAssetRegistry(namespace + '.BatchTransferRequest');

            // Clear all current test placed batches
            let allAssets = await assetRegistry.getAll();
            assetRegistry.removeAll(allAssets);

            // Issue the transaction
            await businessNetworkConnection.submitTransaction(txn);

            // Check the events were emitted
            events.should.have.lengthOf(2);

            // Check that each BatchTransaferRequest is present
            allAssets = await assetRegistry.getAll();
            allAssets.should.have.lengthOf(2);

            // Check for Batch0 content
            allAssets[0].settlement.amount.should.be.equal(75);
            allAssets[0].settlement.currency.should.be.equal('USD');
            allAssets[0].settlement.creditorBank.getIdentifier().should.be.equal(bank0);
            allAssets[0].settlement.debtorBank.getIdentifier().should.be.equal(bank1);

            // Check for Batch1 content
            allAssets[1].settlement.amount.should.be.equal(98);
            allAssets[1].settlement.currency.should.be.equal('USD');
            allAssets[1].settlement.creditorBank.getIdentifier().should.be.equal(bank0);
            allAssets[1].settlement.debtorBank.getIdentifier().should.be.equal(bank2);
        });
    });

    describe('MarkPreProcessComplete Transaction', () => {
        it('should mark all TransferRequests from issuing party as PRE_PROCESS_COMPLETE', async () => {
            // Get the factory for the business network.
            await businessNetworkConnection.connect('admin');
            factory = businessNetworkConnection.getBusinessNetwork().getFactory();
            const transaction = factory.newTransaction(namespace, 'MarkPreProcessComplete');
            transaction.batchId = '0';

            // Use the identity for Bank0.
            await useIdentity(bank0);
            await businessNetworkConnection.submitTransaction(transaction);

            // Retrieve and check
            const batchAssetRegistry = await businessNetworkConnection.getAssetRegistry(namespace + '.BatchTransferRequest');
            const transferAssetRegistry = await businessNetworkConnection.getAssetRegistry(namespace + '.TransferRequest');
            const batchAsset = await batchAssetRegistry.get(transaction.batchId);

            const transferRequests = batchAsset.transferRequests;

            for (let i=0; i<transferRequests.length; i++) {
                let transferRequest = transferRequests[i];
                let tr = await transferAssetRegistry.get(transferRequest.getIdentifier());
                if(tr.fromBank.getIdentifier() === bank0){
                    tr.fromBankState.should.equal('PRE_PROCESS_COMPLETE');
                }
            }
        });

        it('should move Batch to READY_TO_SETTLE once all TransferRequests are marked PRE_PROCESS_COMPLETE', async () => {
            // Get the factory for the business network.
            await businessNetworkConnection.connect('admin');
            factory = businessNetworkConnection.getBusinessNetwork().getFactory();
            const transaction = factory.newTransaction(namespace, 'MarkPreProcessComplete');
            transaction.batchId = '1';

            // Use the identity for Bank2.
            await useIdentity(bank2);
            await businessNetworkConnection.submitTransaction(transaction);

            // Retrieve and check
            const batchAssetRegistry = await businessNetworkConnection.getAssetRegistry(namespace + '.BatchTransferRequest');
            const batchAsset = await batchAssetRegistry.get(transaction.batchId);
            batchAsset.state.should.equal('READY_TO_SETTLE');
        });
    });

    describe('CompleteSettlement Transaction', () => {
        it('should move Batch to PENDING_POST_PROCESS', async () => {
            // Get the factory for the business network.
            await businessNetworkConnection.connect('admin');
            factory = businessNetworkConnection.getBusinessNetwork().getFactory();
            const transaction = factory.newTransaction(namespace, 'CompleteSettlement');
            transaction.batchId = '2';

            let rate1 = factory.newConcept(namespace, 'UsdExchangeRate');
            rate1.to = 'EURO';
            rate1.rate = 0.75;
            let rate2 = factory.newConcept(namespace, 'UsdExchangeRate');
            rate2.to = 'STERLING';
            rate2.rate = 1.75;
            transaction.usdRates = [rate1, rate2];

            // Use the identity for Bank0.
            await useIdentity(bank1);
            await businessNetworkConnection.submitTransaction(transaction);

            // Check new state
            const batchAssetRegistry = await businessNetworkConnection.getAssetRegistry(namespace + '.BatchTransferRequest');
            const batchAsset = await batchAssetRegistry.get(transaction.batchId);
            batchAsset.state.should.equal('PENDING_POST_PROCESS');
        });

        it('should only operate on Batches that are READY_TO_SETTLE', async () => {
            // Get the factory for the business network.
            await businessNetworkConnection.connect('admin');
            factory = businessNetworkConnection.getBusinessNetwork().getFactory();
            const transaction = factory.newTransaction(namespace, 'CompleteSettlement');
            transaction.batchId = '0';

            let rate1 = factory.newConcept(namespace, 'UsdExchangeRate');
            rate1.to = 'EURO';
            rate1.rate = 0.75;
            let rate2 = factory.newConcept(namespace, 'UsdExchangeRate');
            rate2.to = 'STERLING';
            rate2.rate = 1.75;
            transaction.usdRates = [rate1, rate2];

            // Use the identity for Bank0.
            await useIdentity(bank1);
            await businessNetworkConnection.submitTransaction(transaction).should.be.rejectedWith(/Unable to process transaction, BatchTransferRequest with id .* is in state PENDING_PRE_PROCESS but must be in state 'READY_TO_SETTLE'/);
        });
    });

    describe('MarkPostProcessComplete Transaction', () => {
        it('should enable toBank to MarkPostProcessComplete within batch referenced TransferRequests', async () => {
            // Get the factory for the business network.
            await businessNetworkConnection.connect('admin');
            factory = businessNetworkConnection.getBusinessNetwork().getFactory();
            const transaction = factory.newTransaction(namespace, 'MarkPostProcessComplete');
            transaction.batchId = '3';

            // Use the identity for Bank1.
            await useIdentity(bank1);
            await businessNetworkConnection.submitTransaction(transaction);

            // Check
            const batchAssetRegistry = await businessNetworkConnection.getAssetRegistry(namespace + '.BatchTransferRequest');
            const transferAssetRegistry = await businessNetworkConnection.getAssetRegistry(namespace + '.TransferRequest');
            const batchAsset = await batchAssetRegistry.get(transaction.batchId);
            const transferRequests = batchAsset.transferRequests;

            for (let i=0; i<transferRequests.length; i++) {
                let transferRequest = transferRequests[i];
                let tr = await transferAssetRegistry.get(transferRequest.getIdentifier());
                if(tr.fromBank.getIdentifier() === bank1){
                    tr.fromBankState.should.equal('COMPLETE');
                } else {
                    tr.fromBankState.should.equal('PRE_PROCESS_COMPLETE');
                }
            }
        });

        it('should enable fromBank to MarkPostProcessComplete within batch referenced TransferRequests', async () => {
            // Get the factory for the business network.
            await businessNetworkConnection.connect('admin');
            factory = businessNetworkConnection.getBusinessNetwork().getFactory();
            const transaction = factory.newTransaction(namespace, 'MarkPostProcessComplete');
            transaction.batchId = '3';

            // Use the identity for Bank2.
            await useIdentity(bank2);
            await businessNetworkConnection.submitTransaction(transaction);

            // Check
            const batchAssetRegistry = await businessNetworkConnection.getAssetRegistry(namespace + '.BatchTransferRequest');
            const transferAssetRegistry = await businessNetworkConnection.getAssetRegistry(namespace + '.TransferRequest');
            const batchAsset = await batchAssetRegistry.get(transaction.batchId);
            const transferRequests = batchAsset.transferRequests;

            for (let i=0; i<transferRequests.length; i++) {
                let transferRequest = transferRequests[i];
                let tr = await transferAssetRegistry.get(transferRequest.getIdentifier());
                if(tr.fromBank.getIdentifier() === bank2){
                    tr.fromBankState.should.equal('COMPLETE');
                } else {
                    tr.fromBankState.should.equal('PRE_PROCESS_COMPLETE');
                }
            }
        });

        it('should change global state of Batch and all referenced TransferRequest(s) when both toBank and fromBank have performed MarkPostProcessComplete', async () => {
            // Get the factory for the business network.
            await businessNetworkConnection.connect('admin');
            factory = businessNetworkConnection.getBusinessNetwork().getFactory();
            const transaction = factory.newTransaction(namespace, 'MarkPostProcessComplete');
            transaction.batchId = '3';

            // Use the identity for Bank1
            await useIdentity(bank1);
            await businessNetworkConnection.submitTransaction(transaction);

            // Use the identity for Bank2.
            await useIdentity(bank2);
            await businessNetworkConnection.submitTransaction(transaction);

            // Check
            const batchAssetRegistry = await businessNetworkConnection.getAssetRegistry(namespace + '.BatchTransferRequest');
            const transferAssetRegistry = await businessNetworkConnection.getAssetRegistry(namespace + '.TransferRequest');
            const batchAsset = await batchAssetRegistry.get(transaction.batchId);
            const transferRequests = batchAsset.transferRequests;

            // All TransferRequest(s) should be COMPLETE
            for (let i=0; i<transferRequests.length; i++) {
                let transferRequest = transferRequests[i];
                let tr = await transferAssetRegistry.get(transferRequest.getIdentifier());
                tr.state.should.equal('COMPLETE');
            }

            // Batch should be COMPLETE
            batchAsset.state.should.equal('COMPLETE');
        });

        it('should only operate on Batches that are PENDING_POST_PROCESS', async () => {
            // Get the factory for the business network.
            await businessNetworkConnection.connect('admin');
            factory = businessNetworkConnection.getBusinessNetwork().getFactory();
            const transaction = factory.newTransaction(namespace, 'MarkPostProcessComplete');
            transaction.batchId = '0';

            // Use the identity for Bank1
            await useIdentity(bank1);
            await businessNetworkConnection.submitTransaction(transaction).should.be.rejectedWith(/Unable to process transaction, BatchTransferRequest with id .* is in state PENDING_PRE_PROCESS but must be in state 'PENDING_POST_PROCESS'/);
        });
    });

     /**
     * Transaction Access (ACL rule enforcement)
     */
    describe('Transaction Access', () => {

        // MarkPreProcessComplete - only named parties
        it('should prevent a Participant not identified within the `parties` array from invoking a `MarkPreProcessComplete` transaction for a passed batch reference', async () => {
            // Get the factory for the business network.
            await businessNetworkConnection.connect('admin');
            factory = businessNetworkConnection.getBusinessNetwork().getFactory();
            const transaction = factory.newTransaction(namespace, 'MarkPreProcessComplete');
            transaction.batchId = '0';

            // Use the identity for Bank3.
            await useIdentity(bank3);
            await businessNetworkConnection.submitTransaction(transaction).should.be.rejectedWith(/Object with ID .* does not exist/);
        });

        // CompleteSettlement
        it('should prevent a Participant not identified within the `parties` array from invoking a `CompleteSettlement` transaction for a passed batch reference', async () => {
            await businessNetworkConnection.connect('admin');
            factory = businessNetworkConnection.getBusinessNetwork().getFactory();
            const transaction = factory.newTransaction(namespace, 'CompleteSettlement');
            transaction.batchId = '0';
            transaction.usdRates = [];

            // Use the identity for Bank0.
            await useIdentity(bank3);
            await businessNetworkConnection.submitTransaction(transaction).should.be.rejectedWith(/Object with ID .* does not exist/);
        });

        // MarkPostProcessComplete
        it('should prevent a Participant not identified within the `parties` array from invoking a `MarkPostProcessComplete` transaction for a passed batch reference', async () => {
            // Get the factory for the business network.
            await businessNetworkConnection.connect('admin');
            factory = businessNetworkConnection.getBusinessNetwork().getFactory();
            const transaction = factory.newTransaction(namespace, 'MarkPostProcessComplete');
            transaction.batchId = '3';

            // Use the identity for Bank0.
            await useIdentity(bank0);
            await businessNetworkConnection.submitTransaction(transaction).should.be.rejectedWith(/Object with ID .* does not exist/);
        });
    });

    /**
     * Asset Access (ACL rule enforcement)
     */
    describe('Asset Access', () => {
        it('should permit a Participant to read TransferRequest(s) if the Participant is identified in as a `toBank`', async () => {
            // Use the identity for Bank0
            // toBank: 3 & 5
            await useIdentity(bank0);

            const assetRegistry = await businessNetworkConnection.getAssetRegistry(namespace + '.TransferRequest');
            const allAssets = await assetRegistry.getAll();

            const expect1 = await assetRegistry.get('3');
            expect1.toBank.getFullyQualifiedIdentifier().should.equal(namespace + '.BankingParticipant#Bank0');
            const expect5 = await assetRegistry.get('5');
            expect5.toBank.getFullyQualifiedIdentifier().should.equal(namespace + '.BankingParticipant#Bank0');

            allAssets.should.contain(expect1);
            allAssets.should.contain(expect5);
        });

        it('should permit a Participant to read TransferRequest(s) if the Participant is identified in as a `fromBank`', async () => {
            // Use the identity for Bank0.
            // fromBank: 0, 1, 2
            await useIdentity(bank0);

            const assetRegistry = await businessNetworkConnection.getAssetRegistry(namespace + '.TransferRequest');
            const allAssets = await assetRegistry.getAll();

            const expect0 = await assetRegistry.get('0');
            expect0.fromBank.getFullyQualifiedIdentifier().should.equal(namespace + '.BankingParticipant#Bank0');
            const expect1 = await assetRegistry.get('1');
            expect1.fromBank.getFullyQualifiedIdentifier().should.equal(namespace + '.BankingParticipant#Bank0');
            const expect2 = await assetRegistry.get('2');
            expect2.fromBank.getFullyQualifiedIdentifier().should.equal(namespace + '.BankingParticipant#Bank0');

            allAssets.should.contain(expect0);
            allAssets.should.contain(expect1);
            allAssets.should.contain(expect2);
        });

        it('should prevent a Participant reading TransferRequest(s) if the Participant is not identified in as a `toBank` or `fromBank`', async () => {

            await useIdentity(bank2);
            let assetRegistry = await businessNetworkConnection.getAssetRegistry(namespace + '.TransferRequest');

            // Use the identity for Bank0.
            await useIdentity(bank0);
            assetRegistry = await businessNetworkConnection.getAssetRegistry(namespace + '.TransferRequest');
            const assets = await assetRegistry.getAll();

            // Loop over all retrieved assets, check is a participant
            assets.forEach((asset) => {
                let isIdentified = (asset.toBank.getIdentifier() === bank0 || asset.fromBank.getIdentifier() === bank0);
                isIdentified.should.be.true;
            });
        });

        it('should permit a Participant to update the TransferRequest(s) `toBankState` state if the Participant is identified in as a `toBank`', async () => {
            // Use the identity for Bank0.
            // toBank: 3 & 5
            await useIdentity(bank0);
            const assetRegistry = await businessNetworkConnection.getAssetRegistry(namespace + '.TransferRequest');

            // Retrieve
            let check3 = await assetRegistry.get('3');
            let check5 = await assetRegistry.get('5');

            // Modify
            check3.toBankState = 'PROCESSING';
            check5.toBankState = 'PROCESSING';
            await assetRegistry.updateAll([check3, check5]);

            // Validate modification
            check3 = await assetRegistry.get('3');
            check3.toBankState.should.equal('PROCESSING');

            check5 = await assetRegistry.get('5');
            check3.toBankState.should.equal('PROCESSING');
        });

        it('should prevent a Participant updating the TransferRequest(s) `toBankState` state if the Participant is not identified in as a `toBank`', async () => {
            // Use the identity for Bank0.
            // use asset1
            await useIdentity(bank0);
            let assetRegistry = await businessNetworkConnection.getAssetRegistry(namespace + '.TransferRequest');

            // Retrieve
            let check1 = await assetRegistry.get('1');
            // Modify
            check1.toBankState = 'COMPLETE';

            await useIdentity(bank3);
            assetRegistry = await businessNetworkConnection.getAssetRegistry(namespace + '.TransferRequest');
            await assetRegistry.update(check1).should.be.rejectedWith(/does not have .* access to resource/);
        });

        it('should permit a Participant to update the TransferRequest(s) `fromBankState` state if the Participant is identified in as a `fromBank`', async () => {
            // Use the identity for Bank0.
            // fromBank: 0,1,2
            await useIdentity(bank0);
            const assetRegistry = await businessNetworkConnection.getAssetRegistry(namespace + '.TransferRequest');

            // Retrieve
            let check0 = await assetRegistry.get('0');
            let check1 = await assetRegistry.get('1');
            let check2 = await assetRegistry.get('2');

            // Modify
            check0.fromBankState = 'COMPLETE';
            check1.fromBankState = 'PRE_PROCESS_COMPLETE';
            check2.fromBankState = 'ERROR';
            await assetRegistry.updateAll([check0, check1, check2]);

            // Validate modification
            check0 = await assetRegistry.get('0');
            check0.fromBankState.should.equal('COMPLETE');

            check1 = await assetRegistry.get('1');
            check1.fromBankState.should.equal('PRE_PROCESS_COMPLETE');

            check2 = await assetRegistry.get('2');
            check2.fromBankState.should.equal('ERROR');
        });

        it('should prevent a Participant updating the TransferRequest(s) `fromBankState` state if the Participant is not identified in as a `fromBank`', async () => {
            // Use the identity for Bank0.
            await useIdentity(bank0);

            let assetRegistry = await businessNetworkConnection.getAssetRegistry(namespace + '.TransferRequest');

            // Retrieve
            let check0 = await assetRegistry.get('0');

            // Modify
            check0.fromBankState = 'COMPLETE';

            // Change identities
            await useIdentity(bank2);
            assetRegistry = await businessNetworkConnection.getAssetRegistry(namespace + '.TransferRequest');
            await assetRegistry.update(check0).should.be.rejectedWith(/does not have .* access to resource/);
        });

        it('should permit a Participant to read BatchTransferRequest(s) if the Participant is identified within the `parties` array', async () => {
            // Use the identity for bank0 and bank1.
            await useIdentity(bank0);
            let batchRegistry = await businessNetworkConnection.getAssetRegistry(namespace + '.BatchTransferRequest');
            let batch0 = await batchRegistry.get('0');

            await useIdentity(bank1);
            batchRegistry = await businessNetworkConnection.getAssetRegistry(namespace + '.BatchTransferRequest');
            let batch1 = await batchRegistry.get('0');

            batch0.should.deep.equal(batch1);
        });

        it('should prevent a Participant reading BatchTransferRequest(s) if the Participant is not identified within the `parties` array', async () => {
            // Use the identity for Bank0.
            await useIdentity(bank0);

            const batchRegistry = await businessNetworkConnection.getAssetRegistry(namespace + '.BatchTransferRequest');
            const exists = await batchRegistry.exists('1');
            exists.should.be.false;
        });
    });
});
