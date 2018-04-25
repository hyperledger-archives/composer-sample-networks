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

Feature: SubmitTransferRequests

    Background:
        Given I have deployed the business network definition ..
        And I have added the following participants of type org.clearing.BankingParticipant
            | bankingId | bankingName | workingCurrency | fundBalance |
            | bank1     | Bank One    | USD             | 1000000     |
            | bank2     | Bank Two    | EURO            | 1000000     |
        And I have issued the participant org.clearing.BankingParticipant#bank1 with the identity bank1
        And I have issued the participant org.clearing.BankingParticipant#bank2 with the identity bank2

    Scenario: Each bank is able to create TransferRequest assets by submitting SubmitTransferReqeust transactions
        When I use the identity bank1
        And I submit the following transaction
            """
            [
            {"$class":"org.clearing.SubmitTransferRequest",
            "transferId":"xferid1",
            "toBank":"bank2",
            "state":"PENDING",
            "details":{"$class":"org.clearing.Transfer","currency":"USD","amount":1000,"fromAccount":"111111","toAccount":"222222"}}
            ]
            """
        And I use the identity bank2
        And I submit the following transaction
            """
            [
            {"$class":"org.clearing.SubmitTransferRequest",
            "transferId":"xferid2",
            "toBank":"bank1",
            "state":"PENDING",
            "details":{"$class":"org.clearing.Transfer","currency":"EURO","amount":1000,"fromAccount":"333333","toAccount":"444444"}}
            ]
            """
        Then I should have the following assets
            """
            [
            {"$class":"org.clearing.TransferRequest",
            "requestId":"xferid1",
            "details":{"$class":"org.clearing.Transfer","currency":"USD","amount":1000,"fromAccount":"111111","toAccount":"222222"},
            "fromBankState":"PENDING",
            "toBankState":"PENDING",
            "state":"PENDING",
            "fromBank":"bank1",
            "toBank":"bank2"},

            {"$class":"org.clearing.TransferRequest",
            "requestId":"xferid2",
            "details":{"$class":"org.clearing.Transfer","currency":"EURO","amount":1000,"fromAccount":"333333","toAccount":"444444"},
            "fromBankState":"PENDING",
            "toBankState":"PENDING",
            "state":"PENDING",
            "fromBank":"bank2",
            "toBank":"bank1"}
            ]
            """
