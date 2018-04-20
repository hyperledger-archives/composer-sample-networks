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
const bank0 = 'CongaWonga';
const bank1 = 'DogeDosh';
const bank2 = 'PenguinPennies';
const bank3 = 'GoatCoin';

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
 * @return {*} transferAsset
 */
function createTransferAsset(factory, transferId, amount, currency, globalState, fromBank, toBank) {
    let asset = factory.newResource(namespace, 'TransferRequest', transferId);
    let transfer = factory.newConcept(namespace, 'Transfer');
    transfer.amount = amount;
    transfer.fromAccount = 1234567;
    transfer.toAccount = 789123;
    transfer.currency = currency;
    asset.details = transfer;
    asset.fromBankState = 'PENDING';
    asset.toBankState = 'PENDING';
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
        const asset3 = createTransferAsset(factory, '3', 200, 'USD', 'PENDING', bank1, bank0);
        const asset4 = createTransferAsset(factory, '4', 201, 'STERLING', 'PENDING', bank1, bank2);
        const asset5 = createTransferAsset(factory, '5', 300, 'USD', 'PENDING', bank2, bank0);
        const asset6 = createTransferAsset(factory, '6', 301, 'EURO', 'PENDING', bank2, bank1);
        const asset7 = createTransferAsset(factory, '7', 100, 'STERLING', 'PRE_PROCESS_COMPLETE', bank1, bank2);

        transferRegistry.addAll([asset0, asset1, asset2, asset3, asset4, asset5, asset6, asset7]);

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

        batchRegistry.addAll([batch0, batch1, batch2]);

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


    describe('Asset Creation', () => {

    });

    describe('Asset Access', () => {
        it('should permit a Participant to read TransferRequest(s) if the Participant is identified in as a `toBank`', async () => {
            // Use the identity for Bank0
            // toBank: 3 & 5
            await useIdentity(bank0);

            const assetRegistry = await businessNetworkConnection.getAssetRegistry(namespace + '.TransferRequest');
            const allAssets = await assetRegistry.getAll();

            const expect1 = await assetRegistry.get('3');
            expect1.toBank.getFullyQualifiedIdentifier().should.equal(namespace + '.BankingParticipant#CongaWonga');
            const expect5 = await assetRegistry.get('5');
            expect5.toBank.getFullyQualifiedIdentifier().should.equal(namespace + '.BankingParticipant#CongaWonga');

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
            expect0.fromBank.getFullyQualifiedIdentifier().should.equal(namespace + '.BankingParticipant#CongaWonga');
            const expect1 = await assetRegistry.get('1');
            expect1.fromBank.getFullyQualifiedIdentifier().should.equal(namespace + '.BankingParticipant#CongaWonga');
            const expect2 = await assetRegistry.get('2');
            expect2.fromBank.getFullyQualifiedIdentifier().should.equal(namespace + '.BankingParticipant#CongaWonga');

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

    describe('CreateBatch Transaction Action', () => {

        it('should net all TransactionRequests for the invoking Participant and emit an notification event for each BatchTransaferRequest created', async () => {
            await useIdentity(bank0);
            factory = businessNetworkConnection.getBusinessNetwork().getFactory();

            // Create the transaction
            let txn = factory.newTransaction(namespace, 'CreateBatch');
            let rate1 = factory.newConcept(namespace, 'UsdExchangeRate');
            rate1.to = 'EURO';
            rate1.rate = 0.75;
            let rate2 = factory.newConcept(namespace, 'UsdExchangeRate');
            rate2.to = 'STERLING';
            rate2.rate = 1.75;
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

            // Check for Batch content
            // Batch0
            allAssets[0].settlement.amount.should.be.equal(250.00000000000003);
            allAssets[0].settlement.currency.should.be.equal('EURO');
            allAssets[0].settlement.creditorBank.getIdentifier().should.be.equal(bank1);
            allAssets[0].settlement.debtorBank.getIdentifier().should.be.equal(bank0);

            allAssets[1].settlement.amount.should.be.equal(626);
            allAssets[1].settlement.currency.should.be.equal('STERLING');
            allAssets[1].settlement.creditorBank.getIdentifier().should.be.equal(bank2);
            allAssets[1].settlement.debtorBank.getIdentifier().should.be.equal(bank0);
        });
    });

    describe('Transaction Access', () => {
        // CreateBatch - anyone can do this
        it('should permit any Participant to invoke a `CreateBatch` transaction', async () => {
            // Get the factory for the business network.
            await businessNetworkConnection.connect('admin');
            factory = businessNetworkConnection.getBusinessNetwork().getFactory();

            let txn = factory.newTransaction(namespace, 'CreateBatch');
            let rate1 = factory.newConcept(namespace, 'UsdExchangeRate');
            rate1.to = 'EURO';
            rate1.rate = 0.75;
            let rate2 = factory.newConcept(namespace, 'UsdExchangeRate');
            rate2.to = 'STERLING';
            rate2.rate = 1.75;
            txn.usdRates = [rate1, rate2];
            txn.batchId = 'batch1';

            // Use the identity for Bank3 (not involved with anything defined above)
            await useIdentity(bank3);
            await businessNetworkConnection.submitTransaction(txn);
        });

        // MarkPreProcessComplete - only named parties
        it('should permit a Participant identified within the `parties` array to invoke a `MarkPreProcessComplete` transaction for a passed batch reference', async () => {
            // Get the factory for the business network.
            await businessNetworkConnection.connect('admin');
            factory = businessNetworkConnection.getBusinessNetwork().getFactory();
            const transaction = factory.newTransaction(namespace, 'MarkPreProcessComplete');
            transaction.batchId = '0';

            // Use the identity for Bank0.
            await useIdentity(bank0);
            await businessNetworkConnection.submitTransaction(transaction);
        });

        it('should prevent a Participant not identified within the `parties` array from invoking a `MarkPreProcessComplete` transaction for a passed batch reference', async () => {
            // Get the factory for the business network.
            await businessNetworkConnection.connect('admin');
            factory = businessNetworkConnection.getBusinessNetwork().getFactory();
            const transaction = factory.newTransaction(namespace, 'MarkPreProcessComplete');
            transaction.batchId = '0';
            //transaction.batch = factory.newRelationship(namespace, 'BatchTransferRequest', '0');

            // Use the identity for Bank3.
            await useIdentity(bank3);
            await businessNetworkConnection.submitTransaction(transaction).should.be.rejectedWith(/Object with ID .* does not exist/);
        });

        // CompleteSettlement
        it('should permit a Participant identified within the `parties` array to invoke a `CompleteSettlement` transaction for a passed batch reference', async () => {
            // Get the factory for the business network.
            await businessNetworkConnection.connect('admin');
            factory = businessNetworkConnection.getBusinessNetwork().getFactory();
            const transaction = factory.newTransaction(namespace, 'CompleteSettlement');
            //transaction.batch = factory.newRelationship(namespace, 'BatchTransferRequest', '2');
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
        });

        it('should prevent a Participant not identified within the `parties` array from invoking a `CompleteSettlement` transaction for a passed batch reference', async () => {
            // Use the identity for Bank0.
            await useIdentity(bank0);
        });

        // MarkPostProcessComplete
        it('should permit a Participant identified within the `parties` array to invoke a `MarkPostProcessComplete` transaction for a passed batch reference', async () => {
            // Get the factory for the business network.
            await businessNetworkConnection.connect('admin');
            factory = businessNetworkConnection.getBusinessNetwork().getFactory();
            const transaction = factory.newTransaction(namespace, 'MarkPostProcessComplete');
            //transaction.batch = factory.newRelationship(namespace, 'BatchTransferRequest', '0');
            transaction.batchId = '0';

            // Use the identity for Bank0.
            await useIdentity(bank0);
            await businessNetworkConnection.submitTransaction(transaction);
        });

        it('should prevent a Participant not identified within the `parties` array from invoking a `MarkPostProcessComplete` transaction for a passed batch reference', async () => {
            // Use the identity for Bank0.
            await useIdentity(bank0);
        });
    });
});
