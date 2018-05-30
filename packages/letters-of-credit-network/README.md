# Letters of Credit Network

> This network tracks letters of credit from application through to closure.

## Models within this business network

### Participants
`Customer`, `Bank Employee`

### Assets
`LetterOfCredit`

### Transactions
`InitialApplication`, `Approve`, `Reject`, `SuggestChanges`, `ShipProduct`, `ReceiveProduct`, `ReadyForPayment`, `Close`, `CreateDemoParticipants`

### Events
`InitialApplicationEvent`, `ApproveEvent`, `RejectEvent`, `SuggestChangesEvent`, `ShipProductEvent`, `ReceiveProductEvent`, `ReadyForPaymentEvent`, `CloseEvent`

## Example use of this Business network
Two parties, each a `Customer` of a bank come to an agreement that Party A will import x number of Product Y from Party B.

Party A uses their banking application to request a letter of credit using details from the agreement. The banking application submits an `InitialApplication` transaction which creates a new `LetterOfCredit` asset containing details of the two parties, their banks and their agreement.

A `BankEmployee` at Party A's bank uses the banks internal application to review the letter of credit. The employee decides they do not like the rules set out in the application and therefore they decide to suggest changes using their application to submit a `SuggestChanges` transaction.

Party A is alerted on their banking application that changes have been suggested in the letter of credit. Party A reviews the changes to the rules suggested by their bank and approves the changes using their banking application to submit an `Approve` transaction.

The letter is now approved by both Party A and their bank. A `BankEmployee` at Party B's bank uses the banks internal application to review the letter of credit. The employee uses their application to submit an `Approve` transaction to mark that Party B's bank is happy with the issuance of the letter of credit to their customer, Party B.

Party B is alerted to the letter of credit in their banking application. They use the application to review the letter and approve it using their application to submit an `Approve` transaction. The letter is now unable to be changed any further.

Once Party B has manufactured the goods and sent them for shipping Party B uses their banking application to access the letter of credit and mark the goods relating to it as shipped using a `ShipProduct` transaction, passing with the transaction a hash of the shipping documents to be used as proof of shipping. 

When the goods arrive at their destination Party A reviews what they have received and checks that the received goods match the rules set out in the letter of credit. Party A is happy that they do and uses the banking application to submit a `ReceiveProduct` transaction.

A `BankEmployee` at Party A's bank is alerted that Party A has stated that the goods are received. The employee does their own checks on the goods against the letter of credit rules and then uses their banking application to submit a `ReadyForPayment` transaction. Their own internal system then transfers funds to Party B's bank.

A `BankEmployee` at Party B's bank is alerted that the letter of credit is ready to be paid and confirms that Party A has transferred the funds. The employee uses their banking application to close the letter of credit using a `Close` transaction and pay the money into Party B's account.

## Testing this network within playground
The steps below will simulate the above scenario within playground.

Navigate to the **Test** tab and then submit a `CreateDemoParticipants` transaction:

```
{
  "$class": "org.example.loc.CreateDemoParticipants"
}
```

Navigate to the ID registry and generate IDs for:

```
org.example.loc.Customer#alice
org.example.loc.Customer#bob
org.example.loc.BankEmployee#matias
org.example.loc.BankEmployee#ella
```

Select to Alice to be your identity.

Navigate to the **Test** tab and then submit an `InitialApplication` transaction to request a letter of credit. The application will cover Alice and Bob's prior agreement to the following:
- Bob will deliver 100 computers
- Alice will pay $450 for each computer
- The computers will be received in working order
- The computers will be received within 30 days

```
{
  "$class": "org.example.loc.InitialApplication",
  "letterId": "LETTER-REF-123",
  "applicant": "resource:org.example.loc.Customer#alice",
  "beneficiary": "resource:org.example.loc.Customer#bob",
  "rules": [
    {
      "ruleId": "LETTER-REF-123-RULE-1",
      "ruleText": "The computers will be received in working order"
    },
    {
      "ruleId": "LETTER-REF-123-RULE-2",
      "ruleText": "The computers will be received within 30 days"
    }
  ],
  "productDetails": {
    "$class": "org.example.loc.ProductDetails",
    "productType": "Computers",
    "quantity": 100,
    "pricePerUnit": 450
  }
}
```

This creates a `LetterOfCredit` asset and sets the issuingBank to be Alice's bank and exportersBank to be Bob's bank.

---

Use the ID registry to select Matias to be your identity.

Matias works at Alice's bank. Review the letter of credit by selecting the `LetterOfCredit` asset. Matias decides that the rules are not suitable for the bank and therefore he decides to suggest changes.

Submit a `SuggestChanges` transaction to change the rules:

```
{
  "$class": "org.example.loc.SuggestChanges",
  "loc": "resource:org.example.loc.LetterOfCredit#LETTER-REF-123",
  "rules": [
      {
      "ruleId": "LETTER-REF-123-RULE-1",
      "ruleText": "The computers will be received in working order"
    },
    {
      "ruleId": "LETTER-REF-123-RULE-2-UPDATED",
      "ruleText": "The computers will be received within 15 days"
    }
  ],
  "suggestingParty": "resource:org.example.loc.BankEmployee#matias"
}
```

