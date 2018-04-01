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
const IdCard = require('composer-common').IdCard;
const MemoryCardStore = require('composer-common').MemoryCardStore;

const path = require('path');

require('chai').should();

const namespace = 'org.acme.landregistry';

describe('#' + namespace, () => {
    // In-memory card store for testing so cards are not persisted to the file system
    const cardStore = new MemoryCardStore();
    let adminConnection;
    let businessNetworkConnection;

    before(() => {
        // Embedded connection used for local testing
        const connectionProfile = {
            name: 'embedded',
            type: 'embedded'
        };
        // Embedded connection does not need real credentials
        const credentials = {
            certificate: 'FAKE CERTIFICATE',
            privateKey: 'FAKE PRIVATE KEY'
        };

        // PeerAdmin identity used with the admin connection to deploy business networks
        const deployerMetadata = {
            version: 1,
            userName: 'PeerAdmin',
            roles: [ 'PeerAdmin', 'ChannelAdmin' ]
        };
        const deployerCard = new IdCard(deployerMetadata, connectionProfile);
        deployerCard.setCredentials(credentials);

        const deployerCardName = 'PeerAdmin';
        adminConnection = new AdminConnection({ cardStore: cardStore });

        return adminConnection.importCard(deployerCardName, deployerCard).then(() => {
            return adminConnection.connect(deployerCardName);
        });
    });

    beforeEach(() => {
        businessNetworkConnection = new BusinessNetworkConnection({ cardStore: cardStore });

        const adminUserName = 'admin';
        let adminCardName;
        let businessNetworkDefinition;

        return BusinessNetworkDefinition.fromDirectory(path.resolve(__dirname, '..')).then(definition => {
            businessNetworkDefinition = definition;
            // Install the Composer runtime for the new business network
            return adminConnection.install(businessNetworkDefinition.getName());
        }).then(() => {
            // Start the business network and configure an network admin identity
            const startOptions = {
                networkAdmins: [
                    {
                        userName: adminUserName,
                        enrollmentSecret: 'adminpw'
                    }
                ]
            };
            return adminConnection.start(businessNetworkDefinition, startOptions);
        }).then(adminCards => {
            // Import the network admin identity for us to use
            adminCardName = `${adminUserName}@${businessNetworkDefinition.getName()}`;
            return adminConnection.importCard(adminCardName, adminCards.get(adminUserName));
        }).then(() => {
            // Connect to the business network using the network admin identity
            return businessNetworkConnection.connect(adminCardName);
        });
    });

    describe('#BuyingRealEstate', () => {
        let insuranceId;
        let loanId;
        beforeEach(() => {
            return businessNetworkConnection.getParticipantRegistry(`${namespace}.PrivateIndividual`)
          .then(registry => {
              const factory = businessNetworkConnection.getBusinessNetwork().getFactory();
              const privateIndividualOne = factory.newResource(namespace, 'PrivateIndividual', 'damien');
              const privateIndividualTwo = factory.newResource(namespace, 'PrivateIndividual', 'sarah');
              privateIndividualOne.address = 'France';
              privateIndividualOne.name = 'Damien Cosset';
              privateIndividualOne.balance = 30000;
              privateIndividualTwo.address = 'USA';
              privateIndividualTwo.name = 'Sarah Jones';
              privateIndividualTwo.balance = 10000;
              return registry.addAll([privateIndividualOne, privateIndividualTwo]);
          })
          .then(() => {
              return businessNetworkConnection.getParticipantRegistry(`${namespace}.Bank`);
          })
          .then(registry => {
              const factory = businessNetworkConnection.getBusinessNetwork().getFactory();
              // Create a Bank
              const bank = factory.newResource(namespace, 'Bank', 'BANK_ONE');
              bank.name = 'Bank of America';
              bank.balance = 250000;
              return registry.add(bank);
          })
          .then(() => {
              return businessNetworkConnection.getAssetRegistry(`${namespace}.RealEstate`);
          })
          .then(registry => {
              const factory = businessNetworkConnection.getBusinessNetwork().getFactory();
              const realEstateAsset = factory.newResource(namespace, 'RealEstate', 'BUILDING_ONE');
              realEstateAsset.price = 100000;
              realEstateAsset.address = '123, Evergreen Terasse, Springfield';
              realEstateAsset.squareMeters = 100;
              realEstateAsset.owner = factory.newRelationship('org.acme.landregistry', 'PrivateIndividual', 'sarah');
              return registry.add(realEstateAsset);
          })
          .then(() => {
              return businessNetworkConnection.getParticipantRegistry(`${namespace}.InsuranceCompany`);
          })
        .then(registry => {
            const factory = businessNetworkConnection.getBusinessNetwork().getFactory();
            // Create a InsuranceCompany
            const insuranceCompany = factory.newResource(namespace, 'InsuranceCompany', 'INSURANCE_COMP_ONE');
            insuranceCompany.name = 'AXA';
            insuranceCompany.balance = 5000;
            return registry.add(insuranceCompany);
        })
        .then(() => {
            return businessNetworkConnection.getParticipantRegistry(`${namespace}.RealEstateAgent`);
        })
        .then(registry => {
            const factory = businessNetworkConnection.getBusinessNetwork().getFactory();
            // Create a RealEstateAgent
            const realEstateAgent = factory.newResource(namespace, 'RealEstateAgent', 'AGENT_ONE');
            realEstateAgent.name = 'Agent Smith';
            realEstateAgent.feeRate = 0.07;
            realEstateAgent.balance = 2000;
            return registry.add(realEstateAgent);
        })
        .then(() => {
            return businessNetworkConnection.getParticipantRegistry(`${namespace}.Notary`);
        })
        .then(registry => {
            const factory = businessNetworkConnection.getBusinessNetwork().getFactory();
            // create a Notary
            const notary = factory.newResource(namespace, 'Notary', 'NOTARY_ONE');
            notary.name = 'Ethan Doe';
            notary.address = '333 Notary Street, New York';
            notary.balance = 1000;
            return registry.add(notary);
        });
        });

        it('should create a new Loan Asset', () => {
            // Create transaction for ContractingInsurance
            createLoanAsset(businessNetworkConnection)
            .then(loans => {
                loans.length.should.equal(1);
                loans[0].realEstate.getIdentifier().should.equal('BUILDING_ONE');
                loans[0].debtor.getIdentifier().should.equal('damien');
                loans[0].bank.getIdentifier().should.equal('BANK_ONE');
                loanId = loans[0].getIdentifier();
            });
        });
        it('should create a new Insurance Asset', () => {
            createInsuranceAsset(businessNetworkConnection)
          .then(insurances => {
              insurances.length.should.equal(1);
              insurances[0].insured.getIdentifier().should.equal('damien');
              insurances[0].realEstate.getIdentifier().should.equal('BUILDING_ONE');
              insurances[0].insuranceCompany.getIdentifier().should.equal('INSURANCE_COMP_ONE');
              insuranceId = insurances[0].getIdentifier();
          });
        });
        it('should update the RealEstate owner', () => {
            return Promise.all([createInsuranceAsset(businessNetworkConnection), createLoanAsset(businessNetworkConnection)])
          .then(registries => {
              const loanId = registries[1][0].getIdentifier();
              const insuranceId = registries[0][0].getIdentifier();
              return buyRealEstate(businessNetworkConnection, loanId, insuranceId)
              .then(() => {
                  return businessNetworkConnection.getAssetRegistry(`${namespace}.RealEstate`);
              })
              .then(registry => {
                  return registry.get('BUILDING_ONE');
              })
              .then(realEstate => {
                  realEstate.owner.getIdentifier().should.equal('damien');
              });
          });
        });
        it('should update the Participants balances', () => {
            return Promise.all([createInsuranceAsset(businessNetworkConnection), createLoanAsset(businessNetworkConnection)])
          .then(registries => {
              const loanId = registries[1][0].getIdentifier();
              const insuranceId = registries[0][0].getIdentifier();
              return buyRealEstate(businessNetworkConnection, loanId, insuranceId)
              .then(() => {
                  return businessNetworkConnection.getParticipantRegistry(`${namespace}.PrivateIndividual`);
              })
              .then(registry => {
                  return Promise.all([registry.get('damien'), registry.get('sarah')]);
              })
              .then(results => {
                  // Damien should have 12900 in his balance. From 30000 =>
                  // - notaryFees or 0.1 * 100000 = 10000 ( 20000 left )
                  // - realEstateAgentFees or 0.07 * 100000 = 7000 ( 13000 left )
                  // - insuranceCostFirstMonth or 100 ( 12900 left )
                  const damien = results[0];
                  damien.balance.should.equal(12900);
                  // Damien's address should have been updated too
                  damien.address.should.equal('123, Evergreen Terasse, Springfield');
                  // Sarah should have 110000 in her balance. From 10000 =>
                  // + 100000 from the RealEstate asset price
                  const sarah = results[1];
                  sarah.balance.should.equal(110000);
                  return businessNetworkConnection.getParticipantRegistry(`${namespace}.Bank`);
              })
              .then(registry => {
                  return registry.get('BANK_ONE');
              })
              .then(bank => {
                  // Balance should be 150000 ( 250000 - 100000 )
                  bank.balance.should.equal(150000);
                  return businessNetworkConnection.getParticipantRegistry(`${namespace}.RealEstateAgent`);
              })
              .then(registry => {
                  return registry.get('AGENT_ONE');
              })
              .then(agent => {
                  // Agent's balance should be 9000 ( 2000 + 7000 )
                  agent.balance.should.equal(9000);
                  return businessNetworkConnection.getParticipantRegistry(`${namespace}.Notary`);
              })
              .then(registry => {
                  return registry.get('NOTARY_ONE');
              })
              .then(notary => {
                  // Notary's balance should be 11000 ( 1000 + 10000 )
                  notary.balance.should.equal(11000);
              });
          });
        });
    });
});

