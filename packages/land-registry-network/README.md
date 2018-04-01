# Land Registry Business Network

> This network describes a land registry business network. Participants are able to buy Real Estate assets after contracting Loan and Insurance assets.

This business network defines:

**Participant**

`PrivateIndividual`
`Bank`
`Notary`
`InsuranceCompany`
`RealEstateAgent`

**Asset**

`Loan`
`Insurance`
`RealEstate`

**Transactions**

`ContractingLoan`
`ContractingInsurance`
`BuyingRealEstate`

To test this Business Network Definition in the **Test** tab:

Create two `PrivateIndividual` participant:

```
{
	"$class": "org.acme.landregistry.PrivateIndividual",
	"id": "john",
	"name": "John Doe",
	"address": "USA",
	"balance": 50000
}
```

```
{
	"$class": "org.acme.landregistry.PrivateIndividual",
	"id": "jenny",
	"name": "Jenny Jones",
	"address": "USA",
	"balance": 20000
}
```

Create a `Bank` participant:

```
{
	"$class": "org.acme.landregistry.Bank",
	"id": "BANK_ONE",
	"name": "HSBC",
	"balance": 140000
}
```

Create a `InsuranceCompany` participant:

```
{
	"$class": "org.acme.landregistry.InsuranceCompany",
	"id": "INSU_COMP_ONE",
	"name": "AXA",
	"balance": 55000
}
```

Create a `Notary` participant:

```
{
	"$class": "org.acme.landregistry.Notary",
	"id": "NOTARY_ONE",
	"name": "Ben Smith",
	"address": "NYC",
	"balance": 10000
}
```

Create a `RealEstateAgent` participant:

```
{
	"$class": "org.acme.landregistry.RealEstateAgent",
	"id": "AGENT_ONE",
	"name": "Agent Smith",
	"feeRate": 0.07,
	"balance": 2000
}
```

Create a `RealEstate` asset:

```
{
	"$class": "org.acme.landregistry.RealEstate",
	"id": "BUILDING_ONE",
	"address": "Somewhere in Florida",
	"squareMeters": 120,
	"price": 100000,
	"owner": "resource:org.acme.landregistry.PrivateIndividual#john"
}
```

In order to submit the `BuyingRealEstate` transaction, you must first submit `ContractingLoan` and `ContractingInsurance` transactions, in no particular order. These transactions will create a `Loan` asset and `Insurance` asset, which are necessary to submit a `BuyingRealEstate` transaction.

So, in our example, the `PrivateIndividual` Jenny wants to buy John's RealEstate asset. First, Jenny goes to her bank to get a `Loan`:

```
{
	"$class": "org.acme.landregistry.ContractingLoan",
	"debtor": "resource:org.acme.landregistry.PrivateIndividual#jenny",
	"bank": "resource:org.acme.landregistry.Bank#BANK_ONE",
	"realEstate": "resource:org.acme.landregistry.RealEstate#BUILDING_ONE",
	"interestRate": 0.025,
	"durationInMonths": 300
}
```

This will create a `Loan` asset. Now, Jenny needs to insure her future `RealEstate` asset:

```
{
	"$class": "org.acme.landregistry.ContractingInsurance",
	"insured": "resource:org.acme.landregistry.PrivateIndividual#jenny",
	"insuranceCompany": "resource:org.acme.landregistry.InsuranceCompany#INSU_COMP_ONE",
	"realEstate": "resource:org.acme.landregistry.RealEstate#BUILDING_ONE",
	"monthlyCost": 100,
	"durationInMonths": 12
}
```

Great, now we can submit the `BuyingRealEstate` transaction. The `Loan` and `Insurance` id are generated for you depending on the buyer and the bank/insurance company. In this case:

- Loan Id = jennyBUILDING_ONEBANK_ONE
- Insurance Id = jennyINSU_COMP_ONEBUILDING_ONE

```
{
	"$class": "org.acme.landregistry.BuyingRealEstate",
	"buyer": "resource:org.acme.landregistry.PrivateIndividual#jenny",
	"seller": "resource:org.acme.landregistry.PrivateIndividual#john",
	"realEstate": "resource:org.acme.landregistry.RealEstate#BUILDING_ONE",
	"loan": "resource:org.acme.landregistry.Loan#jennyBUILDING_ONEBANK_ONE",
	"insurance": "resource:org.acme.landregistry.Loan#jennyINSU_COMP_ONEBUILDING_ONE",
	"realEstateAgent": "resource:org.acme.landregistry.RealEstateAgent#AGENT_ONE",
	"notary": "resource:org.acme.landregistry.Notary#NOTARY_ONE",
	"isNewOwnerMainResidence": true
}
```

This transaction will do a bunch of things:

- The `RealEstate` owner will be Jenny.
- Jenny's address will be updated to *Somewhere in Florida*, because the field *isNewOwnerMainResidence* was set to true.
- The participants' balances will be updated:
	- The `Notary` will receive 10% of the `RealEstate` price from Jenny ( 10000 ).
	- John will receive 100000 ( the `RealEstate` price ) from the `Bank` financing Jenny's investment.
	- The `RealEstateAgent` will receive 7000 ( 0.07 * 100000 ) from Jenny.
	- Jenny will also pay the first month of her insurance ( 100 )