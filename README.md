# Sample Hyperledger Composer Business Network Definitions

:warning: :warning: :warning:

**As of the 29th August 2019, the Hyperledger Composer project is in deprecated status. None of the maintainers are actively developing new features. None of the maintainers are actively providing support via GitHub issues. However, if you wish to submit code changes via pull requests, these will be merged.**

**It is highly recommended that you use Hyperledger Fabric v1.4+ instead, which features significant improvements to the developer experience, including a new programming model.**

**More information available here: [What's new in Hyperledger Fabric v1.4](https://hyperledger-fabric.readthedocs.io/en/release-1.4/whatsnew.html#improved-programming-model-for-developing-applications)**

:warning: :warning: :warning:

You must install [Lerna](https://lernajs.io) to build this multi-package repository.

    $ npm install -g lerna

Once Lerna is installed, and this repository is cloned, then you must bootstrap the
repository so that all of the dependencies are installed and all of the packages are
linked together:

    $ lerna bootstrap

You can then work with the packages under [packages/](packages/) on a per-package
basis as any normal node.js package.

Alternatively, you can execute npm commands across all of the packages at once using
Lerna:

    $ lerna run test

## License <a name="license"></a>
Hyperledger Project source code files are made available under the Apache License, Version 2.0 (Apache-2.0), located in the LICENSE file. Hyperledger Project documentation files are made available under the Creative Commons Attribution 4.0 International License (CC-BY-4.0), available at http://creativecommons.org/licenses/by/4.0/.
