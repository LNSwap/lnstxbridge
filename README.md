# LN - STX Bridge
## Submarine Swaps between STX <-> Bitcoin on Lightning Network

* This app enables functionality as described in https://github.com/stacksgov/Stacks-Grants/issues/172

## install
* clone the repo, install requirements and compile
`git clone https://github.com/pseudozach/lnstxbridge.git`  
`cd lnstxbridge && npm i && npm run compile`
* start btc & lnd
`npm run docker:regtest`
* start stacks 
`npm run docker:stacks`
* deploy latest Clarity contract under contracts/
* copy boltz.conf to ~/.boltz/boltz.conf and modify as needed
* start the app
`npm run start`

## use 
* API is available at http://127.0.0.1:9001, see [API docs](https://docs.boltz.exchange/en/latest/)
* Deploy frontend available at https://github.com/pseudozach/lnstxbridge-frontend