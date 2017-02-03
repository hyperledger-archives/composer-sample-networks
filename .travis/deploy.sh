#!/bin/bash

# Exit on first error, print all commands.
set -ev
set -o pipefail

# Grab the Concerto directory.
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd )"

# Check that this is the right node.js version.
if [ "${TRAVIS_NODE_VERSION}" != "" -a "${TRAVIS_NODE_VERSION}" != "4" ]; then
    echo Not executing as not running primary node.js version.
    exit 0
fi

# Check that this is not the system tests.
if [ "${SYSTEST}" != "" ]; then
    echo Not executing as running system tests.
    exit 0
fi

# Check that this is the main repository.
if [[ "${TRAVIS_REPO_SLUG}" != fabric-composer* ]]; then
    echo "Skipping deploy; wrong repository slug."
    exit 0
fi

# Set the NPM access token we will use to publish.
npm config set registry https://registry.npmjs.org/
npm config set //registry.npmjs.org/:_authToken ${NPM_TOKEN}

# Set the GitHub deploy key we will use to publish.
set-up-ssh --key "$encrypted_568b95f14ac3_key" \
           --iv "$encrypted_568b95f14ac3_iv" \
           --path-encrypted-key ".travis/github_deploy_key.enc"

# Change from HTTPS to SSH.
./.travis/fix_github_https_repo.sh

# Push the code to npm.
if [ -z "${TRAVIS_TAG}" ]; then

    # Set the prerelease version.
    npm run pkgstamp

    # Publish with unstable tag. These are development builds.
    echo "Pushing with tag unstable"
    lerna exec --ignore 'composer-systests' -- npm publish --tag=unstable 2>&1 | tee
else

    # Publish with latest tag (default). These are release builds.
    echo "Pushing with tag latest"
    lerna exec --ignore 'composer-systests' -- npm publish 2>&1 | tee
fi
