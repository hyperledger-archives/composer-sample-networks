# Digital Property Network
This defines the transaction implementations, access control lists and other functional aspects. There is a dependency on a version of a Business Network Model. 

With this dependency, this DigitalProperty-Network defines the complete Business Network Definition.  In this specific example, the Digital Property Network. 

## What should I do with this npm module?
It is expected that this npm module would be associated with a CI pipeline and tracked as source code in something like GitHub Enterpise. The CI pipeline this would be able to run functional validation on the whole definition, and also be able to published the module to an NPM repository. This allows sharing of the module etc. 

For a production or QA runtime there are administrative steps (deploy, update, remove etc.) that are performed using this Business Network Definition on a running Hyperledger Fabric. The lifecycle at it's simplest is *deploy a network definition*, *update a network definition* and (potentially) *remove the network definition*. These actions are performed using the Business Network Archive - which is a single file that encapsulates all aspects of the Business Network Definition. It is the 'deployable unit'.

## Creating the BusinessNetwork.
*Step1:* Create a npm module

```
npm init
```
The important aspects of this are the name, version and description. The only dependancy that will be required is the NPM module that contains the model - see step 2.

*Step2:* Create the transaction functions

We need to create a standard JavaScript file to contain the transaction functions

```bash
\git\DigitialProperty-Model > touch lib/DigitalLandTitle.js
```

In this example the following is the implementation of the `registeryPropertyForSale` transaction

```javascript
'use strict';

/**
 * Process a property that is held for sale
 * @param {net.biz.digitalPropertyNetwork.RegisterPropertyForSale} propertyForSale the property to be sold
 * @transaction
 */
function onRegisterPropertyForSale(propertyForSale) {
    console.log('### onRegisterPropertyForSale ' + propertyForSale.toString());
    propertyForSale.title.forSale = true;

    return getAssetRegistry('net.biz.digitalPropertyNetwork.LandTitle').then(function(result) {
            return result.update(propertyForSale.title);
        }
    );
}
```

_FUTURE_
Create a file to hold the permissions access control inforation - create a `permissions.acl` file



## Work with the network
Once we have the network complete we can create a business network definition arhive. This is the unit will actually be deloyable to the HyperLedger Fabric.

There is a `concerto archive` command that can be used to create and inspect these archives. The `concerto network` command is then used to administer the business network archive on the Hyperledger Fabric.

### Creating an archive

The `concerto archive create` command is used to create the archive. The `--archiveFile` option is used to specify the name of the archive file to create. If this is not specified then a default name will be used that is based on the identifier of the business network (sanitized to be suitable as a filename). For example `@ibm_digitalPropertyNetwork-0.1.2.bna`.

One of either --inputDir or --moduleName must be specified. --inputDir is the directory that contains the `package.json` file of the Business Network npm module's package.json. 



```bash
concerto archive create --archiveFile digitialLandTitle.bna --inputDir . --moduleName DigitalLandTitle
```

Once you have this archive it can then be deployed to the HLF (which will assuming is all running for the moment)

```bash
concerto network deploy --archiveFile  DigitalLandTitle.zip  --enrollId WebAppAdmin --enrollSecret DJY27pEnl16d
```


