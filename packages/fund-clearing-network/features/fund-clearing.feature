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

Feature: Clearing Transactions

    Background:
        Given I have deployed the business network definition ..
        And I have added the following participants of type org.clearing.BankingParticipant
            | bankingId | bankingName | workingCurrency | fundBalance |
            | bank1     | Bank One    | USD             | 1000000     |
            | bank2     | Bank Two    | EURO            | 1000000     |
            | bank3     | Bank Three  | STERLING        | 1000000     |
        And I have added the following assets
            """
            [
            {"$class":"org.clearing.TransferRequest","requestId":"reqid1",
            "details":{"$class":"org.clearing.Transfer","currency":"USD","amount":1000,"fromAccount":"111111","toAccount":"222222"},
            "fromBankState":"PENDING","toBankState":"PENDING","state":"PENDING","fromBank":"bank1","toBank":"bank2"},
            {"$class":"org.clearing.TransferRequest","requestId":"reqid2",
            "details":{"$class":"org.clearing.Transfer","currency":"USD","amount":1000,"fromAccount":"333333","toAccount":"444444"},
            "fromBankState":"PENDING","toBankState":"PENDING","state":"PENDING","fromBank":"bank1","toBank":"bank3"},
            {"$class":"org.clearing.TransferRequest","requestId":"reqid3",
            "details":{"$class":"org.clearing.Transfer","currency":"EURO","amount":1000,"fromAccount":"555555","toAccount":"666666"},
            "fromBankState":"PENDING","toBankState":"PENDING","state":"PENDING","fromBank":"bank2","toBank":"bank1"},
            {"$class":"org.clearing.TransferRequest","requestId":"reqid4",
            "details":{"$class":"org.clearing.Transfer","currency":"STERLING","amount":1000,"fromAccount":"777777","toAccount":"888888"},
            "fromBankState":"PENDING","toBankState":"PENDING","state":"PENDING","fromBank":"bank3","toBank":"bank2"}
            ]
            """
        And I have issued the participant org.clearing.BankingParticipant#bank1 with the identity bank1
        And I have issued the participant org.clearing.BankingParticipant#bank2 with the identity bank2

    Scenario: When I submit a batch transfer requst transaction, a BatchTransferRequest is created for each unique paring of banks.
        When I use the identity bank1
        And I submit the following transaction
            """
            [
            {"$class":"org.clearing.CreateBatch",
            "batchId":"batch1", "usdRates": [
            {"$class":"org.clearing.UsdExchangeRate","to":"EURO","rate":0.75},
            {"$class":"org.clearing.UsdExchangeRate","to":"STERLING","rate":1.75}]}
            ]
            """
        Then I should have received the following events of type org.clearing.BatchCreatedEvent
            | batchId   |
            | batch1:bank11 |
            | batch1:bank12 |
        Then I should have the following assets
            """
            [
            {"$class":"org.clearing.BatchTransferRequest","batchId":"batch1:bank11",
            "settlement":{"$class":"org.clearing.Settlement","amount":1749.9999999999998,"currency":"EURO","creditorBank":"org.clearing.BankingParticipant#bank2","debtorBank":"org.clearing.BankingParticipant#bank1"},
            "state":"PENDING_PRE_PROCESS",
            "parties":["org.clearing.BankingParticipant#bank1","org.clearing.BankingParticipant#bank2"],
            "transferRequests":["org.clearing.TransferRequest#reqid1","org.clearing.TransferRequest#reqid3"]},
            {"$class":"org.clearing.BatchTransferRequest","batchId":"batch1:bank12",
            "settlement":{"$class":"org.clearing.Settlement","amount":1750,"currency":"STERLING","creditorBank":"org.clearing.BankingParticipant#bank3","debtorBank":"org.clearing.BankingParticipant#bank1"},
            "state":"PENDING_PRE_PROCESS",
            "parties":["org.clearing.BankingParticipant#bank1","org.clearing.BankingParticipant#bank3"],
            "transferRequests":["org.clearing.TransferRequest#reqid2"]}
            ]
            """