const buyRealEstate = (businessNetworkConnection, loanId, insuranceId) => {
    return new Promise((resolve, reject) => {
        const factory = businessNetworkConnection.getBusinessNetwork().getFactory();
        const buyingRealEstate = factory.newTransaction(namespace, 'BuyingRealEstate');
        buyingRealEstate.buyer = factory.newRelationship(namespace, 'PrivateIndividual', 'damien');
        buyingRealEstate.seller = factory.newRelationship(namespace, 'PrivateIndividual', 'sarah');
        buyingRealEstate.realEstate = factory.newRelationship(namespace, 'RealEstate', 'BUILDING_ONE');
        buyingRealEstate.loan = factory.newRelationship(namespace, 'Loan', loanId);
        buyingRealEstate.realEstateAgent = factory.newRelationship(namespace, 'RealEstateAgent', 'AGENT_ONE');
        buyingRealEstate.notary = factory.newRelationship(namespace, 'Notary', 'NOTARY_ONE');
        buyingRealEstate.isNewOwnerMainResidence = true;
        buyingRealEstate.insurance = factory.newRelationship(namespace, 'Insurance', insuranceId);
        resolve(businessNetworkConnection.submitTransaction(buyingRealEstate));
    });
};

const createInsuranceAsset = businessNetworkConnection => {
    return new Promise((resolve, reject) => {
        const factory = businessNetworkConnection.getBusinessNetwork().getFactory();
        const contractingInsurance = factory.newTransaction(namespace, 'ContractingInsurance');
        contractingInsurance.insured = factory.newRelationship(namespace, 'PrivateIndividual', 'damien');
        contractingInsurance.insuranceCompany = factory.newRelationship(namespace, 'InsuranceCompany', 'INSURANCE_COMP_ONE');
        contractingInsurance.realEstate = factory.newRelationship(namespace, 'RealEstate', 'BUILDING_ONE');
        contractingInsurance.durationInMonths = 12;
        contractingInsurance.monthlyCost = 100;
        return businessNetworkConnection.submitTransaction(contractingInsurance)
        .then(() => {
            return businessNetworkConnection.getAssetRegistry(`${namespace}.Insurance`);
        })
      .then(registry => {
          resolve(registry.getAll());
      });
    });
};

const createLoanAsset = businessNetworkConnection => {
    return new Promise((resolve, reject) => {
        const factory = businessNetworkConnection.getBusinessNetwork().getFactory();
        const contractingLoan = factory.newTransaction(namespace, 'ContractingLoan');
        contractingLoan.debtor = factory.newRelationship(namespace, 'PrivateIndividual', 'damien');
        contractingLoan.bank = factory.newRelationship(namespace, 'Bank', 'BANK_ONE');
        contractingLoan.realEstate = factory.newRelationship(namespace, 'RealEstate', 'BUILDING_ONE');
        contractingLoan.interestRate = 0.035;
        contractingLoan.durationInMonths = 300;
        return businessNetworkConnection.submitTransaction(contractingLoan)
        .then(() => {
            return businessNetworkConnection.getAssetRegistry(`${namespace}.Loan`);
        })
        .then(registry => {
            resolve(registry.getAll());
        });
    });
};