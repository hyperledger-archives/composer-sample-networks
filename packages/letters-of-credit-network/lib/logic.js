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

/* global getFactory getAssetRegistry getParticipantRegistry emit */

/**
 * Create the LOC asset
 * @param {org.example.loc.InitialApplication} initalAppliation - the InitialApplication transaction
 * @transaction
 */
async function initialApplication(application) { // eslint-disable-line no-unused-vars
    const factory = getFactory();
    const namespace = 'org.example.loc';

    const letter = factory.newResource(namespace, 'LetterOfCredit', application.letterId);
    letter.applicant = factory.newRelationship(namespace, 'Customer', application.applicant.getIdentifier());
    letter.beneficiary = factory.newRelationship(namespace, 'Customer', application.beneficiary.getIdentifier());
    letter.issuingBank = factory.newRelationship(namespace, 'Bank', application.applicant.bank.getIdentifier());
    letter.exportingBank = factory.newRelationship(namespace, 'Bank', application.beneficiary.bank.getIdentifier());
    letter.rules = application.rules;
    letter.productDetails = application.productDetails;
    letter.evidence = [];
    letter.approval = [factory.newRelationship(namespace, 'Customer', application.applicant.getIdentifier())];
    letter.status = 'AWAITING_APPROVAL';

    //save the application
    const assetRegistry = await getAssetRegistry(letter.getFullyQualifiedType());
    await assetRegistry.add(letter);

    // emit event
    const applicationEvent = factory.newEvent(namespace, 'InitialApplicationEvent');
    applicationEvent.loc = letter;
    emit(applicationEvent);
}

/**
 * Update the LOC to show that it has been approved by a given person
 * @param {org.example.loc.Approve} approve - the Approve transaction
 * @transaction
 */
async function approve(approveRequest) { // eslint-disable-line no-unused-vars
    const factory = getFactory();
    const namespace = 'org.example.loc';

    let letter = approveRequest.loc;

    if (letter.status === 'CLOSED' || letter.status === 'REJECTED') {
        throw new Error ('This letter of credit has already been closed');
    } else if (letter.approval.length === 4) {
        throw new Error ('All four parties have already approved this letter of credit');
    } else if (letter.approval.includes(approveRequest.approvingParty)) {
        throw new Error ('This person has already approved this letter of credit');
    } else if (approveRequest.approvingParty.getType() === 'BankEmployee') {
        letter.approval.forEach((approvingParty) => {
            let bankApproved = false;
            try {
                bankApproved = approvingParty.getType() === 'BankEmployee' && approvingParty.bank.getIdentifier() === approveRequest.approvingParty.bank.getIdentifier();
            } catch (err) {
                // ignore error as they don't have rights to access that participant
            }
            if (bankApproved) {
                throw new Error('Your bank has already approved of this request');
            }
        });
    }

    letter.approval.push(factory.newRelationship(namespace, approveRequest.approvingParty.getType(), approveRequest.approvingParty.getIdentifier()));
    // update the status of the letter if everyone has approved
    if (letter.approval.length === 4) {
        letter.status = 'APPROVED';
    }

    // update approval[]
    const assetRegistry = await getAssetRegistry(approveRequest.loc.getFullyQualifiedType());
    await assetRegistry.update(letter);

    // emit event
    const approveEvent = factory.newEvent(namespace, 'ApproveEvent');
    approveEvent.loc = approveRequest.loc;
    approveEvent.approvingParty = approveRequest.approvingParty;
    emit(approveEvent);
}

/**
 * Reject the LOC
 * @param {org.example.loc.Reject} reject - the Reject transaction
 * @transaction
 */
async function reject(rejectRequest) { // eslint-disable-line no-unused-vars
    const factory = getFactory();
    const namespace = 'org.example.loc';

    let letter = rejectRequest.loc;

    if (letter.status === 'CLOSED' || letter.status === 'REJECTED') {
        throw new Error('This letter of credit has already been closed');
    } else if (letter.status === 'APPROVED') {
        throw new Error('This letter of credit has already been approved');
    } else {
        letter.status = 'REJECTED';
        letter.closeReason = rejectRequest.closeReason;

        // update the status of the LOC
        const assetRegistry = await getAssetRegistry(rejectRequest.loc.getFullyQualifiedType());
        await assetRegistry.update(letter);

        // emit event
        const rejectEvent = factory.newEvent(namespace, 'RejectEvent');
        rejectEvent.loc = rejectRequest.loc;
        rejectEvent.closeReason = rejectRequest.closeReason;
        emit(rejectEvent);
    }
}

