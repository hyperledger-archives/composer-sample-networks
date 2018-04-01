#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#

Feature: LandRegistry

    Background:
        Given I have deployed the business network definition ..
        And I have added the following participants of type org.acme.landregistry.PrivateIndividual
            | id     | name    | address  | balance |
            | sarah  | Sarah   | USA      | 10000   |
            | damien | Damien  | France   | 30000   |
				And I have added the following participants of type org.acme.landregistry.Bank
						| id       | name            | balance   |
						| BANK_ONE | HSBC            | 150000    |
						| BANK_TWO | BANK_OF_AMERICA | 200000    |
				And I have added the following participants of type org.acme.landregistry.InsuranceCompany
						| id                 | name   | balance  |
						| INSURANCE_COMP_ONE | AXA    | 20000    |
						| INSURANCE_COMP_TWO | AIG    | 50000    |
				And I have added the following participants of type org.acme.landregistry.Notary
						| id         | name   | balance   | address       |
						| NOTARY_ONE | Ben    | 10000     | In France     |
				And I have added the following participants of type org.acme.landregistry.RealEstateAgent
						| id        | name     | balance   | feeRate |
						| AGENT_ONE | John     | 2000      | 0.07    |
						| AGENT_TWO | Sophie   | 5000      | 0.065    |
        And I have added the following assets of type org.acme.landregistry.RealEstate
            | id              | owner  | address                | price  | squareMeters |
            | BUILDING_ONE    | sarah  | 123 Evergreen Terrasse | 100000 | 100          |
						| BUILDING_TWO    | damien | Somewhere in France    | 85000  | 75           |
						| BUILDING_THREE  | sarah  | France                 | 65000  | 45           |
				And I have added the following assets of type org.acme.landregistry.Loan
						 | id           | amount  | interestRate | debtor  | bank     | realEstate   | durationInMonths |
						 | LOAN_ONE     | 100000  | 0.025        | sarah   | BANK_ONE | BUILDING_ONE   | 300              |
						 | LOAN_TWO     | 85000   | 0.018        | damien  | BANK_TWO | BUILDING_TWO   | 200              |
						 | LOAN_THREE   | 65000   | 0.020        | damien  | BANK_TWO | BUILDING_THREE | 300              |
				And I have added the following assets of type org.acme.landregistry.Insurance
						| id              | realEstate     | insured  | insuranceCompany   | monthlyCost  | durationInMonths  |
						| INSURANCE_ONE   | BUILDING_ONE   | sarah    | INSURANCE_COMP_ONE | 100          | 12                |
						| INSURANCE_TWO   | BUILDING_TWO   | damien   | INSURANCE_COMP_TWO | 90           | 12               |
						| INSURANCE_THREE | BUILDING_THREE | damien   | INSURANCE_COMP_TWO | 120          | 12               |
        And I have issued the participant org.acme.landregistry.PrivateIndividual#sarah with the identity sarah1
        And I have issued the participant org.acme.landregistry.PrivateIndividual#damien with the identity damien1
				And I have issued the participant org.acme.landregistry.Bank#BANK_ONE with the identity bank1
				And I have issued the participant org.acme.landregistry.Bank#BANK_TWO with the identity bank2
				And I have issued the participant org.acme.landregistry.InsuranceCompany#INSURANCE_COMP_ONE with the identity insurance1
				And I have issued the participant org.acme.landregistry.InsuranceCompany#INSURANCE_COMP_TWO with the identity insurance2
				And I have issued the participant org.acme.landregistry.Notary#NOTARY_ONE with the identity notary1
				And I have issued the participant org.acme.landregistry.RealEstateAgent#AGENT_ONE with the identity agent1
				And I have issued the participant org.acme.landregistry.RealEstateAgent#AGENT_TWO with the identity agent2

    Scenario: Sarah can read all of the assets
        When I use the identity sarah1
        Then I should have the following assets of type org.acme.landregistry.RealEstate
            | id              | owner  | address                | price  | squareMeters |
            | BUILDING_ONE    | sarah  | 123 Evergreen Terrasse | 100000 | 100          |
						| BUILDING_TWO    | damien | Somewhere in France    | 85000  | 75           | 
						| BUILDING_THREE  | sarah  | France                 | 65000  | 45           |
		Scenario: Damien can read all of the assets
        When I use the identity damien1
        Then I should have the following assets of type org.acme.landregistry.RealEstate
            | id              | owner  | address                | price  | squareMeters |
            | BUILDING_ONE    | sarah  | 123 Evergreen Terrasse | 100000 | 100          |
						| BUILDING_TWO    | damien | Somewhere in France    | 85000  | 75           | 
						| BUILDING_THREE  | sarah  | France                 | 65000  | 45           |

		Scenario: Sarah can read only her loans
			When I use the identity sarah1
			Then I should not have the following assets of type org.acme.landregistry.Loan
						| id           | amount  | interestRate | debtor  | bank     | realEstate   | durationInMonths |
						| LOAN_TWO     | 85000   | 0.018        | damien  | BANK_TWO | BUILDING_TWO   | 200              |
						| LOAN_THREE   | 65000   | 0.020        | damien  | BANK_TWO | BUILDING_THREE | 300              |

		Scenario: Damien can read only his loans
			When I use the identity damien1
			Then I should not have the following assets of type org.acme.landregistry.Loan
						| id         | amount  | interestRate | debtor  | bank     | realEstate   | durationInMonths |
						| LOAN_ONE   | 100000  | 0.025        | sarah   | BANK_ONE | BUILDING_ONE | 300              |
						
		Scenario: Damien can read only his insurances
			When I use the identity damien1
			Then I should not have the following assets of type org.acme.landregistry.Insurance
				| id            | realEstate   | insured  | insuranceCompany   | monthlyCost | durationInMonths |
				| INSURANCE_ONE | BUILDING_ONE | sarah    | INSURANCE_COMP_ONE | 100         | 12               |

		Scenario: Sarah can read only her insurances
			When I use the identity sarah1
			Then I should not have the following assets of type org.acme.landregistry.Insurance
				| id              | realEstate     | insured  | insuranceCompany   | monthlyCost  | durationInMonths |
				| INSURANCE_TWO   | BUILDING_TWO   | damien   | INSURANCE_COMP_TWO | 90           | 12               |
				| INSURANCE_THREE | BUILDING_THREE | damien   | INSURANCE_COMP_TWO | 120          | 12               |

		Scenario: Damien can't update Sarah's RealEstate assets
			When I use the identity damien1
			And I update the following asset of type org.acme.landregistry.RealEstate
				| id            | owner  | address                | price  | squareMeters |
        | BUILDING_ONE  | sarah  | 123 Evergreen Terrasse | 150000 | 100          |
			Then I should get an error matching /does not have .*access to resource/

		Scenario: Sarah can't update Damien's RealEstate assets
			When I use the identity sarah1
			And I update the following asset of type org.acme.landregistry.RealEstate
				| id            | owner  | address                | price  | squareMeters |
        | BUILDING_TWO  | damien | USA                    | 50000  | 75           | 
			Then I should get an error matching /does not have .*access to resource/

		Scenario: Damien can't remove Sarah's RealEstate assets
			When I use the identity damien1
			And I remove the following asset of type org.acme.landregistry.RealEstate
				| id           |
				| BUILDING_ONE |
			Then I should get an error matching /does not have .* access to resource/

		Scenario: Sarah can't remove Damien's RealEstate assets
			When I use the identity sarah1
			And I remove the following asset of type org.acme.landregistry.RealEstate
				| id           |
				| BUILDING_TWO |
			Then I should get an error matching /does not have .* access to resource/

		Scenario: Damien can remove his RealEstate's assets
			When I use the identity damien1
			And I remove the following asset of type org.acme.landregistry.RealEstate
				| id           |
				| BUILDING_TWO |
			Then I should not have the following assets of type org.acme.landregistry.RealEstate
				| id           |
				| BUILDING_TWO |

		Scenario: Sarah can remove her RealEstate's assets
			When I use the identity sarah1
			And I remove the following asset of type org.acme.landregistry.RealEstate
				| id           |
				| BUILDING_ONE |
			Then I should not have the following assets of type org.acme.landregistry.RealEstate
				| id           |
				| BUILDING_ONE |

		Scenario: Sarah can't submit a Loan
			When I use the identity sarah1
			And I submit the following transaction of type org.acme.landregistry.ContractingLoan
				| debtor | bank     | realEstate   | interestRate | durationInMonths |
				| sarah  | BANK_ONE | BUILDING_TWO | 0.034        | 300              |
			Then I should get an error matching /does not have .* access to resource/		

		Scenario: Damien can't submit an Insurance
			When I use the identity damien1
			And I submit the following transaction of type org.acme.landregistry.ContractingInsurance
				| insured | insuranceCompany   | realEstate   | monthlyCost | durationInMonths |
				| damien  | INSURANCE_COMP_ONE | BUILDING_TWO | 150         | 12               |
			Then I should get an error matching /does not have .* access to resource/		
		
		Scenario: BANK_ONE can't see BANK_TWO's loans
			When I use the identity bank1
			Then I should not have the following assets of type org.acme.landregistry.Loan
				| id           | amount  | interestRate | debtor  | bank     | realEstate   | durationInMonths |
				| LOAN_TWO     | 85000   | 0.018        | damien  | BANK_TWO | BUILDING_TWO | 200              |
				| LOAN_THREE   | 65000   | 0.020        | damien  | BANK_TWO | BUILDING_THREE | 300              |
		
		Scenario: BANK_TWO can't see BANK_ONE's loans
			When I use the identity bank2
			Then I should not have the following assets of type org.acme.landregistry.Loan
				| id         | amount  | interestRate | debtor  | bank     | realEstate   | durationInMonths |
				| LOAN_ONE   | 100000  | 0.025        | sarah   | BANK_ONE | BUILDING_ONE | 300              |

		Scenario: BANK_ONE can't update BANK_TWO's loans
			When I use the identity bank1
			And I update the following assets of type org.acme.landregistry.Loan
				| id         | amount  | interestRate | debtor  | bank     | realEstate   | durationInMonths |
				| LOAN_TWO   | 85000   | 0.020        | damien  | BANK_TWO | BUILDING_TWO | 250              |
			Then I should get an error matching /does not have .* access to resource/			

		Scenario: BANK_TWO can't update BANK_ONE's loans
			When I use the identity bank2
			And I update the following assets of type org.acme.landregistry.Loan
				| id         | amount  | interestRate | debtor  | bank     | realEstate   | durationInMonths |
				| LOAN_ONE   | 100000  | 0.030        | sarah   | BANK_ONE | BUILDING_ONE | 280              |
			Then I should get an error matching /does not have .* access to resource/			

		Scenario: BANK_TWO can't remove BANK_ONE's loans
			When I use the identity bank2
			And I remove the following assets of type org.acme.landregistry.Loan
				| id         | 
				| LOAN_ONE   |
			Then I should get an error matching /does not have .* access to resource/			

		Scenario: BANK_ONE can't remove BANK_TWO's loans
			When I use the identity bank1
			And I remove the following assets of type org.acme.landregistry.Loan
				| id         | 
				| LOAN_TWO   |
			Then I should get an error matching /does not have .* access to resource/			
		
		Scenario: Banks can't see Insurance assets
			When I use the identity bank1
			Then I should not have the following assets of type org.acme.landregistry.Insurance
			 	| id              | realEstate     | insured  | insuranceCompany   | monthlyCost  | durationInMonths |
				| INSURANCE_ONE   | BUILDING_ONE   | sarah    | INSURANCE_COMP_ONE | 100          | 12               |
				| INSURANCE_TWO   | BUILDING_TWO   | damien   | INSURANCE_COMP_TWO | 90           | 12               |
				| INSURANCE_THREE | BUILDING_THREE | damien   | INSURANCE_COMP_TWO | 120          | 12               |

		Scenario: Banks can't update Insurance assets
			When I use the identity bank1
			And I update the following assets of type org.acme.landregistry.Insurance
			 	| id            | realEstate   | insured  | insuranceCompany   | monthlyCost | durationInMonths  |
				| INSURANCE_TWO | BUILDING_TWO | damien   | INSURANCE_COMP_TWO | 120          | 12               |
			Then I should get an error matching /does not have .* access to resource/		

		Scenario: Banks can't remove Insurance assets
			When I use the identity bank1
			And I remove the following assets of type org.acme.landregistry.Insurance
			 	| id            | 
				| INSURANCE_ONE |
			Then I should get an error matching /does not have .* access to resource/		
		
		Scenario: INSURANCE_COMP_ONE can't see INSURANCE_COMP_TWO's insurances
			When I use the identity insurance1
			Then I should not have the following assets of type org.acme.landregistry.Insurance
				| id              | realEstate     | insured  | insuranceCompany   | monthlyCost  | durationInMonths  |
				| INSURANCE_TWO   | BUILDING_TWO   | damien   | INSURANCE_COMP_TWO | 120          | 12               |
				| INSURANCE_THREE | BUILDING_THREE | damien   | INSURANCE_COMP_TWO | 120          | 12               |

		Scenario: INSURANCE_COMP_TWO can't see INSURANCE_COMP_ONE's insurances
			When I use the identity insurance2
			Then I should not have the following assets of type org.acme.landregistry.Insurance
				| id            | realEstate   | insured  | insuranceCompany   | monthlyCost | durationInMonths  |
				| INSURANCE_ONE | BUILDING_ONE | sarah    | INSURANCE_COMP_ONE | 100         | 12                |

		Scenario: INSURANCE_COMP_ONE can't update INSURANCE_COMP_TWO's insurances
			When I use the identity insurance1
			And I update the following assets of type org.acme.landregistry.Insurance
				| id            | realEstate   | insured  | insuranceCompany   | monthlyCost | durationInMonths  |
				| INSURANCE_TWO | BUILDING_TWO | damien   | INSURANCE_COMP_TWO | 150          | 24               |
			Then I should get an error matching /does not have .* access to resource/		

		Scenario: INSURANCE_COMP_TWO can't update INSURANCE_COMP_ONE's insurances
			When I use the identity insurance2
			And I update the following assets of type org.acme.landregistry.Insurance
				| id            | realEstate   | insured  | insuranceCompany   | monthlyCost | durationInMonths  |
				| INSURANCE_ONE | BUILDING_ONE | sarah    | INSURANCE_COMP_ONE | 150         | 15                |
			Then I should get an error matching /does not have .* access to resource/		
		
		Scenario: INSURANCE_COMP_ONE can't remove INSURANCE_COMP_TWO's insurances
			When I use the identity insurance1
			And I remove the following assets of type org.acme.landregistry.Insurance
				| id            | 
				| INSURANCE_TWO | 
			Then I should get an error matching /does not have .* access to resource/		

		Scenario: INSURANCE_COMP_TWO can't remove INSURANCE_COMP_ONE's insurances
			When I use the identity insurance2
			And I remove the following assets of type org.acme.landregistry.Insurance
				| id            |
				| INSURANCE_ONE |
			Then I should get an error matching /does not have .* access to resource/		

		Scenario: Insurance Companies can't see Loan assets
			When I use the identity insurance1
			Then I should not have the following assets of type org.acme.landregistry.Loan
			 | id         | amount  | interestRate | debtor  | bank     | realEstate   | durationInMonths |
			 | LOAN_ONE   | 100000  | 0.025        | sarah   | BANK_ONE | BUILDING_ONE | 300              |
			 | LOAN_TWO   | 85000   | 0.018        | damien  | BANK_TWO | BUILDING_TWO | 200              |

		Scenario: Insurance Companies can't update Loan assets
			When I use the identity insurance1
			And I update the following assets of type org.acme.landregistry.Loan
			 | id         | amount  | interestRate | debtor  | bank     | realEstate   | durationInMonths |
			 | LOAN_ONE   | 120000  | 0.035        | sarah   | BANK_ONE | BUILDING_ONE | 200              |
			Then I should get an error matching /does not have .* access to resource/		

		Scenario: Insurance Companies can't remove Loan assets
			When I use the identity insurance2
			And I remove the following assets of type org.acme.landregistry.Loan
			 | id         |
			 | LOAN_TWO   |
			Then I should get an error matching /does not have .* access to resource/		

		Scenario: Damien can add RealEstate assets that he owns
			When I use the identity damien1
			And I add the following asset of type org.acme.landregistry.RealEstate
			 | id            | address | squareMeters | price  | owner |
			 | BUILDING_FOUR | UK      | 150          | 120000 | damien |
			Then I should have the following asset of type org.acme.landregistry.RealEstate
				| id            | address | squareMeters | price  | owner |
			  | BUILDING_FOUR | UK      | 150          | 120000 | damien |

		Scenario: Damien cannot add RealEstate assets that Sarah owns
			When I use the identity damien1
			And I add the following asset of type org.acme.landregistry.RealEstate
			 | id            | address | squareMeters | price  | owner |
			 | BUILDING_FOUR | UK      | 150          | 120000 | sarah |
			Then I should get an error matching /does not have .* access to resource/		

		Scenario: Sarah can add RealEstate assets that he owns
			When I use the identity sarah1
			And I add the following asset of type org.acme.landregistry.RealEstate
			 | id            | address | squareMeters | price  | owner |
			 | BUILDING_FOUR | UK      | 150          | 120000 | sarah |
			Then I should have the following asset of type org.acme.landregistry.RealEstate
				| id            | address | squareMeters | price  | owner |
			  | BUILDING_FOUR | UK      | 150          | 120000 | sarah |

		Scenario: Sarah cannot add RealEstate assets that Damien owns
			When I use the identity sarah1
			And I add the following asset of type org.acme.landregistry.RealEstate
			 | id            | address | squareMeters | price  | owner  |
			 | BUILDING_FOUR | UK      | 150          | 120000 | damien |
			Then I should get an error matching /does not have .* access to resource/		
		
		Scenario: Damien cannot update RealEstate assets that Sarah owns
			When I use the identity damien1
			And I update the following asset of type org.acme.landregistry.RealEstate
				| id              | owner  | address                | price  | squareMeters |
        | BUILDING_ONE    | sarah  | 123 Evergreen Terrasse | 140000 | 90           |
			Then I should get an error matching /does not have .* access to resource/		

		Scenario: Damien cannot delete RealEstate assets that Sarah owns
			When I use the identity damien1
			And I remove the following asset of type org.acme.landregistry.RealEstate
				| id            |
        | BUILDING_ONE  |
			Then I should get an error matching /does not have .* access to resource/		
		
		Scenario: Sarah cannot update RealEstate assets that Damien owns
			When I use the identity sarah1
			And I update the following asset of type org.acme.landregistry.RealEstate
				| id            | owner  | address                | price  | squareMeters |
        | BUILDING_TWO  | damien | USA                    | 50000  | 75           | 
			Then I should get an error matching /does not have .* access to resource/		

		Scenario: Sarah cannot delete RealEstate assets that Damien owns
			When I use the identity sarah1
			And I remove the following asset of type org.acme.landregistry.RealEstate
				| id            |
        | BUILDING_TWO  |
			Then I should get an error matching /does not have .* access to resource/		
		
		Scenario: Real Estate Agents can't create Loans
			When I use the identity agent1
			And I submit the following transaction of type org.acme.landregistry.ContractingLoan
				| debtor | bank     | realEstate   | interestRate | durationInMonths |
				| sarah  | BANK_ONE | BUILDING_TWO | 0.034        | 300              |
			Then I should get an error matching /does not have .* access to resource/		
		
		Scenario: Real Estate Agents can't read Loans
			When I use the identity agent2
			Then I should not have the following asset of type org.acme.landregistry.Loan
				| id           | amount  | interestRate | debtor  | bank     | realEstate   | durationInMonths |
				| LOAN_ONE     | 100000  | 0.025        | sarah   | BANK_ONE | BUILDING_ONE   | 300              |
				| LOAN_TWO     | 85000   | 0.018        | damien  | BANK_TWO | BUILDING_TWO   | 200              |
				| LOAN_THREE   | 65000   | 0.020        | damien  | BANK_TWO | BUILDING_THREE | 300              |

		Scenario: Real Estate Agents can't update Loans
			When I use the identity agent2
			And I update the following asset of type org.acme.landregistry.Loan
				| id         | amount  | interestRate | debtor  | bank     | realEstate   | durationInMonths |
				| LOAN_ONE   | 900000  | 0.028        | sarah   | BANK_ONE | BUILDING_ONE | 280              |
			Then I should get an error matching /does not have .* access to resource/		

		Scenario: Real Estate Agents can't remove Loans
			When I use the identity agent1
			And I remove the following asset of type org.acme.landregistry.Loan
				| id         |
				| LOAN_ONE   |
			Then I should get an error matching /does not have .* access to resource/		

		Scenario: Real Estate Agents can't create Insurances
			When I use the identity agent2
			And I submit the following transaction of type org.acme.landregistry.ContractingInsurance
				| insured | insuranceCompany   | realEstate   | monthlyCost | durationInMonths |
				| damien  | INSURANCE_COMP_ONE | BUILDING_TWO | 150         | 12               |
			Then I should get an error matching /does not have .* access to resource/		
		
		Scenario: Real Estate Agents can't read Insurances
			When I use the identity agent1
			Then I should not have the following asset of type org.acme.landregistry.Insurance
					| id              | realEstate     | insured  | insuranceCompany   | monthlyCost  | durationInMonths  |
					| INSURANCE_ONE   | BUILDING_ONE   | sarah    | INSURANCE_COMP_ONE | 100          | 12                |
					| INSURANCE_TWO   | BUILDING_TWO   | damien   | INSURANCE_COMP_TWO | 90           | 12               |
					| INSURANCE_THREE | BUILDING_THREE | damien   | INSURANCE_COMP_TWO | 120          | 12               |

		Scenario: Real Estate Agents can't update Insurances
			When I use the identity agent1
			And I update the following asset of type org.acme.landregistry.Insurance
				| id              | realEstate     | insured  | insuranceCompany   | monthlyCost  | durationInMonths  |
				| INSURANCE_ONE   | BUILDING_ONE   | damien    | INSURANCE_COMP_ONE | 150          | 12                |
			Then I should get an error matching /does not have .* access to resource/		

		Scenario: Real Estate Agents can't remove Insurances
			When I use the identity agent2
			And I remove the following asset of type org.acme.landregistry.Insurance
				| id            |
				| INSURANCE_TWO |
			Then I should get an error matching /does not have .* access to resource/		

		Scenario: Real Estate Agents can see all Real Estate assets
			When I use the identity agent1
			Then I should have the following asset of type org.acme.landregistry.RealEstate
				| id              | owner  | address                | price  | squareMeters |
      	| BUILDING_ONE    | sarah  | 123 Evergreen Terrasse | 100000 | 100          |
				| BUILDING_TWO    | damien | Somewhere in France    | 85000  | 75           |
				| BUILDING_THREE  | sarah  | France                 | 65000  | 45           |			

		Scenario: Notary can submit BuyingRealEstate
			When I use the identity notary1
			And I submit the following transaction of type org.acme.landregistry.BuyingRealEstate
				| buyer  | seller | realEstate     | loan       | realEstateAgent | notary     | insurance       | isNewOwnerMainResidence |
				| damien | sarah  | BUILDING_THREE | LOAN_THREE | AGENT_ONE       | NOTARY_ONE | INSURANCE_THREE | true                    |
			Then I should have the following asset of type org.acme.landregistry.RealEstate
					| id              | owner  | address | price  | squareMeters |
					| BUILDING_THREE  | damien  | France | 65000  | 45           |			
			
		Scenario: Notary can't create a new Loan
			When I use the identity notary1
			And I submit the following transaction of type org.acme.landregistry.ContractingLoan
				| debtor | bank     | realEstate   | interestRate | durationInMonths |
				| sarah  | BANK_ONE | BUILDING_TWO | 0.034        | 300              |
			Then I should get an error matching /does not have .* access to resource/		

		Scenario: Notary can't create a new Insurance
			When I use the identity notary1
			And I submit the following transaction of type org.acme.landregistry.ContractingInsurance
				| insured | insuranceCompany   | realEstate   | monthlyCost | durationInMonths |
				| damien  | INSURANCE_COMP_ONE | BUILDING_TWO | 150         | 12               |
			Then I should get an error matching /does not have .* access to resource/		
		
