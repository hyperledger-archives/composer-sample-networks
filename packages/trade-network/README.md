# Trade Network

> This Business Network illustrates commodity trading.

This business network defines:

**Participant**
`Trader`, `Regulator`

**Asset**
`Commodity`

**Transaction(s)**
`Trade`, `BulkTrade`, `RemoveHighQuantityCommodities`

For test purposes `_demoSetup`

**Event**
`TradeNotification `

To test this Business Network Definition in the **Test** tab:

Clck on **SubmitTransaction** and select the transaction to submit as `_demoSetup`
This will create two Traders, and a selection of assets. 

Create two `Trader` participants:

```
{
  "$class": "org.acme.trading.Trader",
  "tradeId": "TRACY",
  "firstName": "Tracy",
  "lastName": "Trader"
}
```

```
{
  "$class": "org.acme.trading.Trader",
  "tradeId": "TOM",
  "firstName": "Tom",
  "lastName": "Trader"
}
```




Submit a `Trade` transaction:

```
{
  "$class": "org.acme.trading.Trade",
  "commodity": "resource:org.acme.trading.Commodity#Ag",
  "newOwner": "resource:org.acme.trading.Trader#TOM"
}
```

After submitting this transaction, you should now see the transaction in the transaction registry. As a result, the owner of the commodity `ABC` should now be owned `TRADER2` in the Asset Registry.

Congratulations!
