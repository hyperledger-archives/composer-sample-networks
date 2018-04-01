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
 * Contracting an insurance
 * @param {org.acme.landregistry.ContractingInsurance} insurance
 * @transaction
 */
function contractingInsurance( insurance ){
    return getAssetRegistry('org.acme.landregistry.Insurance')
      .then(function(assetRegistry){
          var factory = getFactory();
          var insuranceId = insurance.insured.id + '' + insurance.insuranceCompany.id + '' + insurance.realEstate.id;
          var insuranceAsset = factory.newResource('org.acme.landregistry', 'Insurance', insuranceId);
          insuranceAsset.insured = insurance.insured;
          insuranceAsset.insuranceCompany = insurance.insuranceCompany;
          insuranceAsset.realEstate = insurance.realEstate;
          insuranceAsset.durationInMonths = insurance.durationInMonths;
          insuranceAsset.monthlyCost = insurance.monthlyCost;
          return assetRegistry.add(insuranceAsset);
      });
}


/**
 * Contracting a loan
 * @param {org.acme.landregistry.ContractingLoan} loan
 * @transaction
 */
function contractingLoan( loan ){
    if( loan.bank.balance < loan.realEstate.price ){
        throw new Error('The bank can\'t afford this investment!');
    }
    return getAssetRegistry('org.acme.landregistry.Loan')
      .then(function(assetRegistry){
          var factory = getFactory();
          var loanId = loan.debtor.id + '' + loan.realEstate.id + '' + loan.bank.id;
          var loanAsset = factory.newResource('org.acme.landregistry', 'Loan', loanId);
          loanAsset.debtor = loan.debtor;
          loanAsset.bank = loan.bank;
          loanAsset.interestRate = loan.interestRate;
          loanAsset.durationInMonths = loan.durationInMonths;
          loanAsset.realEstate = loan.realEstate;
          loanAsset.amount = loan.realEstate.price;
          return assetRegistry.add(loanAsset);
      });
}

/**
 * Buying Real Estate
 * @param {org.acme.landregistry.BuyingRealEstate} trade
 * @transaction
 */
function buyingRealEstate( trade ){
    var notaryFees = 0.1 * trade.realEstate.price;
    var realEstateAgentFees = trade.realEstateAgent.feeRate * trade.realEstate.price;
    var insuranceCostFirstMonth = trade.insurance.monthlyCost;
    var totalCost = notaryFees + realEstateAgentFees + insuranceCostFirstMonth;
  // Updates the seller's balance
    trade.seller.balance += trade.realEstate.price;

  // Check if the buyer has enough to pay the notary, real estate agent and insurance
    if( trade.buyer.balance < totalCost ){
        throw new Error('Not enough funds to buy this!');
    }
    trade.buyer.balance -= totalCost;
    trade.realEstate.owner = trade.buyer;
    trade.realEstateAgent.balance += realEstateAgentFees;
    trade.notary.balance += notaryFees;
    if( trade.isNewOwnerMainResidence ){
        trade.buyer.address = trade.realEstate.address;
    }

    return getAssetRegistry('org.acme.landregistry.RealEstate')
  .then(function (assetRegistry) {
      return assetRegistry.update(trade.realEstate);
  })
  .then(function(){
      return getParticipantRegistry('org.acme.landregistry.PrivateIndividual');
  })
  .then(function(participantRegistry){
      return participantRegistry.updateAll([trade.seller, trade.buyer]);
  })
  .then(function(){
      return getParticipantRegistry('org.acme.landregistry.Notary');
  })
  .then(function(participantRegistry){
      return participantRegistry.update(trade.notary);
  })
  .then(function(){
      return getParticipantRegistry('org.acme.landregistry.RealEstateAgent');
  })
  .then(function(participantRegistry){
      return participantRegistry.update(trade.realEstateAgent);
  })
  .then(function(){
      return getParticipantRegistry('org.acme.landregistry.Bank');
  })
  .then(function(participantRegistry){
      this.bankRegistry = participantRegistry;
      return this.bankRegistry.get(trade.loan.bank.id);
  })
  .then(function(bank){
      bank.balance -= trade.realEstate.price;
      return this.bankRegistry.update(bank);
  });
}