/**
 * Suggest changes to the current rules in the LOC
 * @param {org.example.loc.SuggestChanges} suggestChanges - the SuggestChanges transaction
 * @transaction
 */
async function suggestChanges(changeRequest) { // eslint-disable-line no-unused-vars
    const factory = getFactory();
    const namespace = 'org.example.loc';

    let letter = changeRequest.loc;

    if (letter.status === 'CLOSED' || letter.status === 'REJECTED') {
        throw new Error ('This letter of credit has already been closed');
    } else if (letter.status === 'APPROVED') {
        throw new Error('This letter of credit has already been approved');
    } else if (letter.status === 'SHIPPED' || letter.status === 'RECEIVED' || letter.status === 'READY_FOR_PAYMENT') {
        throw new Error ('The product has already been shipped');
    } else {
        letter.rules = changeRequest.rules;
        // the rules have been changed - clear the approval array and update status
        letter.approval = [changeRequest.suggestingParty];
        letter.status = 'AWAITING_APPROVAL';

        // update the loc with the new rules
        const assetRegistry = await getAssetRegistry(changeRequest.loc.getFullyQualifiedType());
        await assetRegistry.update(letter);

        // emit event
        const changeEvent = factory.newEvent(namespace, 'SuggestChangesEvent');
        changeEvent.loc = changeRequest.loc;
        changeEvent.rules = changeRequest.rules;
        changeEvent.suggestingParty = changeRequest.suggestingParty;
        emit(changeEvent);
    }
}

/**
 * "Ship" the product
 * @param {org.example.loc.ShipProduct} shipProduct - the ShipProduct transaction
 * @transaction
 */
async function shipProduct(shipRequest) { // eslint-disable-line no-unused-vars
    const factory = getFactory();
    const namespace = 'org.example.loc';

    let letter = shipRequest.loc;

    if (letter.status === 'APPROVED') {
        letter.status = 'SHIPPED';
        letter.evidence.push(shipRequest.evidence);

        //update the status of the loc
        const assetRegistry = await getAssetRegistry(shipRequest.loc.getFullyQualifiedType());
        await assetRegistry.update(letter);

        // emit event
        const shipEvent = factory.newEvent(namespace, 'ShipProductEvent');
        shipEvent.loc = shipRequest.loc;
        emit(shipEvent);
    } else if (letter.status === 'AWAITING_APPROVAL') {
        throw new Error ('This letter needs to be fully approved before the product can be shipped');
    } else if (letter.status === 'CLOSED' || letter.status === 'REJECTED') {
        throw new Error ('This letter of credit has already been closed');
    } else {
        throw new Error ('The product has already been shipped');
    }
}

/**
 * "Recieve" the product that has been "shipped"
 * @param {org.example.loc.ReceiveProduct} receiveProduct - the ReceiveProduct transaction
 * @transaction
 */
async function receiveProduct(receiveRequest) { // eslint-disable-line no-unused-vars
    const factory = getFactory();
    const namespace = 'org.example.loc';

    let letter = receiveRequest.loc;

    if (letter.status === 'SHIPPED') {
        letter.status = 'RECEIVED';

        // update the status of the loc
        const assetRegistry = await getAssetRegistry(receiveRequest.loc.getFullyQualifiedType());
        await assetRegistry.update(letter);

        // emit event
        const receiveEvent = factory.newEvent(namespace, 'ReceiveProductEvent');
        receiveEvent.loc = receiveRequest.loc;
        emit(receiveEvent);
    } else if (letter.status === 'AWAITING_APPROVAL' || letter.status === 'APPROVED'){
        throw new Error('The product needs to be shipped before it can be received');
    } else if (letter.status === 'CLOSED' || letter.status === 'REJECTED') {
        throw new Error ('This letter of credit has already been closed');
    } else {
        throw new Error('The product has already been received');
    }
}


/**
 * Mark a given letter as "ready for payment"
 * @param {org.example.loc.ReadyForPayment} readyForPayment - the ReadyForPayment transaction
 * @transaction
 */