This transaction clears the array `LetterOfCredit` asset's `approval` field, updating it contain only the suggesting party and replaces the rules with the updated rules. 

---

Use the ID registry to select Alice to be your identity.

Review the changes made to the letter of credit by selecting the `LetterOfCredit` asset. Alice agrees with the changes and decides she will approve.

Approve the letter by submitting an `Approve` transaction:

```
{
  "$class": "org.example.loc.Approve",
  "loc": "resource:org.example.loc.LetterOfCredit#LETTER-REF-123",
  "approvingParty": "resource:org.example.loc.Customer#alice"
}
```

This transaction adds Alice to the array of parties in the `approval` field of the `LetterOfCredit` asset.

---

Use the ID registry to select Ella to be your identity. 

**NOTE:** Alice doesn't have permission to see Ella and therefore you must switch via admin first.

Ella works at Bob's bank. Review the letter of credit by selecting the `LetterOfCredit` asset. Ella decides that the letter of credit is acceptable to her bank and that she will approve the request.

Approve the letter by submitting an `Approve` transaction: 

```
{
  "$class": "org.example.loc.Approve",
  "loc": "resource:org.example.loc.LetterOfCredit#LETTER-REF-123",
  "approvingParty": "resource:org.example.loc.BankEmployee#ella"
}
```

This transaction adds Ella to the array of parties in the `approval` field of the `LetterOfCredit` asset.

---

Use the ID registry to select Bob to be your identity.

Bob reviews the letter of credit to ensure that it matches with his and Alice's agreement. He notices that the rules don't quite match the agreement however he still decides to accept the letter of credit and go through with the deal.

Approve the letter by submitting an `Approve` transaction:

```
{
  "$class": "org.example.loc.Approve",
  "loc": "resource:org.example.loc.LetterOfCredit#LETTER-REF-123",
  "approvingParty": "resource:org.example.loc.Customer#bob"
}
```

This transaction adds Bob to the array of parties in the `approval` field of the `LetterOfCredit` asset. As now all the parties have submitted their approval the `status` field is also updated to be `APPROVED`. At this point no participant may reject or suggest changes to the letter. Further participants (e.g. other bank employees) are also blocked from adding their approval.  

Bob manufactures the computers and ships them. He updates the `LetterOfCredit` asset to add proof that he has shipped the goods.

Submit a `ShipProduct` transaction:

```
{
  "$class": "org.example.loc.ShipProduct",
  "loc": "resource:org.example.loc.LetterOfCredit#LETTER-REF-123",
  "evidence": "337478411cab754ce47fcaa72ec1d0f6"
}
```

This transaction updates the `status` field of the `LetterOfCredit` asset to be `SHIPPED` and adds the evidence provided (in this case a hash of the shipping invoice) to the `evidence` array. 

---

Use the ID registry to select Alice to be your identity.

Alice now receives the goods and has inspected them. The goods arrived within 14 days and were in working order and therefore Alice decides to update the letter of credit to show she has accepted delivery.

Submit a `ReceiveProduct` transaction:

```
{
  "$class": "org.example.loc.ReceiveProduct",
  "loc": "resource:org.example.loc.LetterOfCredit#LETTER-REF-123"
}
```

This transaction updates the `LetterOfCredit` asset to have a `status` of `RECEIVED`.

---

Use the ID registry to select Matias to be your identity.

Matias inspects the goods received by Alice and agrees that they meet the rules set out in the letter. He therefore decides to approve the transfer of funds to Bob's bank and updates the letter of credit to show that these funds are ready.

Submit a `ReadyForPayment` transaction:

```
{
  "$class": "org.example.loc.ReadyForPayment",
  "loc": "resource:org.example.loc.LetterOfCredit#LETTER-REF-123"
}
```

This transaction updates the `status` of the letter of credit to be `READY_FOR_PAYMENT`. The payment is not covered by this network.

---

Use the ID registry to select Ella to be your identity.

**NOTE:** Matias doesn't have permission to see Ella and therefore you must switch via admin first.

Ella having received the funds from Alice's bank can close the letter of credit and deposit the funds in Bob's bank account. 

Submit a `Close` transaction:

```
{
  "$class": "org.example.loc.Close",
  "loc": "resource:org.example.loc.LetterOfCredit#LETTER-REF-123",
  "closeReason": "Payment made"
}
```

This transaction updates the `status` of the letter to be `CLOSED`. The letter is now complete and no further transactions can take place.

This business network has been used to create demo application that simulate the scenario above. You can find more detail on these at https://github.com/hyperledger/composer-sample-applications/tree/master/packages/letters-of-credit

## License <a name="license"></a>
Hyperledger Project source code files are made available under the Apache License, Version 2.0 (Apache-2.0), located in the LICENSE file. Hyperledger Project documentation files are made available under the Creative Commons Attribution 4.0 International License (CC-BY-4.0), available at http://creativecommons.org/licenses/by/4.0/.