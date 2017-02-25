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

/**
 * Publish a new data item
 * @param {org.acme.securities.PublishDataItem} publishDataItem - the publishDataItem transaction
 * @transaction
 */
function publish(publishDataItem) {

    return getAssetRegistry('org.acme.securities.SecurityReferenceData')
        .then(function(registry) {
            return registry.exists(publishDataItem.ISINCode);
        });
}