async function readyForPayment(paymentRequest) { // eslint-disable-line no-unused-vars
    const factory = getFactory();
    const namespace = 'org.example.loc';

    let letter = paymentRequest.loc;

    if (letter.status === 'RECEIVED') {
        letter.status = 'READY_FOR_PAYMENT';

        // update the status of the loc
        const assetRegistry = await getAssetRegistry(paymentRequest.loc.getFullyQualifiedType());
        await assetRegistry.update(letter);

        // emit event
        const paymentEvent = factory.newEvent(namespace, 'ReadyForPaymentEvent');
        paymentEvent.loc = paymentRequest.loc;
        emit(paymentEvent);
    } else if (letter.status === 'CLOSED' || letter.status === 'REJECTED') {
        throw new Error('This letter of credit has already been closed');
    } else if (letter.status === 'READY_FOR_PAYMENT') {
        throw new Error('The payment has already been made');
    } else {
        throw new Error('The payment cannot be made until the product has been received by the applicant');
    }
}

/**
 * Close the LOC
 * @param {org.example.loc.Close} close - the Close transaction
 * @transaction
 */
async function close(closeRequest) { // eslint-disable-line no-unused-vars
    const factory = getFactory();
    const namespace = 'org.example.loc';

    let letter = closeRequest.loc;

    if (letter.status === 'READY_FOR_PAYMENT') {
        letter.status = 'CLOSED';
        letter.closeReason = closeRequest.closeReason;

        // update the status of the loc
        const assetRegistry = await getAssetRegistry(closeRequest.loc.getFullyQualifiedType());
        await assetRegistry.update(letter);

        // emit event
        const closeEvent = factory.newEvent(namespace, 'CloseEvent');
        closeEvent.loc = closeRequest.loc;
        closeEvent.closeReason = closeRequest.closeReason;
        emit(closeEvent);
    } else if (letter.status === 'CLOSED' || letter.status === 'REJECTED') {
        throw new Error('This letter of credit has already been closed');
    } else {
        throw new Error('Cannot close this letter of credit until it is fully approved and the product has been received by the applicant');
    }
}

/**
 * Create the participants needed for the demo
 * @param {org.example.loc.CreateDemoParticipants} createDemoParticipants - the CreateDemoParticipants transaction
 * @transaction
 */
async function createDemoParticipants() { // eslint-disable-line no-unused-vars
    const factory = getFactory();
    const namespace = 'org.example.loc';

    // create the banks
    const bankRegistry = await getParticipantRegistry(namespace + '.Bank');
    const bank1 = factory.newResource(namespace, 'Bank', 'BoD');
    bank1.name = 'Bank of Dinero';
    await bankRegistry.add(bank1);
    const bank2 = factory.newResource(namespace, 'Bank', 'EB');
    bank2.name = 'Eastwood Banking';
    await bankRegistry.add(bank2);

    // create bank employees
    const employeeRegistry = await getParticipantRegistry(namespace + '.BankEmployee');
    const employee1 = factory.newResource(namespace, 'BankEmployee', 'matias');
    employee1.name = 'Matías';
    employee1.bank = factory.newRelationship(namespace, 'Bank', 'BoD');
    await employeeRegistry.add(employee1);
    const employee2 = factory.newResource(namespace, 'BankEmployee', 'ella');
    employee2.name = 'Ella';
    employee2.bank = factory.newRelationship(namespace, 'Bank', 'EB');
    await employeeRegistry.add(employee2);

    // create customers
    const customerRegistry = await getParticipantRegistry(namespace + '.Customer');
    const customer1 = factory.newResource(namespace, 'Customer', 'alice');
    customer1.name = 'Alice';
    customer1.lastName= 'Hamilton';
    customer1.bank = factory.newRelationship(namespace, 'Bank', 'BoD');
    customer1.companyName = 'QuickFix IT';
    await customerRegistry.add(customer1);
    const customer2 = factory.newResource(namespace, 'Customer', 'bob');
    customer2.name = 'Bob';
    customer2.lastName= 'Appleton';
    customer2.bank = factory.newRelationship(namespace, 'Bank', 'EB');
    customer2.companyName = 'Conga Computers';
    await customerRegistry.add(customer2);
}