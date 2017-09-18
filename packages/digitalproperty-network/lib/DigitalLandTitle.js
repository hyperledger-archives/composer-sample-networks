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

/* global getAssetRegistry */
/*eslint-disable no-unused-vars*/
/*eslint-disable no-undef*/

'use strict';
/**
 * Process a property that is held for sale
 * @param {net.biz.digitalPropertyNetwork.RegisterPropertyForSale} propertyForSale the property to be sold
 * @return {Promise} Asset Registry Promise
 * @transaction
 */
function onRegisterPropertyForSale(propertyForSale) {
    console.log('### onRegisterPropertyForSale ' + propertyForSale.toString());
    propertyForSale.title.forSale = true;

    var SID;
    var salesRegistry;

    SID = propertyForSale.seller.personId + propertyForSale.title.titleId;

    console.log('###' + 'SID =' + SID);

    return getAssetRegistry('net.biz.digitalPropertyNetwork.SalesAgreement')
        .then(function (result) {
            salesRegistry = result;
        })
        .then(function () {
            salesAgreement = getFactory().newResource('net.biz.digitalPropertyNetwork', 'SalesAgreement', SID);
            salesAgreement.seller = propertyForSale.seller;
            salesAgreement.title = propertyForSale.title;
            return salesRegistry.add(salesAgreement);
        })
        .then(function () {
            return getAssetRegistry('net.biz.digitalPropertyNetwork.LandTitle').then(function (result) {
                return result.update(propertyForSale.title);
            });
        }
        );
}